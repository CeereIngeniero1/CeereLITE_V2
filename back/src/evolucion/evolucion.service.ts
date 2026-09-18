import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { DataSource, MssqlParameter } from 'typeorm';
import type { JwtPayload } from '../auth/auth.service';
import {
  getFotoEntidadFileName,
  resolveFotoEntidad,
  saveEntidadFoto,
  uploadedFileBuffer,
  type UploadedFotoFile,
} from '../entidad-foto';
import { CreateEvaluacionDto } from './dto/create-evaluacion.dto';
import { CreateNotaAclaratoriaDto } from './dto/create-nota-aclaratoria.dto';
import { CreateObservacionDto } from './dto/create-observacion.dto';
import { UpdateObservacionDto } from './dto/update-observacion.dto';
import { UpdateEvaluacionDiagDto } from './dto/update-evaluacion-diag.dto';
import { UpdatePacienteDemografiaDto } from './dto/update-paciente-demografia.dto';
import type {
  CatalogoPacienteItemDto,
  EvolucionSnapshotDto,
  PacienteDatosResponseDto,
  PacienteDemografiaDto,
} from './paciente-demografia.types';

export type EvolucionListItemDto = {
  origen: 'evolucion' | 'nota';
  id: number;
  fechaEvolucion: string;
  estado: string;
  hora: string;
  idTipoEvaluacion?: number;
};

export type HistorialHcItemDto = {
  id: number;
  fecha: string;
  idTipoEvaluacion: number;
  nombreProfesional: string | null;
  diagnosticoGeneral: string;
  diagnosticoEspecifico: string;
};

export type DocumentoAnexoListItemDto = {
  id: number;
  nombre: string;
  fecha: string;
};

export type NotaAclaratoriaDto = {
  id: number;
  fecha: string;
  nota: string;
  documentoPaciente: string;
  nombreProfesional: string | null;
};

export type ObservacionListItemDto = {
  id: number;
  fecha: string;
  observacion: string;
  idEstado: number;
  nombreUsuario: string | null;
};

/** 1 = evolución médica (texto), 4 = formato HTML de HC. */
const TIPOS_NOTA_CLINICA = '1, 4';

export type TipoEvaluacionDto = {
  idListaEvaluacion: number;
  nombreListaEvaluacion: string;
};

export type PacienteHcDto = {
  nombrePaciente: string | null;
  documentoPaciente: string | null;
  idTipoDocumento: number | null;
  tipoDocumentoPaciente: string | null;
  primerApellidoPaciente: string | null;
  segundoApellidoPaciente: string | null;
  primerNombrePaciente: string | null;
  segundoNombrePaciente: string | null;
  direccionPaciente: string | null;
  idListaCiudad: number | null;
  ciudadPaciente: string | null;
  celularPaciente: string | null;
  nacimientoPaciente: string | null;
  edadPaciente: number | null;
  idUnidad: number | null;
  nombreUnidad: string | null;
  idSexoPaciente: number | null;
  sexoPaciente: string | null;
  idEstadoCivil: number | null;
  estadoCivilPaciente: string | null;
  idOcupacion: number | null;
  ocupacionPaciente: string | null;
  documentoAseguradora: string | null;
  idTipoAfiliado: number | null;
  idParentescoResponsable: number | null;
  nombreResponsable: string | null;
  telefonoResponsable: string | null;
};

function toIsoDateOnly(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString().split('T')[0];
  if (typeof value === 'string') return value.split('T')[0];
  return null;
}

function parseYmd(raw: string | undefined): string | null {
  const s = String(raw ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) {
    return null;
  }
  return s;
}

function ymdToSqlDateTime(ymd: string): string {
  return `${ymd} 00:00:00`;
}

function ymdExclusiveEndSql(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + 1);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} 00:00:00`;
}

function toDateTimeLocal(value: unknown): string | null {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function calcularEdadDesdeFecha(valorFecha: unknown): number | null {
  if (valorFecha == null) return null;
  const fecha =
    valorFecha instanceof Date ? valorFecha : new Date(String(valorFecha));
  if (Number.isNaN(fecha.getTime())) return null;
  const hoy = new Date();
  let edad = hoy.getFullYear() - fecha.getFullYear();
  const m = hoy.getMonth() - fecha.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < fecha.getDate())) edad--;
  return edad < 0 ? 0 : edad;
}

function strOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function numOrNull(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

/** FK opcional: NULL si falta, NaN o 0 (evita violar catálogos). */
function optionalIntFk(value: number | null | undefined): number | null {
  if (value == null) return null;
  const n = Number(value);
  if (Number.isNaN(n) || n === 0) return null;
  return n;
}

function strOrNullIfEmpty(v: string | null | undefined): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function mergeDemografiaNoNulos(
  base: PacienteDemografiaDto,
  extra: PacienteDemografiaDto,
): PacienteDemografiaDto {
  const out: PacienteDemografiaDto = { ...base };
  (Object.keys(extra) as (keyof PacienteDemografiaDto)[]).forEach((key) => {
    const v = extra[key];
    if (v != null && v !== '') {
      (out[key] as PacienteDemografiaDto[typeof key]) = v;
    }
  });
  return out;
}

function nombreCortoUsuario(
  primerNombre: unknown,
  primerApellido: unknown,
): string | null {
  const parts = [strOrNull(primerNombre), strOrNull(primerApellido)].filter(
    (p): p is string => Boolean(p),
  );
  return parts.length ? parts.join(' ') : null;
}

function fechaListItem(
  value: unknown,
  horaFallback: string,
): { fechaEvolucion: string; hora: string; ts: number } {
  const d = value instanceof Date ? value : new Date(String(value ?? ''));
  const ts = Number.isNaN(d.getTime()) ? 0 : d.getTime();
  return {
    fechaEvolucion: ts ? d.toISOString().split('T')[0] : String(value ?? ''),
    hora: horaFallback || (ts
      ? d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      : ''),
    ts,
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function anexoSequenceNumber(documento: string, fileName: string): number {
  const base = path.basename(String(fileName ?? '').replace(/\\/g, '/'));
  const re = new RegExp(`^${escapeRegExp(documento)}-(\\d+)(?:\\.[^.]+)?$`, 'i');
  const m = base.match(re);
  return m ? Number(m[1]) : 0;
}

function contentDispositionAttachment(fileName: string): string {
  const asciiName = fileName.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '');
  const encoded = encodeURIComponent(fileName).replace(/['()]/g, (ch) =>
    `%${ch.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${asciiName}"; filename*=UTF-8''${encoded}`;
}

function mimeFromFileName(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  const map: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
    '.tif': 'image/tiff',
    '.tiff': 'image/tiff',
    '.doc': 'application/msword',
    '.docx':
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx':
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.txt': 'text/plain; charset=utf-8',
  };
  return map[ext] ?? 'application/octet-stream';
}

function extractInsertedEvaluacionId(result: unknown): number | null {
  if (!Array.isArray(result) || result.length === 0) return null;
  const row = result[0] as Record<string, unknown>;
  const raw = row?.id ?? row?.Id;
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isNaN(n) ? null : n;
}

function isEmptyRequired(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  const s = String(v).trim().toLowerCase();
  return s === '' || s === 'null' || s === 'undefined';
}

const PACIENTE_CATALOG_SEGMENTS = [
  'paises',
  'municipios',
  'tipo-documento',
  'sexo',
  'identidad-genero',
  'zona-territorial',
  'etnia',
  'discapacidad',
  'ocupacion',
  'parentesco',
] as const;

type PacienteCatalogSegment = (typeof PACIENTE_CATALOG_SEGMENTS)[number];

