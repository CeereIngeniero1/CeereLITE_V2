import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { DataSource } from 'typeorm';

export type UploadedFotoFile = {
  buffer?: Buffer;
  path?: string;
  originalname?: string;
  mimetype?: string;
  size?: number;
};

const FOTO_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);

export function uploadedFileBuffer(file?: UploadedFotoFile): Buffer {
  if (file?.buffer?.length) return file.buffer;
  if (file?.path && fs.existsSync(file.path)) {
    return fs.readFileSync(file.path);
  }
  throw new BadRequestException('Debe seleccionar una imagen');
}

function fotoExtension(mimetype: string, originalName: string): string | null {
  const mime = String(mimetype ?? '').toLowerCase();
  if (mime === 'image/jpeg' || mime === 'image/jpg') return 'jpg';
  if (mime === 'image/png') return 'png';
  if (mime === 'image/gif') return 'gif';
  if (mime === 'image/webp') return 'webp';
  const fromName = path
    .extname(originalName || '')
    .replace(/^\./, '')
    .toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fromName)) {
    return fromName === 'jpeg' ? 'jpg' : fromName;
  }
  return null;
}

function normalizeExt(ext: string): string {
  const e = ext.replace(/^\./, '').toLowerCase();
  return e === 'jpeg' ? 'jpg' : e;
}

function basenameFoto(value: string | null | undefined): string {
  if (!value) return '';
  return path.basename(String(value).replace(/\\/g, '/')).trim();
}

function assertInsideImagesRoot(imagesPath: string, dest: string): string {
  const root = path.resolve(imagesPath);
  const resolved = path.resolve(dest);
  const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
  if (!resolved.toLowerCase().startsWith(rootWithSep.toLowerCase())) {
    throw new BadRequestException('Ruta de foto no permitida');
  }
  return resolved;
}

function listFotosForStems(imagesPath: string, stems: string[]): string[] {
  if (!fs.existsSync(imagesPath)) return [];
  const wanted = new Set(
    stems.map((s) => s.trim().toLowerCase()).filter(Boolean),
  );
  if (!wanted.size) return [];
  return fs.readdirSync(imagesPath).filter((name) => {
    const ext = path.extname(name).toLowerCase();
    if (!FOTO_EXTS.has(ext)) return false;
    const stem = path.basename(name, path.extname(name)).toLowerCase();
    return wanted.has(stem);
  });
}

function columnValueFor(
  existingRaw: string | null,
  newBaseName: string,
): string {
  const raw = String(existingRaw ?? '').trim();
  if (!raw) return newBaseName;
  const oldBase = basenameFoto(raw);
  if (!oldBase || raw.length < oldBase.length) return newBaseName;
  return `${raw.slice(0, raw.length - oldBase.length)}${newBaseName}`;
}

function overwriteFotoFile(fullPath: string, buffer: Buffer) {
  if (fs.existsSync(fullPath)) {
    try {
      fs.chmodSync(fullPath, 0o666);
    } catch {
      /* si no se puede cambiar permisos, igual se intenta escribir */
    }
  }
  fs.writeFileSync(fullPath, buffer);
}

export async function getFotoEntidadFileName(
  dataSource: DataSource,
  documento: string,
): Promise<string | null> {
  const rows = await dataSource.query<{ foto: string | null }[]>(
    `
      SELECT TOP 1 [Foto Entidad] AS foto
      FROM Entidad
      WHERE LTRIM(RTRIM([Documento Entidad])) = LTRIM(RTRIM(@0))
    `,
    [documento],
  );
  const raw = rows[0]?.foto;
  if (raw == null) return null;
  const name = String(raw).trim();
  return name || null;
}

export function resolveFotoEntidad(
  config: ConfigService,
  fileName: string | null,
  documento: string,
): { fotoUrl: string | null; fotoArchivo: string | null } {
  const apiBase = config
    .getOrThrow<string>('API_PUBLIC_BASE_URL')
    .replace(/\/$/, '');
  const imagesPath = config.get<string>('STATIC_IMAGES_PATH');
  const doc = String(documento ?? '').trim();
  const fromColumn = basenameFoto(fileName);
  const candidates = [
    fromColumn,
    doc ? `${doc}.jpg` : '',
    doc ? `${doc}.JPG` : '',
    doc ? `${doc}.jpeg` : '',
    doc ? `${doc}.png` : '',
  ].filter(Boolean);

  if (imagesPath) {
    for (const name of candidates) {
      const full = path.join(imagesPath, name);
      if (fs.existsSync(full) && fs.statSync(full).isFile()) {
        const stamp = fs.statSync(full).mtimeMs;
        return {
          fotoUrl: `${apiBase}/static-images/${encodeURIComponent(name)}?t=${stamp}`,
          fotoArchivo: name,
        };
      }
    }
  }

  return { fotoUrl: null, fotoArchivo: fromColumn || null };
}