@Injectable()
export class EvolucionService {
  private readonly logger = new Logger(EvolucionService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  async listEvolucionesMedicas(
    documentoEntidad: string,
  ): Promise<EvolucionListItemDto[]> {
    const doc = String(documentoEntidad ?? '').trim();
    let evoRows: Record<string, string | number | Date | null>[] = [];
    let notaRows: Record<string, string | number | Date | null>[] = [];
    try {
      evoRows = await this.dataSource.query<
        Record<string, string | number | Date | null>[]
      >(
        `
      SELECT [Id Evaluación Entidad],
             [Id Tipo de Evaluación],
             [Fecha Evaluación Entidad],
             [Estado],
             [Hora]
      FROM dbo.[Lite Cnsta HcListaEvaluacion]
      WHERE [Documento Entidad] = @0
    `,
        [doc],
      );
    } catch {
      evoRows = [];
    }
    try {
      notaRows = await this.dataSource.query<
        Record<string, string | number | Date | null>[]
      >(
        `
      SELECT [Id Historia Clinica CAPF Notas Aclaratorias],
             [Fecha Historia Clinica CAPF Notas Aclaratorias],
             [Hora]
      FROM dbo.[Lite Cnsta HcListaNotaAclaratoria]
      WHERE [Documento Usuario] = @0
    `,
        [doc],
      );
    } catch {
      notaRows = [];
    }

    const evoluciones: Array<EvolucionListItemDto & { ts: number }> =
      evoRows.map((row) => {
        const fh = fechaListItem(
          row['Fecha Evaluación Entidad'],
          String(row['Hora'] ?? ''),
        );
        return {
          origen: 'evolucion' as const,
          id: Number(row['Id Evaluación Entidad']),
          fechaEvolucion: fh.fechaEvolucion,
          estado: String(row['Estado'] ?? ''),
          hora: fh.hora,
          idTipoEvaluacion: Number(row['Id Tipo de Evaluación'] ?? 1),
          ts: fh.ts,
        };
      });

    const notas: Array<EvolucionListItemDto & { ts: number }> = notaRows.map(
      (row) => {
        const fh = fechaListItem(
          row['Fecha Historia Clinica CAPF Notas Aclaratorias'],
          String(row['Hora'] ?? ''),
        );
        return {
          origen: 'nota' as const,
          id: Number(row['Id Historia Clinica CAPF Notas Aclaratorias']),
          fechaEvolucion: fh.fechaEvolucion,
          estado: 'Cerrado',
          hora: fh.hora,
          ts: fh.ts,
        };
      },
    );

    return [...evoluciones, ...notas]
      .sort((a, b) => b.ts - a.ts)
      .map(({ ts: _ts, ...item }) => item);
  }

  async listHistorialHc(
    documentoEntidad: string,
    desdeRaw: string | undefined,
    hastaRaw: string | undefined,
  ): Promise<HistorialHcItemDto[]> {
    const doc = String(documentoEntidad ?? '').trim();
    if (!doc) {
      throw new BadRequestException('documento del paciente es obligatorio');
    }
    const desde = parseYmd(desdeRaw);
    const hasta = parseYmd(hastaRaw);
    if (!desde || !hasta) {
      throw new BadRequestException('desde y hasta deben ser fechas YYYY-MM-DD');
    }
    if (desde > hasta) {
      throw new BadRequestException('desde no puede ser posterior a hasta');
    }
    const desdeSql = ymdToSqlDateTime(desde);
    const hastaExclSql = ymdExclusiveEndSql(hasta);
    const rows = await this.dataSource.query<
      Record<string, string | number | Date | null>[]
    >(
      `
      SELECT [Id Evaluación Entidad],
             [Id Tipo de Evaluación],
             [Fecha Evaluación Entidad],
             [Nombre Profesional],
             [Diagnostico General],
             [Diagnostico especifico]
      FROM dbo.[Lite Cnsta HcHistorial]
      WHERE [Documento Entidad] = @0
        AND [Fecha Evaluación Entidad] >= CONVERT(datetime, @1, 120)
        AND [Fecha Evaluación Entidad] < CONVERT(datetime, @2, 120)
      ORDER BY [Fecha Evaluación Entidad] ASC, [Id Evaluación Entidad] ASC
    `,
      [doc, desdeSql, hastaExclSql],
    );
    return rows.map((row) => {
      const fechaRaw = row['Fecha Evaluación Entidad'];
      const fecha =
        fechaRaw instanceof Date
          ? fechaRaw.toISOString()
          : String(fechaRaw ?? '');
      return {
        id: Number(row['Id Evaluación Entidad']),
        fecha,
        idTipoEvaluacion: Number(row['Id Tipo de Evaluación'] ?? 1),
        nombreProfesional: strOrNull(row['Nombre Profesional']),
        diagnosticoGeneral: String(row['Diagnostico General'] ?? ''),
        diagnosticoEspecifico: String(row['Diagnostico especifico'] ?? ''),
      };
    });
  }

  async listDocumentoAnexos(
    documentoEntidad: string,
  ): Promise<DocumentoAnexoListItemDto[]> {
    const doc = String(documentoEntidad ?? '').trim();
    if (!doc) {
      throw new BadRequestException('documento del paciente es obligatorio');
    }
    const rows = await this.dataSource.query<
      Record<string, string | number | Date | null>[]
    >(
      `
      SELECT [Id Documento Anexo],
             [Documento Anexo],
             [Fecha Documento Anexo]
      FROM dbo.[Lite Cnsta HcDocumentoAnexo]
      WHERE [Documento Entidad] = @0
      ORDER BY [Fecha Documento Anexo] DESC
    `,
      [doc],
    );
    return rows.map((row) => {
      const archivo = strOrNull(row['Documento Anexo']);
      const fechaRaw = row['Fecha Documento Anexo'];
      const fecha =
        fechaRaw instanceof Date
          ? fechaRaw.toISOString()
          : String(fechaRaw ?? '');
      return {
        id: Number(row['Id Documento Anexo']),
        nombre: archivo || 'Documento',
        fecha,
      };
    });
  }

  private documentosRoot(): string {
    const root = path.resolve(
      this.config.get<string>('DOCUMENTOS_PATH') ?? 'C:/CeereSio/Documentos',
    );
    if (!fs.existsSync(root)) {
      fs.mkdirSync(root, { recursive: true });
    }
    return root;
  }

  private resolvePathInDocumentos(fileName: string): {
    fullPath: string;
    fileName: string;
  } {
    const safeName = path.basename(String(fileName ?? '').replace(/\\/g, '/'));
    if (!safeName || safeName === '.' || safeName === '..') {
      throw new NotFoundException('Archivo del anexo no válido');
    }
    const root = this.documentosRoot();
    const fullPath = path.resolve(root, safeName);
    const rootPrefix = root.endsWith(path.sep) ? root : root + path.sep;
    if (fullPath !== root && !fullPath.startsWith(rootPrefix)) {
      throw new NotFoundException('Archivo del anexo no válido');
    }
    return { fullPath, fileName: safeName };
  }

  private async resolveAnexoDiskPath(
    documentoEntidad: string,
    id: number,
  ): Promise<{ fullPath: string; fileName: string }> {
    const doc = String(documentoEntidad ?? '').trim();
    if (!doc) {
      throw new BadRequestException('documento del paciente es obligatorio');
    }
    const rows = await this.dataSource.query<
      Record<string, string | number | Date | null>[]
    >(
      `
      SELECT [Descripción Documento Anexo],
             [Documento Anexo]
      FROM dbo.[Lite Cnsta HcDocumentoAnexo]
      WHERE [Id Documento Anexo] = @0
        AND [Documento Entidad] = @1
    `,
      [id, doc],
    );
    if (!rows[0]) {
      throw new NotFoundException('Documento anexo no encontrado');
    }
    const storedName =
      strOrNull(rows[0]['Descripción Documento Anexo']) ||
      strOrNull(rows[0]['Documento Anexo']);
    if (!storedName) {
      throw new NotFoundException('Documento anexo no encontrado');
    }
    return this.resolvePathInDocumentos(storedName);
  }

  async nextAnexoNombreBase(
    documentoEntidad: string,
  ): Promise<{ nombre: string }> {
    const doc = String(documentoEntidad ?? '').trim();
    if (!doc) {
      throw new BadRequestException('documento del paciente es obligatorio');
    }
    const n = await this.nextAnexoSequence(doc);
    return { nombre: `${doc}-${n}` };
  }

  private async nextAnexoSequence(doc: string): Promise<number> {
    const rows = await this.dataSource.query<
      Record<string, string | null>[]
    >(
      `
      SELECT [Descripción Documento Anexo]
      FROM dbo.[Lite Cnsta HcDocumentoAnexo]
      WHERE [Documento Entidad] = @0
    `,
      [doc],
    );
    let max = 0;
    for (const row of rows) {
      const n = anexoSequenceNumber(
        doc,
        String(row['Descripción Documento Anexo'] ?? ''),
      );
      if (n > max) max = n;
    }
    const root = this.documentosRoot();
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      const n = anexoSequenceNumber(doc, entry.name);
      if (n > max) max = n;
    }
    return max + 1;
  }

  async getDocumentoAnexoArchivo(
    documentoEntidad: string,
    id: number,
  ): Promise<{
    fullPath: string;
    fileName: string;
    mime: string;
    disposition: string;
  }> {
    const { fullPath, fileName } = await this.resolveAnexoDiskPath(
      documentoEntidad,
      id,
    );
    if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
      throw new NotFoundException('No se encontró el archivo en Documentos');
    }
    return {
      fullPath,
      fileName,
      mime: mimeFromFileName(fileName),
      disposition: contentDispositionAttachment(fileName),
    };
  }

  async saveDocumentoAnexoArchivo(
    documentoEntidad: string,
    id: number,
    file?: UploadedFotoFile,
  ): Promise<{ ok: true; fileName: string }> {
    const doc = String(documentoEntidad ?? '').trim();
    if (!file) {
      throw new BadRequestException('Debe seleccionar un archivo');
    }
    const buf = uploadedFileBuffer(file);
    if (!buf.length) {
      throw new BadRequestException('El archivo está vacío');
    }
    const ext = path.extname(file.originalname ?? '').toLowerCase();
    if (!ext || ext === '.') {
      throw new BadRequestException('El archivo debe tener extensión');
    }
    const { fullPath: oldPath, fileName: oldName } =
      await this.resolveAnexoDiskPath(doc, id);
    const stem = path.basename(oldName, path.extname(oldName));
    const fileName = `${stem}${ext}`;
    const { fullPath } = this.resolvePathInDocumentos(fileName);
    fs.writeFileSync(fullPath, buf);
    if (path.resolve(oldPath) !== path.resolve(fullPath) && fs.existsSync(oldPath)) {
      try {
        fs.unlinkSync(oldPath);
      } catch {
        /* ignore */
      }
    }
    if (fileName !== oldName) {
      await this.dataSource.query(
        `
        UPDATE [Documento Anexo]
        SET [Descripción Documento Anexo] = @0
        WHERE [Id Documento Anexo] = @1
          AND [Documento Entidad] = @2
      `,
        [fileName, id, doc],
      );
    }
    return { ok: true, fileName };
  }

  async createDocumentoAnexo(
    user: JwtPayload,
    documentoEntidad: string,
    file?: UploadedFotoFile,
    nombre?: string,
  ): Promise<{ id: number; fileName: string }> {
    const doc = String(documentoEntidad ?? '').trim();
    if (!doc) {
      throw new BadRequestException('documento del paciente es obligatorio');
    }
    if (!file) {
      throw new BadRequestException('Debe seleccionar un archivo');
    }
    const buf = uploadedFileBuffer(file);
    if (!buf.length) {
      throw new BadRequestException('El archivo está vacío');
    }
    const nombreListado = String(nombre ?? '').trim();
    if (!nombreListado) {
      throw new BadRequestException('El nombre del documento es obligatorio');
    }
    const ext = path.extname(file.originalname ?? '').toLowerCase();
    if (!ext || ext === '.') {
      throw new BadRequestException('El archivo debe tener extensión');
    }
    let seq = await this.nextAnexoSequence(doc);
    let fileName = `${doc}-${seq}${ext}`;
    let { fullPath } = this.resolvePathInDocumentos(fileName);
    while (fs.existsSync(fullPath)) {
      seq += 1;
      if (seq > 10_000) {
        throw new BadRequestException('No se pudo asignar un nombre de archivo');
      }
      fileName = `${doc}-${seq}${ext}`;
      ({ fullPath } = this.resolvePathInDocumentos(fileName));
    }
    const docSistema = String(user.documentoEntidad ?? '').trim();
    if (!docSistema) {
      throw new BadRequestException('Usuario sin documento');
    }
    const [idTerminal, docEmpresa] = await Promise.all([
      this.resolveIdTerminal(docSistema),
      this.resolveDocumentoEmpresa(undefined),
    ]);
    fs.writeFileSync(fullPath, buf);
    try {
      const result = await this.dataSource.query(
        `
      DECLARE @InsertedIds TABLE (id INT);

      INSERT INTO [Documento Anexo]
        ([Documento Entidad],
         [Documento Anexo],
         [Descripción Documento Anexo],
         [Fecha Documento Anexo],
         [Documento Empresa],
         [Id Terminal],
         [Id Estado])
      OUTPUT INSERTED.[Id Documento Anexo] INTO @InsertedIds(id)
      VALUES
        (@0, @1, @2, SYSUTCDATETIME(), @3, @4, 1);

      SELECT COALESCE(
        (SELECT TOP 1 id FROM @InsertedIds),
        CAST(SCOPE_IDENTITY() AS INT)
      ) AS id;
    `,
        [doc, nombreListado, fileName, docEmpresa, idTerminal],
      );
      const id = extractInsertedEvaluacionId(result);
      if (id == null) {
        throw new BadRequestException('No se pudo guardar el documento anexo');
      }
      return { id, fileName };
    } catch (err) {
      try {
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
      } catch {
        /* ignore */
      }
      throw err;
    }
  }

  async listObservaciones(
    documentoEntidad: string,
  ): Promise<ObservacionListItemDto[]> {
    const doc = String(documentoEntidad ?? '').trim();
    if (!doc) {
      throw new BadRequestException('documento del paciente es obligatorio');
    }
    const rows = await this.dataSource.query<
      Record<string, string | number | Date | null>[]
    >(
      `
      SELECT IdEntidadObservacion,
             [Fecha Nota Aclaratoria],
             Observacion,
             [Id Estado],
             [Primer Nombre Usuario],
             [Primer Apellido Usuario]
      FROM dbo.[Lite Cnsta HcObservacion]
      WHERE [Documento Usuario] = @0
      ORDER BY [Fecha Nota Aclaratoria] DESC, IdEntidadObservacion DESC
    `,
      [doc],
    );
    return rows.map((row) => this.mapObservacionRow(row));
  }

  async createObservacion(
    user: JwtPayload,
    documentoEntidad: string,
    dto: CreateObservacionDto,
  ): Promise<{ id: number }> {
    const doc = String(documentoEntidad ?? '').trim();
    const observacion = String(dto.observacion ?? '').trim();
    if (!doc) {
      throw new BadRequestException('documento del paciente es obligatorio');
    }
    if (!observacion) {
      throw new BadRequestException('La observación no puede estar vacía');
    }
    const docSistema = String(user.documentoEntidad ?? '').trim();
    if (!docSistema) {
      throw new BadRequestException('Usuario sin documento');
    }
    const idTerminal = await this.resolveIdTerminal(docSistema);
    const result = await this.dataSource.query(
      `
      DECLARE @InsertedIds TABLE (id INT);

      INSERT INTO [Entidad Observacion]
        ([Fecha Nota Aclaratoria],
         Observacion,
         [Documento Usuario],
         [Documento Usuario Sistema],
         [Id Terminal],
         [Id Estado])
      OUTPUT INSERTED.IdEntidadObservacion INTO @InsertedIds(id)
      VALUES
        (SYSUTCDATETIME(), @0, @1, @2, @3, 7);

      SELECT COALESCE(
        (SELECT TOP 1 id FROM @InsertedIds),
        CAST(SCOPE_IDENTITY() AS INT)
      ) AS id;
    `,
      [observacion, doc, docSistema, idTerminal],
    );
    const id = extractInsertedEvaluacionId(result);
    if (id == null) {
      throw new BadRequestException('No se pudo guardar la observación');
    }
    return { id };
  }

  async updateObservacion(
    documentoEntidad: string,
    id: number,
    dto: UpdateObservacionDto,
  ): Promise<{ ok: true }> {
    const doc = String(documentoEntidad ?? '').trim();
    const observacion = String(dto.observacion ?? '').trim();
    const idEstado = Number(dto.idEstado);
    if (!doc) {
      throw new BadRequestException('documento del paciente es obligatorio');
    }
    if (!observacion) {
      throw new BadRequestException('La observación no puede estar vacía');
    }
    if (idEstado !== 7 && idEstado !== 8) {
      throw new BadRequestException('Estado no válido');
    }
    const found = await this.dataSource.query<{ id: number }[]>(
      `
      SELECT TOP 1 IdEntidadObservacion AS id
      FROM [Entidad Observacion]
      WHERE IdEntidadObservacion = @0
        AND [Documento Usuario] = @1
    `,
      [id, doc],
    );
    if (!found.length) {
      throw new NotFoundException('Observación no encontrada');
    }
    await this.dataSource.query(
      `
      UPDATE [Entidad Observacion]
      SET Observacion = @0,
          [Id Estado] = @1
      WHERE IdEntidadObservacion = @2
        AND [Documento Usuario] = @3
    `,
      [observacion, idEstado, id, doc],
    );
    return { ok: true };
  }

  private mapObservacionRow(
    row: Record<string, string | number | Date | null>,
  ): ObservacionListItemDto {
    const fechaRaw = row['Fecha Nota Aclaratoria'];
    const fecha =
      fechaRaw instanceof Date
        ? fechaRaw.toISOString()
        : String(fechaRaw ?? '');
    const estado = Number(row['Id Estado']);
    return {
      id: Number(row['IdEntidadObservacion']),
      fecha,
      observacion: String(row['Observacion'] ?? ''),
      idEstado: estado === 8 ? 8 : 7,
      nombreUsuario: nombreCortoUsuario(
        row['Primer Nombre Usuario'],
        row['Primer Apellido Usuario'],
      ),
    };
  }

  async getNotaAclaratoria(
    id: number,
    documentoPaciente: string,
  ): Promise<NotaAclaratoriaDto> {
    const doc = String(documentoPaciente ?? '').trim();
    if (!doc) {
      throw new BadRequestException('documento del paciente es obligatorio');
    }
    const rows = await this.dataSource.query<
      Record<string, string | number | Date | null>[]
    >(
      `
      SELECT [Id Historia Clinica CAPF Notas Aclaratorias],
             [Fecha Historia Clinica CAPF Notas Aclaratorias],
             [Nota Aclaratoria Historia Clinica CAPF Notas Aclaratorias],
             [Documento Usuario],
             [Nombre Profesional]
      FROM dbo.[Lite Cnsta HcNotaAclaratoria]
      WHERE [Id Historia Clinica CAPF Notas Aclaratorias] = @0
        AND [Documento Usuario] = @1
    `,
      [id, doc],
    );
    const row = rows[0];
    if (!row) {
      throw new NotFoundException('Nota aclaratoria no encontrada');
    }
    const fechaRaw = row['Fecha Historia Clinica CAPF Notas Aclaratorias'];
    const fecha =
      fechaRaw instanceof Date
        ? fechaRaw.toISOString()
        : String(fechaRaw ?? '');
    return {
      id: Number(row['Id Historia Clinica CAPF Notas Aclaratorias']),
      fecha,
      nota: String(
        row['Nota Aclaratoria Historia Clinica CAPF Notas Aclaratorias'] ?? '',
      ),
      documentoPaciente: String(row['Documento Usuario'] ?? ''),
      nombreProfesional: strOrNull(row['Nombre Profesional']),
    };
  }

  async createNotaAclaratoria(
    user: JwtPayload,
    dto: CreateNotaAclaratoriaDto,
  ): Promise<{ id: number }> {
    const docPaciente = String(dto.documentoPaciente ?? '').trim();
    const nota = String(dto.nota ?? '').trim();
    if (!docPaciente) {
      throw new BadRequestException('documentoPaciente es obligatorio');
    }
    if (!nota) {
      throw new BadRequestException('La nota no puede estar vacía');
    }
    const docSistema = String(user.documentoEntidad ?? '').trim();
    if (!docSistema) {
      throw new BadRequestException('Usuario sin documento');
    }
    const idTerminal = await this.resolveIdTerminal(docSistema);

    const result = await this.dataSource.query(
      `
      DECLARE @InsertedIds TABLE (id INT);

      INSERT INTO [Historia Clinica CAPF Notas Aclaratorias]
        ([Fecha Historia Clinica CAPF Notas Aclaratorias],
         [Nota Aclaratoria Historia Clinica CAPF Notas Aclaratorias],
         [Documento Usuario],
         [Documento Usuario Sistema],
         [Id Terminal],
         [Id Estado])
      OUTPUT INSERTED.[Id Historia Clinica CAPF Notas Aclaratorias] INTO @InsertedIds(id)
      VALUES
        (SYSUTCDATETIME(), @0, @1, @2, @3, 1);

      SELECT COALESCE(
        (SELECT TOP 1 id FROM @InsertedIds),
        CAST(SCOPE_IDENTITY() AS INT)
      ) AS id;
    `,
      [nota, docPaciente, docSistema, idTerminal],
    );

    const id = extractInsertedEvaluacionId(result);
    if (id == null) {
      throw new BadRequestException('No se pudo guardar la nota aclaratoria');
    }
    return { id };
  }

  async getEvolucionMedicaById(idEvaluacion: number): Promise<unknown[]> {
    const rows = await this.dataSource.query(
      `
      SELECT [Id Evaluación Entidad], [Tipo de Evaluación], [Id Tipo de Evaluación], [Nombre Profesional],
             [Fecha Evaluación Entidad], [Nombre Paciente],
             [Documento Paciente], [Dirección Domicilio], [Id Ciudad], Ciudad,
             [Teléfono Domicilio], [Fecha Nacimiento], [Edad Paciente],
             [Id Unidad de Medida Edad], [Unidad Medida], [Id Sexo], [Descripción Sexo],
             [Id Estado Civil], [Estado Civil], [Id Ocupación], Ocupación, [Documento Aseguradora],
             [Nombre Aseguradora], [Id Tipo de Afiliado], [Tipo de Afiliado],
             [Acompanante],
             [Id Parentesco],
             [Parentesco Acompanante],
             [Teléfono Acompañante],
             [Responsable], [Id Parentesco Responsable], [Parentesco Responsable],
             [Teléfono Responsable], [Diagnostico General],
             [Diagnostico especifico], [Firma Evaluación Entidad]
      FROM dbo.[Lite Cnsta HcEvaluacionDetalle]
      WHERE [Id Evaluación Entidad] = @0
    `,
      [idEvaluacion],
    );

    if (!rows.length) {
      throw new NotFoundException('Evolución no encontrada');
    }

    return rows;
  }

  async getHistoriaClinicaCabecera(
    documento: string,
  ): Promise<PacienteHcDto[]> {
    const rows = await this.dataSource.query<
      Record<string, string | number | Date | null>[]
    >(
      `
      SELECT [Nombre Paciente],
             [Documento Paciente],
             [Id Tipo Documento],
             [Tipo Documento],
             [Primer Apellido Paciente],
             [Segundo Apellido Paciente],
             [Primer Nombre Paciente],
             [Segundo Nombre Paciente],
             [Direccion Paciente],
             [Id Ciudad],
             Ciudad,
             [Celular Paciente],
             [Fecha Nacimiento Paciente],
             [Edad Paciente],
             [Id Unidad de Medida Edad],
             [Descripción Unidad de Medida Edad],
             [Id Sexo],
             Sexo,
             [Id Estado Civil],
             [Estado Civil],
             [Id Ocupación],
             Ocupación,
             [Id Tipo de Afiliado],
             [Descripción Tipo de Afiliado],
             [Documento EPS],
             [Nombre Responsable],
             [Id Parentesco],
             [Teléfono Responsable]
      FROM dbo.[Lite Cnsta HcPacienteCabecera]
      WHERE [Documento Paciente] = @0
    `,
      [documento],
    );

    return rows.map((row) => ({
      nombrePaciente:
        row['Nombre Paciente'] != null ? String(row['Nombre Paciente']) : null,
      documentoPaciente:
        row['Documento Paciente'] != null
          ? String(row['Documento Paciente'])
          : null,
      idTipoDocumento:
        row['Id Tipo Documento'] != null
          ? Number(row['Id Tipo Documento'])
          : null,
      tipoDocumentoPaciente:
        row['Tipo Documento'] != null ? String(row['Tipo Documento']) : null,
      primerApellidoPaciente:
        row['Primer Apellido Paciente'] != null
          ? String(row['Primer Apellido Paciente'])
          : null,
      segundoApellidoPaciente:
        row['Segundo Apellido Paciente'] != null
          ? String(row['Segundo Apellido Paciente'])
          : null,
      primerNombrePaciente:
        row['Primer Nombre Paciente'] != null
          ? String(row['Primer Nombre Paciente'])
          : null,
      segundoNombrePaciente:
        row['Segundo Nombre Paciente'] != null
          ? String(row['Segundo Nombre Paciente'])
          : null,
      direccionPaciente:
        row['Direccion Paciente'] != null
          ? String(row['Direccion Paciente'])
          : null,
      idListaCiudad:
        row['Id Ciudad'] != null ? Number(row['Id Ciudad']) : null,
      ciudadPaciente:
        row['Ciudad'] != null ? String(row['Ciudad']) : null,
      celularPaciente:
        row['Celular Paciente'] != null
          ? String(row['Celular Paciente'])
          : null,
      nacimientoPaciente: toIsoDateOnly(row['Fecha Nacimiento Paciente']),
      edadPaciente:
        row['Edad Paciente'] != null ? Number(row['Edad Paciente']) : null,
      idUnidad:
        row['Id Unidad de Medida Edad'] != null
          ? Number(row['Id Unidad de Medida Edad'])
          : null,
      nombreUnidad:
        row['Descripción Unidad de Medida Edad'] != null
          ? String(row['Descripción Unidad de Medida Edad'])
          : null,
      idSexoPaciente: row['Id Sexo'] != null ? Number(row['Id Sexo']) : null,
      sexoPaciente: row['Sexo'] != null ? String(row['Sexo']) : null,
      idEstadoCivil:
        row['Id Estado Civil'] != null ? Number(row['Id Estado Civil']) : null,
      estadoCivilPaciente:
        row['Estado Civil'] != null ? String(row['Estado Civil']) : null,
      idOcupacion:
        row['Id Ocupación'] != null ? Number(row['Id Ocupación']) : null,
      ocupacionPaciente:
        row['Ocupación'] != null ? String(row['Ocupación']) : null,
      documentoAseguradora:
        row['Documento EPS'] != null ? String(row['Documento EPS']) : null,
      idTipoAfiliado:
        row['Id Tipo de Afiliado'] != null
          ? Number(row['Id Tipo de Afiliado'])
          : null,
      idParentescoResponsable:
        row['Id Parentesco'] != null ? Number(row['Id Parentesco']) : null,
      nombreResponsable:
        row['Nombre Responsable'] != null
          ? String(row['Nombre Responsable'])
          : null,
      telefonoResponsable:
        row['Teléfono Responsable'] != null
          ? String(row['Teléfono Responsable'])
          : null,
    }));
  }

  async getPacienteDatos(documento: string): Promise<PacienteDatosResponseDto> {
    const doc = documento.trim();
    let demografia =
      (await this.demografiaDesdeLite(doc)) ??
      (await this.demografiaDesdeCabecera(doc)) ??
      (await this.demografiaDesdeListaPaciente(doc));

    try {
      const extra = await this.demografiaDesdeRelacionadorSiHay(doc);
      if (extra) {
        demografia = mergeDemografiaNoNulos(demografia, extra);
      }
    } catch (err) {
      this.logger.warn(
        `Relacionador HC ${doc}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    let evolucionSnapshot: EvolucionSnapshotDto | null = null;
    try {
      evolucionSnapshot = await this.getEvolucionSnapshot(doc);
    } catch (err) {
      this.logger.warn(
        `Snapshot HC ${doc}: ${err instanceof Error ? err.message : String(err)}`,
      );
      evolucionSnapshot = null;
    }
    return { demografia, evolucionSnapshot };
  }

  private async fotoPaciente(doc: string): Promise<{
    fotoUrl: string | null;
    fotoArchivo: string | null;
  }> {
    try {
      return resolveFotoEntidad(
        this.config,
        await getFotoEntidadFileName(this.dataSource, doc),
        doc,
      );
    } catch {
      return { fotoUrl: null, fotoArchivo: null };
    }
  }

  private async demografiaDesdeLite(
    doc: string,
  ): Promise<PacienteDemografiaDto | null> {
    try {
      const rows = await this.dataSource.query<
        Record<string, string | number | Date | null>[]
      >(
        `
        SELECT TOP (1)
          DocumentoPaciente, IdTipoDocumento, DescripcionTipoDocumento, TipoDocumentoBase,
          PrimerApellido, SegundoApellido, PrimerNombre, SegundoNombre, NombreCompleto,
          SexoPaciente, Sexo, IdSexo, Edad, Direccion, Telefono, FechaNacimiento,
          IdMunicipioResidencia, NombreMunicipioResidencia,
          IdOcupacion, CodigoOcupacion, Ocupacion, DescripcionOcupacion, FotoArchivo
        FROM dbo.[Lite Cnsta HcPacienteDemografia]
        WHERE LTRIM(RTRIM(DocumentoPaciente)) = LTRIM(RTRIM(@0))
        `,
        [doc],
      );
      if (!rows.length) return null;
      return this.mapLiteDemografia(rows[0], doc);
    } catch (err) {
      this.logger.warn(
        `Lite HcPacienteDemografia ${doc}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  private async demografiaDesdeCabecera(
    doc: string,
  ): Promise<PacienteDemografiaDto | null> {
    try {
      const rows = await this.dataSource.query<
        Record<string, string | number | Date | null>[]
      >(
        `
        SELECT TOP (1)
          [Nombre Paciente], [Documento Paciente], [Id Tipo Documento], [Tipo Documento],
          [Primer Apellido Paciente], [Segundo Apellido Paciente],
          [Primer Nombre Paciente], [Segundo Nombre Paciente],
          [Direccion Paciente], [Id Ciudad], Ciudad, [Celular Paciente],
          [Fecha Nacimiento Paciente], [Edad Paciente], [Id Sexo], Sexo,
          [Id Ocupación], Ocupación
        FROM dbo.[Lite Cnsta HcPacienteCabecera]
        WHERE LTRIM(RTRIM([Documento Paciente])) = LTRIM(RTRIM(@0))
        `,
        [doc],
      );
      if (!rows.length) return null;
      const row = rows[0];
      const foto = await this.fotoPaciente(doc);
      const nacimiento = row['Fecha Nacimiento Paciente'];
      const edadCalc = calcularEdadDesdeFecha(nacimiento);
      return {
        ...this.demografiaVacia(
          doc,
          strOrNull(row['Nombre Paciente']) ?? doc,
          foto,
        ),
        idTipoDocumento: numOrNull(row['Id Tipo Documento']),
        descripcionTipoDocumento: strOrNull(row['Tipo Documento']),
        documentoPaciente: strOrNull(row['Documento Paciente']) ?? doc,
        primerApellido: strOrNull(row['Primer Apellido Paciente']),
        segundoApellido: strOrNull(row['Segundo Apellido Paciente']),
        primerNombre: strOrNull(row['Primer Nombre Paciente']),
        segundoNombre: strOrNull(row['Segundo Nombre Paciente']),
        nombreCompleto: strOrNull(row['Nombre Paciente']),
        sexoPaciente: strOrNull(row.Sexo),
        sexo: strOrNull(row.Sexo),
        idSexo: numOrNull(row['Id Sexo']),
        edad: edadCalc ?? numOrNull(row['Edad Paciente']),
        direccion: strOrNull(row['Direccion Paciente']),
        telefono: strOrNull(row['Celular Paciente']),
        fechaNacimiento: toDateTimeLocal(nacimiento),
        idMunicipioResidencia: numOrNull(row['Id Ciudad']),
        nombreMunicipioResidencia: strOrNull(row.Ciudad),
        idOcupacion: numOrNull(row['Id Ocupación']),
        ocupacion: strOrNull(row['Ocupación']),
        descripcionOcupacion: strOrNull(row['Ocupación']),
      };
    } catch (err) {
      this.logger.warn(
        `Lite HcPacienteCabecera ${doc}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  private async mapLiteDemografia(
    row: Record<string, string | number | Date | null>,
    doc: string,
  ): Promise<PacienteDemografiaDto> {
    const foto = await this.fotoPaciente(doc);
    const nacimiento = row.FechaNacimiento;
    const edadCalc = calcularEdadDesdeFecha(nacimiento);
    const archivoVista = strOrNull(row.FotoArchivo);
    return {
      ...this.demografiaVacia(
        doc,
        strOrNull(row.NombreCompleto) ?? doc,
        foto,
      ),
      idTipoDocumento: numOrNull(row.IdTipoDocumento),
      descripcionTipoDocumento: strOrNull(row.DescripcionTipoDocumento),
      tipoDocumentoBase: strOrNull(row.TipoDocumentoBase),
      documentoPaciente: strOrNull(row.DocumentoPaciente) ?? doc,
      primerApellido: strOrNull(row.PrimerApellido),
      segundoApellido: strOrNull(row.SegundoApellido),
      primerNombre: strOrNull(row.PrimerNombre),
      segundoNombre: strOrNull(row.SegundoNombre),
      nombreCompleto: strOrNull(row.NombreCompleto),
      sexoPaciente: strOrNull(row.SexoPaciente),
      sexo: strOrNull(row.Sexo),
      idSexo: numOrNull(row.IdSexo),
      edad: edadCalc ?? numOrNull(row.Edad),
      direccion: strOrNull(row.Direccion),
      telefono: strOrNull(row.Telefono),
      fechaNacimiento: toDateTimeLocal(nacimiento),
      idMunicipioResidencia: numOrNull(row.IdMunicipioResidencia),
      nombreMunicipioResidencia: strOrNull(row.NombreMunicipioResidencia),
      idOcupacion: numOrNull(row.IdOcupacion),
      codigoOcupacion: strOrNull(row.CodigoOcupacion),
      ocupacion: strOrNull(row.Ocupacion),
      descripcionOcupacion: strOrNull(row.DescripcionOcupacion),
      fotoArchivo: foto.fotoArchivo ?? archivoVista,
    };
  }

  private async demografiaDesdeRelacionadorSiHay(
    doc: string,
  ): Promise<PacienteDemografiaDto | null> {
    const rows = await this.dataSource.query<
      Record<string, string | number | Date | null>[]
    >(
      `
      SELECT TOP (1)
        IdTipodeDocumento, DescripciTipoDocumento, TipoDocumentoBase, DocumentoPaciente,
        PrimerApellidoBase, SegundoApellidoBase, PrimerNombreBase, SegundoNombreBase,
        NombreCompletoPaciente, SexoPaciente, Sexo, CódigoSexo, IdSexo, Edad, Direccion, Tel,
        FechaNacimientoBase, [Id Sexo], [Id Identidad Genero], IdSexoIdentidadGenero,
        codigoIdentidadGeneroBase, IdentidadGeneroBase, [Id Zona Residencia], Talla, Peso,
        [Id Etnia], ComunidadEtnica, [Id Discapacidad], IdPaisNacionalidad, CodigoPaisNacionalidad,
        NombrePaisNACIONALIDAD, IdPaisRecidencia, CodigoPaisRecidencia, NombrePaisRecidencia,
        IdMunicipioRecidencia, CodigoMunicipioRecidencia, NombreMunicipioRecidencia,
        IdZonaResidencia, DescripciónZonaResidencia, CódigoZonaResidencia, ZonaResidencia,
        IdEtnia, CódigoEtnia, Etnia, DescripciónEtnia, IdDiscapacidad, Codigo, Discapacidad,
        DescripcionDiscapacidad, IdOcupación, CódigoOcupación, Ocupación, DescripciónOcupación,
        Alergias, Alergeno
      FROM [dbo].[Cnsta Relacionador Usuarios Info]
      WHERE LTRIM(RTRIM(DocumentoPaciente)) = LTRIM(RTRIM(@0))
    `,
      [doc],
    );
    if (!rows.length) return null;
    return this.demografiaDesdeRelacionador(rows[0], doc);
  }

  private demografiaVacia(
    doc: string,
    nombre: string | null,
    foto: { fotoUrl: string | null; fotoArchivo: string | null },
  ): PacienteDemografiaDto {
    return {
      idTipoDocumento: null,
      descripcionTipoDocumento: null,
      tipoDocumentoBase: null,
      documentoPaciente: doc,
      primerApellido: null,
      segundoApellido: null,
      primerNombre: null,
      segundoNombre: null,
      nombreCompleto: nombre,
      sexoPaciente: null,
      sexo: null,
      codigoSexo: null,
      idSexo: null,
      edad: null,
      direccion: null,
      telefono: null,
      fechaNacimiento: null,
      idIdentidadGenero: null,
      idSexoIdentidadGenero: null,
      codigoIdentidadGenero: null,
      identidadGenero: null,
      idZonaResidenciaLegacy: null,
      talla: null,
      peso: null,
      idEtnia: null,
      comunidadEtnica: null,
      idDiscapacidad: null,
      idPaisNacionalidad: null,
      codigoPaisNacionalidad: null,
      nombrePaisNacionalidad: null,
      idPaisResidencia: null,
      codigoPaisResidencia: null,
      nombrePaisResidencia: null,
      idMunicipioResidencia: null,
      codigoMunicipioResidencia: null,
      nombreMunicipioResidencia: null,
      idZonaResidencia: null,
      descripcionZonaResidencia: null,
      codigoZonaResidencia: null,
      zonaResidencia: null,
      codigoEtnia: null,
      etnia: null,
      descripcionEtnia: null,
      codigoDiscapacidad: null,
      discapacidad: null,
      descripcionDiscapacidad: null,
      idOcupacion: null,
      codigoOcupacion: null,
      ocupacion: null,
      descripcionOcupacion: null,
      alergias: null,
      alergeno: null,
      fotoUrl: foto.fotoUrl,
      fotoArchivo: foto.fotoArchivo,
    };
  }

  private async demografiaDesdeListaPaciente(
    doc: string,
  ): Promise<PacienteDemografiaDto> {
    try {
      const rows = await this.dataSource.query<
        { id: string; name: string }[]
      >(
        `
        SELECT TOP 1 id, name
        FROM dbo.[Lite Cnsta ListaPaciente]
        WHERE LTRIM(RTRIM(id)) = LTRIM(RTRIM(@0))
        `,
        [doc],
      );
      if (!rows.length) {
        const foto = await this.fotoPaciente(doc);
        return this.demografiaVacia(doc, doc, foto);
      }
      const foto = await this.fotoPaciente(doc);
      return this.demografiaVacia(
        String(rows[0].id ?? doc).trim() || doc,
        String(rows[0].name ?? '').trim() || doc,
        foto,
      );
    } catch {
      const foto = await this.fotoPaciente(doc);
      return this.demografiaVacia(doc, doc, foto);
    }
  }

  private async demografiaDesdeRelacionador(
    row: Record<string, string | number | Date | null>,
    doc: string,
  ): Promise<PacienteDemografiaDto> {
    let edad = numOrNull(row.Edad);
    const edadCalc = calcularEdadDesdeFecha(row.FechaNacimientoBase);
    if (edadCalc != null) {
      if (edad == null || edad !== edadCalc) {
        try {
          await this.dataSource.query(
            `UPDATE [dbo].[EntidadIII]
               SET [Edad EntidadIII] = @0
               WHERE LTRIM(RTRIM([Documento Entidad])) = @1`,
            [edadCalc, doc],
          );
        } catch {
          /* sync opcional */
        }
      }
      edad = edadCalc;
    }

    return {
      idTipoDocumento: numOrNull(row.IdTipodeDocumento),
      descripcionTipoDocumento: strOrNull(row.DescripciTipoDocumento),
      tipoDocumentoBase: strOrNull(row.TipoDocumentoBase),
      documentoPaciente: strOrNull(row.DocumentoPaciente),
      primerApellido: strOrNull(row.PrimerApellidoBase),
      segundoApellido: strOrNull(row.SegundoApellidoBase),
      primerNombre: strOrNull(row.PrimerNombreBase),
      segundoNombre: strOrNull(row.SegundoNombreBase),
      nombreCompleto: strOrNull(row.NombreCompletoPaciente),
      sexoPaciente: strOrNull(row.SexoPaciente),
      sexo: strOrNull(row.Sexo),
      codigoSexo: strOrNull(row['CódigoSexo']),
      idSexo: numOrNull(row.IdSexo),
      edad,
      direccion: strOrNull(row.Direccion),
      telefono: strOrNull(row.Tel),
      fechaNacimiento: toDateTimeLocal(row.FechaNacimientoBase),
      idIdentidadGenero: numOrNull(row['Id Identidad Genero']),
      idSexoIdentidadGenero: numOrNull(row.IdSexoIdentidadGenero),
      codigoIdentidadGenero: strOrNull(row.codigoIdentidadGeneroBase),
      identidadGenero: strOrNull(row.IdentidadGeneroBase),
      idZonaResidenciaLegacy: numOrNull(row['Id Zona Residencia']),
      talla: strOrNull(row.Talla),
      peso: strOrNull(row.Peso),
      idEtnia: numOrNull(row.IdEtnia),
      comunidadEtnica: strOrNull(row.ComunidadEtnica),
      idDiscapacidad: numOrNull(row.IdDiscapacidad),
      idPaisNacionalidad: numOrNull(row.IdPaisNacionalidad),
      codigoPaisNacionalidad: strOrNull(row.CodigoPaisNacionalidad),
      nombrePaisNacionalidad: strOrNull(row.NombrePaisNACIONALIDAD),
      idPaisResidencia: numOrNull(row.IdPaisRecidencia),
      codigoPaisResidencia: strOrNull(row.CodigoPaisRecidencia),
      nombrePaisResidencia: strOrNull(row.NombrePaisRecidencia),
      idMunicipioResidencia: numOrNull(row.IdMunicipioRecidencia),
      codigoMunicipioResidencia: strOrNull(row.CodigoMunicipioRecidencia),
      nombreMunicipioResidencia: strOrNull(row.NombreMunicipioRecidencia),
      idZonaResidencia: numOrNull(row.IdZonaResidencia),
      descripcionZonaResidencia: strOrNull(row['DescripciónZonaResidencia']),
      codigoZonaResidencia: strOrNull(row['CódigoZonaResidencia']),
      zonaResidencia: strOrNull(row.ZonaResidencia),
      codigoEtnia: strOrNull(row['CódigoEtnia']),
      etnia: strOrNull(row.Etnia),
      descripcionEtnia: strOrNull(row['DescripciónEtnia']),
      codigoDiscapacidad: strOrNull(row.Codigo),
      discapacidad: strOrNull(row.Discapacidad),
      descripcionDiscapacidad: strOrNull(row.DescripcionDiscapacidad),
      idOcupacion: numOrNull(row['IdOcupación']),
      codigoOcupacion: strOrNull(row['CódigoOcupación']),
      ocupacion: strOrNull(row['Ocupación']),
      descripcionOcupacion: strOrNull(row['DescripciónOcupación']),
      alergias: strOrNull(row.Alergias),
      alergeno: strOrNull(row.Alergeno),
      ...(await this.fotoPaciente(doc)),
    };
  }

  private async getEvolucionSnapshot(
    documento: string,
  ): Promise<EvolucionSnapshotDto | null> {
    const rows = await this.dataSource.query<
      Record<string, string | number | null>[]
    >(
      `
      SELECT [Id Ciudad],
             [Id Estado Civil],
             [Documento EPS],
             [Nombre EPS],
             [Id Tipo de Afiliado],
             [Tipo de Afiliado],
             [Teléfono 1],
             Celular,
             Email,
             [Id Parentesco],
             [Nombre Responsable],
             [Teléfono Responsable],
             [Id Unidad de Medida Edad],
             [Descripción Unidad de Medida Edad]
      FROM dbo.[Lite Cnsta HcPacienteSnapshot]
      WHERE [Documento Entidad] = @0
    `,
      [documento],
    );
    if (!rows.length) return null;
    const row = rows[0];
    return {
      idListaCiudad: numOrNull(row['Id Ciudad']),
      idEstadoCivil: numOrNull(row['Id Estado Civil']),
      documentoAseguradora: strOrNull(row['Documento EPS']),
      nombreAseguradora: strOrNull(row['Nombre EPS']),
      idTipoAfiliado: numOrNull(row['Id Tipo de Afiliado']),
      tipoAfiliado: strOrNull(row['Tipo de Afiliado']),
      telefono1: strOrNull(row['Teléfono 1']),
      celular: strOrNull(row.Celular),
      email: strOrNull(row.Email),
      idParentescoResponsable: numOrNull(row['Id Parentesco']),
      nombreResponsable: strOrNull(row['Nombre Responsable']),
      telefonoResponsable: strOrNull(row['Teléfono Responsable']),
      idUnidad: numOrNull(row['Id Unidad de Medida Edad']),
      nombreUnidad: strOrNull(row['Descripción Unidad de Medida Edad']),
    };
  }

  async updatePacienteDemografia(
    documentoParam: string,
    dto: UpdatePacienteDemografiaDto,
  ): Promise<{
    success: boolean;
    message: string;
    resultados?: Record<string, unknown>[];
  }> {
    const documento = (dto.documento || documentoParam).trim();
    if (!documento) {
      throw new BadRequestException('El campo Documento es obligatorio');
    }
    if (documento !== documentoParam.trim()) {
      throw new BadRequestException(
        'El documento del cuerpo debe coincidir con la URL',
      );
    }

    const fechaNacimientoValida = dto.fechaNacimiento
      ? new Date(dto.fechaNacimiento)
      : null;
    if (dto.fechaNacimiento && Number.isNaN(fechaNacimientoValida!.getTime())) {
      throw new BadRequestException('fechaNacimiento no tiene un formato válido');
    }

    const edadCalculada = fechaNacimientoValida
      ? calcularEdadDesdeFecha(fechaNacimientoValida)
      : null;
    const edadParaGuardar =
      edadCalculada != null
        ? String(edadCalculada)
        : dto.edad?.trim() || null;

    const required: { value: unknown; label: string }[] = [
      { value: dto.idTipoDocumento, label: 'Tipo Documento' },
      { value: dto.primerApellido, label: 'Primer Apellido' },
      { value: dto.primerNombre, label: 'Primer Nombre' },
      { value: dto.fechaNacimiento, label: 'Fecha y Hora Nacimiento' },
      { value: dto.sexoBio, label: 'Sexo Biológico' },
      { value: dto.idNacionalidad, label: 'Nacionalidad (País)' },
      { value: dto.idResidencia, label: 'País Residencia' },
      { value: dto.idMunicipio, label: 'Municipio Residencia' },
      { value: dto.idZonaTerritorial, label: 'Zona Territorial' },
      { value: dto.idEtnia, label: 'Etnia' },
      { value: dto.idDiscapacidad, label: 'Discapacidad' },
    ];
    const missing = required.filter((f) => isEmptyRequired(f.value));
    if (missing.length) {
      throw new BadRequestException(
        `Faltan campos obligatorios: ${missing.map((m) => m.label).join(', ')}`,
      );
    }

    await this.dataSource.query(
      `
      IF NOT EXISTS (
        SELECT 1 FROM [dbo].[Entidad1888] WHERE [Documento Entidad] = @0
      )
      BEGIN
        INSERT INTO [dbo].[Entidad1888] ([Documento Entidad]) VALUES (@0)
      END
    `,
      [documento],
    );

    const resultados = await this.dataSource.query<Record<string, unknown>[]>(
      `
      EXEC [dbo].[sp_Paciente_Guardar]
        @IdTipoDocumento = @0,
        @Documento = @1,
        @PrimerApellido = @2,
        @SegundoApellido = @3,
        @PrimerNombre = @4,
        @SegundoNombre = @5,
        @FechaNacimiento = @6,
        @Edad = @7,
        @SexoBio = @8,
        @SexoIdenti = @9,
        @IdNacionalidad = @10,
        @Talla = @11,
        @Peso = @12,
        @IdResidencia = @13,
        @IdMunicipio = @14,
        @IdZonaTerritorial = @15,
        @Direccion = @16,
        @IdEtnia = @17,
        @ComunidadEtnica = @18,
        @IdDiscapacidad = @19,
        @Telefono = @20,
        @IdOcupacion = @21,
        @Alergias = @22,
        @Alergeno = @23
    `,
      [
        dto.idTipoDocumento,
        documento,
        dto.primerApellido,
        dto.segundoApellido ?? null,
        dto.primerNombre,
        dto.segundoNombre ?? null,
        fechaNacimientoValida,
        edadParaGuardar,
        dto.sexoBio,
        dto.sexoIdenti ?? null,
        dto.idNacionalidad,
        dto.talla ?? null,
        dto.peso ?? null,
        dto.idResidencia,
        dto.idMunicipio,
        dto.idZonaTerritorial,
        dto.direccion ?? null,
        dto.idEtnia,
        dto.comunidadEtnica ?? null,
        dto.idDiscapacidad,
        dto.telefono ?? null,
        dto.idOcupacion ?? null,
        dto.alergias ?? null,
        dto.alergeno ?? null,
      ],
    );

    try {
      await this.dataSource.query(
        `
        UPDATE [dbo].[EntidadIII]
        SET [Fecha Nacimiento EntidadIII] = ISNULL(@0, [Fecha Nacimiento EntidadIII]),
            [Edad EntidadIII] = ISNULL(@1, [Edad EntidadIII])
        WHERE [Documento Entidad] = @2;

        IF EXISTS (SELECT 1 FROM [dbo].[Entidad1888] WHERE [Documento Entidad] = @2)
        BEGIN
          UPDATE [dbo].[Entidad1888]
          SET [Id Identidad Genero] = @3,
              [Talla] = @4,
              [Peso] = @5,
              [Id Etnia] = @6,
              [Comunidad Etnica] = @7,
              [Id Discapacidad] = @8,
              [Id Pais Nacionalidad] = @9,
              [Id Pais Recidencia] = @10,
              [Id Municipio Recidencia] = @11,
              [Alergias] = @12,
              [Alergeno] = @13
          WHERE [Documento Entidad] = @2
        END
      `,
        [
          fechaNacimientoValida,
          edadCalculada,
          documento,
          dto.sexoIdenti ?? null,
          dto.talla ?? null,
          dto.peso ?? null,
          dto.idEtnia,
          dto.comunidadEtnica ?? null,
          dto.idDiscapacidad,
          dto.idNacionalidad,
          dto.idResidencia,
          dto.idMunicipio,
          dto.alergias ?? null,
          dto.alergeno ?? null,
        ],
      );
    } catch {
      /* refuerzo opcional post-SP */
    }

    return {
      success: true,
      message: 'Paciente guardado correctamente',
      resultados: resultados.length ? resultados : undefined,
    };
  }

  catalogoPacienteSegmentos(): string[] {
    return [...PACIENTE_CATALOG_SEGMENTS];
  }

  async catalogoPaciente(
    segmento: string,
    q?: string,
  ): Promise<CatalogoPacienteItemDto[]> {
    if (!PACIENTE_CATALOG_SEGMENTS.includes(segmento as PacienteCatalogSegment)) {
      throw new NotFoundException({
        error: 'Catálogo de paciente no reconocido',
        segmento,
        permitidos: PACIENTE_CATALOG_SEGMENTS,
      });
    }

    const term = q?.trim();
    const like = term ? `%${term}%` : null;

    switch (segmento as PacienteCatalogSegment) {
      case 'paises': {
        const rows = await this.dataSource.query<Record<string, unknown>[]>(
          like
            ? `SELECT IdPais1888, Nombre + ' (' + Codigo + ')' AS Nombre
               FROM [Cnsta Pais 1888]
               WHERE Nombre LIKE @0 OR Codigo LIKE @0`
            : `SELECT IdPais1888, Nombre + ' (' + Codigo + ')' AS Nombre FROM [Cnsta Pais 1888]`,
          like ? [like] : [],
        );
        return rows.map((r) => ({
          id: Number(r.IdPais1888),
          label: String(r.Nombre ?? ''),
        }));
      }
      case 'municipios': {
        const rows = await this.dataSource.query<Record<string, unknown>[]>(
          like
            ? `SELECT IdCiudad1888, Nombre + ' (' + Codigo + ')' AS Nombre
               FROM [Cnsta Ciudad 1888]
               WHERE Nombre LIKE @0 OR Codigo LIKE @0`
            : `SELECT IdCiudad1888, Nombre + ' (' + Codigo + ')' AS Nombre FROM [Cnsta Ciudad 1888]`,
          like ? [like] : [],
        );
        return rows.map((r) => ({
          id: Number(r.IdCiudad1888),
          label: String(r.Nombre ?? ''),
        }));
      }
      case 'tipo-documento': {
        const rows = await this.dataSource.query<Record<string, unknown>[]>(
          like
            ? `SELECT IdTipodeDocumento, DescripciónTipoDocumento
               FROM [Cnsta Tipodocumento 1888]
               WHERE TipoDocumento LIKE @0 OR CódigoTipoDocumento LIKE @0`
            : `SELECT IdTipodeDocumento, DescripciónTipoDocumento FROM [Cnsta Tipodocumento 1888]`,
          like ? [like] : [],
        );
        return rows.map((r) => ({
          id: Number(r.IdTipodeDocumento),
          label: String(r.DescripciónTipoDocumento ?? ''),
        }));
      }
      case 'sexo': {
        const rows = await this.dataSource.query<Record<string, unknown>[]>(
          like
            ? `SELECT IdSexo, [Descripción Sexo] AS Sexo FROM [Cnsta Sexo 1888] WHERE Sexo LIKE @0`
            : `SELECT IdSexo, [Descripción Sexo] AS Sexo FROM [Cnsta Sexo 1888]`,
          like ? [like] : [],
        );
        return rows.map((r) => ({
          id: Number(r.IdSexo),
          label: String(r.Sexo ?? ''),
        }));
      }
      case 'identidad-genero': {
        const rows = await this.dataSource.query<Record<string, unknown>[]>(
          like
            ? `SELECT IdSexoIdentidadGenero, DescripcionIdentidadGenero
               FROM [Cnsta SexoIdentidad 1888]
               WHERE DescripcionIdentidadGenero LIKE @0`
            : `SELECT IdSexoIdentidadGenero, DescripcionIdentidadGenero FROM [Cnsta SexoIdentidad 1888]`,
          like ? [like] : [],
        );
        return rows.map((r) => ({
          id: Number(r.IdSexoIdentidadGenero),
          label: String(r.DescripcionIdentidadGenero ?? ''),
        }));
      }
      case 'zona-territorial': {
        const rows = await this.dataSource.query<Record<string, unknown>[]>(
          like
            ? `SELECT IdZonaResidencia, DescripciónZonaResidencia
               FROM [Cnsta ZonaResidencia 1888]
               WHERE DescripciónZonaResidencia LIKE @0`
            : `SELECT IdZonaResidencia, DescripciónZonaResidencia FROM [Cnsta ZonaResidencia 1888]`,
          like ? [like] : [],
        );
        return rows.map((r) => ({
          id: Number(r.IdZonaResidencia),
          label: String(r['DescripciónZonaResidencia'] ?? ''),
        }));
      }
      case 'etnia': {
        const rows = await this.dataSource.query<Record<string, unknown>[]>(
          like
            ? `SELECT IdEtnia, DescripciónEtnia FROM [Cnsta Etnia 1888]
               WHERE DescripciónEtnia LIKE @0 OR CódigoEtnia LIKE @0`
            : `SELECT IdEtnia, DescripciónEtnia FROM [Cnsta Etnia 1888]`,
          like ? [like] : [],
        );
        return rows.map((r) => ({
          id: Number(r.IdEtnia),
          label: String(r['DescripciónEtnia'] ?? ''),
        }));
      }
      case 'discapacidad': {
        const rows = await this.dataSource.query<Record<string, unknown>[]>(
          like
            ? `SELECT IdDiscapacidad, DescripcionDiscapacidad FROM [Cnsta Discapacidad 1888]
               WHERE DescripcionDiscapacidad LIKE @0 OR Codigo LIKE @0`
            : `SELECT IdDiscapacidad, DescripcionDiscapacidad FROM [Cnsta Discapacidad 1888]`,
          like ? [like] : [],
        );
        return rows.map((r) => ({
          id: Number(r.IdDiscapacidad),
          label: String(r.DescripcionDiscapacidad ?? ''),
        }));
      }
      case 'ocupacion': {
        const rows = await this.dataSource.query<Record<string, unknown>[]>(
          like
            ? `SELECT IdOcupacion, DescripcionOcupacion FROM [Cnsta Ocupacion 1888]
               WHERE DescripcionOcupacion LIKE @0 OR CodigoOcupacion LIKE @0`
            : `SELECT IdOcupacion, DescripcionOcupacion FROM [Cnsta Ocupacion 1888]`,
          like ? [like] : [],
        );
        return rows.map((r) => ({
          id: Number(r.IdOcupacion),
          label: String(r.DescripcionOcupacion ?? ''),
        }));
      }
      case 'parentesco':
        return this.listParentesco(q);
      default:
        return [];
    }
  }

  /** Catálogo desde la tabla [Parentesco] (Id Estado 7 = activo). */
  async listParentesco(q?: string): Promise<CatalogoPacienteItemDto[]> {
    const term = q?.trim();
    const like = term ? `%${term}%` : null;
    const rows = await this.dataSource.query<Record<string, unknown>[]>(
      like
        ? `SELECT [Id Parentesco], [Parentesco]
           FROM [Parentesco]
           WHERE [Id Estado] = 7
             AND [Parentesco] LIKE @0
           ORDER BY [Orden Parentesco], [Parentesco]`
        : `SELECT [Id Parentesco], [Parentesco]
           FROM [Parentesco]
           WHERE [Id Estado] = 7
           ORDER BY [Orden Parentesco], [Parentesco]`,
      like ? [like] : [],
    );
    return rows
      .map((r) => ({
        id: Number(r['Id Parentesco']),
        label: String(r.Parentesco ?? r['Parentesco'] ?? '').trim(),
      }))
      .filter((r) => Number.isFinite(r.id) && r.label !== '');
  }

  async listTiposEvaluacion(): Promise<TipoEvaluacionDto[]> {
    const rows = await this.dataSource.query<
      Record<string, string | number | null>[]
    >(
      `SELECT [Id Tipo de Evaluación], [Tipo de Evaluación]
       FROM dbo.[Lite Cnsta TipoEvaluacion]`,
    );

    return rows.map((row) => ({
      idListaEvaluacion: Number(row['Id Tipo de Evaluación']),
      nombreListaEvaluacion: String(row['Tipo de Evaluación'] ?? ''),
    }));
  }

  private async resolveDocumentoEmpresa(
    explicit: string | undefined,
  ): Promise<string> {
    if (explicit?.trim()) {
      return explicit.trim();
    }
    const rows = await this.dataSource.query<{ DocumentoEmpresa: string }[]>(
      `SELECT TOP 1 DocumentoEmpresa FROM dbo.[Lite Cnsta Empresa]`,
    );
    if (!rows.length) {
      throw new NotFoundException('No hay empresa en catálogo');
    }
    return rows[0].DocumentoEmpresa;
  }

  /** Si el profesional no tiene terminal, se usa 6326 de forma temporal. */
  private async resolveIdTerminal(documentoEntidad: string): Promise<number> {
    const rows = await this.dataSource.query<{ idTerminal: number | null }[]>(
      `SELECT TOP 1 [Id Terminal] AS idTerminal
       FROM Entidad
       WHERE [Documento Entidad] = @0`,
      [documentoEntidad],
    );
    const n = rows[0]?.idTerminal != null ? Number(rows[0].idTerminal) : 0;
    if (!Number.isFinite(n) || n === 0) {
      return 1;
    }
    return n;
  }

  /** Guarda el nombre de la EPS/aseguradora, no el NIT. */
  private async resolveNombreAseguradora(
    value: string | undefined,
  ): Promise<string | null> {
    const raw = strOrNullIfEmpty(value);
    if (!raw) return null;
    const rows = await this.dataSource.query<{ nombre: string | null }[]>(
      `SELECT TOP 1 [Nombre Completo Entidad] AS nombre
       FROM Entidad
       WHERE [Documento Entidad] = @0`,
      [raw],
    );
    const nombre = rows[0]?.nombre?.trim();
    return nombre || raw;
  }

  async createEvaluacion(
    user: JwtPayload,
    dto: CreateEvaluacionDto,
  ): Promise<{ idEvaluacion: number }> {
    const docEmpresa = await this.resolveDocumentoEmpresa(dto.documentoEmpresa);
    const tipo = dto.idTipoEvaluacion ?? 1;
    const docUsuario = user.documentoEntidad;
    const idTerminal = await this.resolveIdTerminal(docUsuario);
    const nombreAseguradora = await this.resolveNombreAseguradora(
      dto.documentoAseguradora,
    );
    const fechaNac = new Date(dto.fechaNacimiento);
    if (Number.isNaN(fechaNac.getTime())) {
      throw new BadRequestException('fechaNacimiento inválida');
    }

    const idSexo = optionalIntFk(dto.idSexo);
    if (idSexo == null) {
      throw new BadRequestException('idSexo es obligatorio');
    }

    const params = [
      tipo,
      dto.documentoPaciente.trim(),
      dto.edadPaciente,
      dto.nombreAcompanante ?? '',
      optionalIntFk(dto.idParentescoAcompanante),
      dto.telefonoAcompanante ?? '',
      dto.diagnosticoGeneral,
      dto.diagnosticoEspecifico,
      dto.direccionPaciente ?? '',
      optionalIntFk(dto.idCiudad),
      dto.telefonoDomicilio ?? '',
      fechaNac,
      optionalIntFk(dto.idUnidadMedidaEdad),
      idSexo,
      optionalIntFk(dto.idEstadoCivil),
      optionalIntFk(dto.idOcupacion),
      nombreAseguradora,
      optionalIntFk(dto.idTipoAfiliado),
      strOrNullIfEmpty(dto.responsableNombre),
      optionalIntFk(dto.idParentescoResponsable),
      strOrNullIfEmpty(dto.telefonoResponsable),
      docUsuario,
      docEmpresa,
      docUsuario,
      idTerminal,
    ];

    // OUTPUT INTO: triggers en tabla; Id Estado 8 = Abierto (listEvolucionesMedicas).
    const result = await this.dataSource.query(
      `
      DECLARE @InsertedIds TABLE (id INT);

      INSERT INTO [Evaluación Entidad]
        ([Id Tipo de Evaluación], [Fecha Evaluación Entidad], [Documento Entidad],
         [Edad Entidad Evaluación Entidad], [Acompañante Evaluación Entidad],
         [Id Parentesco], [Teléfono Acompañante], [Diagnóstico General Evaluación Entidad],
         [Diagnóstico Específico Evaluación Entidad], [Manejo de Medicamentos], [Dirección Domicilio],
         [Id Ciudad], [Teléfono Domicilio], [Fecha Nacimiento], [Id Unidad de Medida Edad], [Id Sexo],
         [Id Estado], [Id Estado Civil], [Id Ocupación], [Documento Aseguradora], [Id Tipo de Afiliado],
         [Responsable Evaluación Entidad], [Id Parentesco Responsable], [Teléfono Responsable],
         [Documento Usuario], [Documento Empresa], [Documento Profesional], [Id Estado Web], [Con Orden],
         [Sincronizado], [PreguntarControl], [Rips], [Id Terminal])
      OUTPUT INSERTED.[Id Evaluación Entidad] INTO @InsertedIds(id)
      VALUES
        (@0, SYSUTCDATETIME(), @1, @2, @3, @4, @5, @6, @7, 0, @8, @9, @10, @11, @12, @13, 8, @14, @15, @16, @17, @18, @19, @20, @21, @22, @23, 1, 0, 0, 0, 0, @24);

      SELECT COALESCE(
        (SELECT TOP 1 id FROM @InsertedIds),
        CAST(SCOPE_IDENTITY() AS INT)
      ) AS id;
    `,
      params,
    );

    let id = extractInsertedEvaluacionId(result);
    if (id == null) {
      const fallback = await this.dataSource.query<Record<string, unknown>[]>(
        `SELECT CAST(SCOPE_IDENTITY() AS INT) AS id`,
      );
      id = extractInsertedEvaluacionId(fallback);
    }
    if (id == null) {
      throw new BadRequestException('No se pudo crear la evaluación');
    }

    if (nombreAseguradora) {
      await this.dataSource.query(
        `UPDATE [Evaluación Entidad]
         SET [Documento Aseguradora] = @0
         WHERE [Id Evaluación Entidad] = @1`,
        [nombreAseguradora, id],
      );
    }

    return { idEvaluacion: id };
  }

  async updateDiagnosticos(
    idEvaluacion: number,
    dto: UpdateEvaluacionDiagDto,
  ): Promise<void> {
    if (
      dto.diagnosticoGeneral === undefined &&
      dto.diagnosticoEspecifico === undefined
    ) {
      throw new BadRequestException(
        'Debe enviar al menos un diagnóstico a actualizar',
      );
    }

    await this.assertEvolucionMedicaEditable(idEvaluacion);

    const params: unknown[] = [];
    const setParts: string[] = [];
    if (dto.diagnosticoGeneral !== undefined) {
      setParts.push(
        `[Diagnóstico General Evaluación Entidad] = @${params.length}`,
      );
      params.push(new MssqlParameter(dto.diagnosticoGeneral, 'nvarchar'));
    }
    if (dto.diagnosticoEspecifico !== undefined) {
      setParts.push(
        `[Diagnóstico Específico Evaluación Entidad] = @${params.length}`,
      );
      params.push(new MssqlParameter(dto.diagnosticoEspecifico, 'nvarchar'));
    }
    const idPlaceholder = `@${params.length}`;
    params.push(idEvaluacion);

    await this.dataSource.query(
      `UPDATE [Evaluación Entidad]
       SET ${setParts.join(', ')}
       WHERE [Id Evaluación Entidad] = ${idPlaceholder}
         AND [Id Tipo de Evaluación] IN (${TIPOS_NOTA_CLINICA})`,
      params,
    );
  }

  private async getEvolucionEstadoById(
    idEvaluacion: number,
  ): Promise<number | null> {
    const rows = await this.dataSource.query<{ estado: number | null }[]>(
      `SELECT [Id Estado] AS estado
       FROM [Evaluación Entidad]
       WHERE [Id Evaluación Entidad] = @0
         AND [Id Tipo de Evaluación] IN (${TIPOS_NOTA_CLINICA})`,
      [idEvaluacion],
    );
    if (!rows.length) {
      return null;
    }
    return rows[0].estado != null ? Number(rows[0].estado) : null;
  }

  private async assertEvolucionMedicaEditable(idEvaluacion: number): Promise<void> {
    const estado = await this.getEvolucionEstadoById(idEvaluacion);
    if (estado == null) {
      throw new NotFoundException('Evolución no encontrada');
    }
    if (estado === 7) {
      throw new BadRequestException(
        'La evolución está cerrada y no permite edición',
      );
    }
  }

  async savePacienteFoto(
    documentoParam: string,
    file: UploadedFotoFile,
  ): Promise<{ fotoUrl: string | null; fotoArchivo: string | null }> {
    return saveEntidadFoto(
      this.dataSource,
      this.config,
      documentoParam,
      file,
    );
  }

  async cerrarEvolucion(idEvaluacion: number): Promise<{ ok: true }> {
    const estado = await this.getEvolucionEstadoById(idEvaluacion);
    if (estado == null) {
      throw new NotFoundException('Evolución no encontrada');
    }
    if (estado === 7) {
      throw new BadRequestException('La evolución ya está cerrada');
    }

    await this.dataSource.query(
      `UPDATE [Evaluación Entidad]
       SET [Id Estado] = 7
       WHERE [Id Evaluación Entidad] = @0
         AND [Id Tipo de Evaluación] IN (${TIPOS_NOTA_CLINICA})`,
      [idEvaluacion],
    );
    return { ok: true };
  }
}