export async function saveEntidadFoto(
  dataSource: DataSource,
  config: ConfigService,
  documentoParam: string,
  file: UploadedFotoFile,
): Promise<{ fotoUrl: string | null; fotoArchivo: string | null }> {
  const documento = String(documentoParam ?? '').trim();
  if (!documento) {
    throw new BadRequestException('El documento de la entidad es obligatorio');
  }

  const found = await dataSource.query<{ doc: string }[]>(
    `
      SELECT TOP 1 [Documento Entidad] AS doc
      FROM Entidad
      WHERE LTRIM(RTRIM([Documento Entidad])) = LTRIM(RTRIM(@0))
    `,
    [documento],
  );
  if (!found.length) {
    throw new NotFoundException('No se encontró la entidad');
  }

  const buffer = uploadedFileBuffer(file);
  const ext = fotoExtension(file.mimetype ?? '', file.originalname ?? '');
  if (!ext) {
    throw new BadRequestException(
      'Formato no válido. Use JPG, PNG, GIF o WEBP',
    );
  }
  const size = file.size ?? buffer.length;
  if (size > 5 * 1024 * 1024) {
    throw new BadRequestException('La imagen no puede superar 5 MB');
  }

  const imagesPath = config.get<string>('STATIC_IMAGES_PATH');
  if (!imagesPath) {
    throw new BadRequestException(
      'No está configurada la carpeta de fotos (STATIC_IMAGES_PATH)',
    );
  }
  fs.mkdirSync(imagesPath, { recursive: true });

  const safeDoc = documento.replace(/[\\/:*?"<>|]/g, '').trim();
  if (!safeDoc) {
    throw new BadRequestException('Documento de entidad no válido');
  }

  const existingRaw = await getFotoEntidadFileName(dataSource, documento);
  const existingBase = basenameFoto(existingRaw);
  const existingStem = existingBase
    ? path.basename(existingBase, path.extname(existingBase))
    : '';
  const leftovers = listFotosForStems(imagesPath, [safeDoc, existingStem]);
  const sameExtOnDisk = leftovers.find(
    (name) => normalizeExt(path.extname(name)) === ext,
  );

  let fileName: string;
  if (existingBase && normalizeExt(path.extname(existingBase)) === ext) {
    fileName = existingBase;
  } else if (sameExtOnDisk) {
    fileName = sameExtOnDisk;
  } else if (existingStem) {
    fileName = `${existingStem}.${ext}`;
  } else {
    fileName = `${safeDoc}.${ext}`;
  }

  const resolved = assertInsideImagesRoot(
    imagesPath,
    path.join(imagesPath, fileName),
  );
  overwriteFotoFile(resolved, buffer);

  if (!fs.existsSync(resolved) || fs.statSync(resolved).size !== buffer.length) {
    throw new BadRequestException(
      'No se pudo reemplazar el archivo de foto en la carpeta',
    );
  }

  for (const leftover of leftovers) {
    if (leftover.toLowerCase() === fileName.toLowerCase()) continue;
    try {
      const full = assertInsideImagesRoot(
        imagesPath,
        path.join(imagesPath, leftover),
      );
      if (fs.existsSync(full) && fs.statSync(full).isFile()) {
        fs.unlinkSync(full);
      }
    } catch {
      /* no bloquear el guardado si un residual no se puede borrar */
    }
  }

  if (file.path && !file.buffer && fs.existsSync(file.path)) {
    try {
      fs.unlinkSync(file.path);
    } catch {
      /* temp de multer */
    }
  }

  const columnValue = columnValueFor(existingRaw, fileName);
  await dataSource.query(
    `
      UPDATE Entidad
      SET [Foto Entidad] = @0
      WHERE LTRIM(RTRIM([Documento Entidad])) = LTRIM(RTRIM(@1))
    `,
    [columnValue, documento],
  );

  const stored = await getFotoEntidadFileName(dataSource, documento);
  if (!stored || basenameFoto(stored).toLowerCase() !== fileName.toLowerCase()) {
    throw new BadRequestException(
      'La foto se escribió en la carpeta pero no se actualizó Entidad.[Foto Entidad]',
    );
  }

  return resolveFotoEntidad(config, stored, documento);
}
