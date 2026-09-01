import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

export type FormatoHcListItemDto = {
  fileName: string;
  relativePath: string;
};

export type FormatoHcContenidoDto = {
  fileName: string;
  relativePath: string;
  html: string;
  logoFileUrl: string;
  fileDirs: {
    formatosHc: string;
    firmaEntidad: string;
    fotoEntidad: string;
  };
};

const FILE_NAME_RE = /^[^\\/:*?"<>|]+\.(htm|html)$/i;

@Injectable()
export class FormatosHcService {
  constructor(private readonly config: ConfigService) {}

  private rootDir(): string {
    return path.resolve(
      this.config.get<string>('FORMATOS_HC_PATH') ?? 'C:/CeereSio/Formatos HC',
    );
  }

  private publicAssetBase(): string {
    const api = (
      this.config.get<string>('API_PUBLIC_BASE_URL') ?? 'http://localhost:3001'
    ).replace(/\/$/, '');
    return `${api}/formatos-hc/`;
  }

  private relativePath(fileName: string): string {
    return `\\Formatos HC\\${fileName}`;
  }

  list(): FormatoHcListItemDto[] {
    const root = this.rootDir();
    if (!fs.existsSync(root)) return [];
    return fs
      .readdirSync(root, { withFileTypes: true })
      .filter(
        (entry) => entry.isFile() && /\.(htm|html)$/i.test(entry.name),
      )
      .map((entry) => ({
        fileName: entry.name,
        relativePath: this.relativePath(entry.name),
      }))
      .sort((a, b) => a.fileName.localeCompare(b.fileName, 'es'));
  }

  getContenido(fileName: string): FormatoHcContenidoDto {
    const name = this.safeFileName(fileName);
    const full = this.resolveFile(name);
    const raw = this.readHtml(full);
    const html = this.ensureUtf8Meta(
      this.rewriteAssetUrls(raw, this.publicAssetBase()),
    );
    return {
      fileName: name,
      relativePath: this.relativePath(name),
      html,
      logoFileUrl: this.resolveLogoFileUrl(raw),
      fileDirs: {
        formatosHc: this.dirFileUrl(this.rootDir()),
        firmaEntidad: this.dirFileUrl(
          this.config.get<string>('FIRMA_ENTIDAD_PATH') ??
            'C:/CeereSio/Firma Entidad',
        ),
        fotoEntidad: this.dirFileUrl(
          this.config.get<string>('STATIC_IMAGES_PATH') ??
            'C:/CeereSio/Foto Entidad',
        ),
      },
    };
  }

  private safeFileName(input: string): string {
    const raw = String(input ?? '').trim();
    if (!raw) {
      throw new BadRequestException('Debe indicar el archivo del formato');
    }
    let decoded = raw;
    try {
      decoded = decodeURIComponent(raw);
    } catch {
      decoded = raw;
    }
    const name = path.basename(decoded.replace(/\\/g, '/'));
    if (!FILE_NAME_RE.test(name)) {
      throw new BadRequestException('Nombre de formato no válido');
    }
    return name;
  }

  private resolveFile(fileName: string): string {
    const root = this.rootDir();
    const full = path.resolve(root, fileName);
    const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
    if (!full.toLowerCase().startsWith(rootWithSep.toLowerCase())) {
      throw new BadRequestException('Ruta de formato no permitida');
    }
    if (!fs.existsSync(full) || !fs.statSync(full).isFile()) {
      throw new NotFoundException(`No se encontró el formato ${fileName}`);
    }
    return full;
  }

  private readHtml(filePath: string): string {
    const buf = fs.readFileSync(filePath);
    if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
      return buf.slice(3).toString('utf8');
    }
    const latin1 = buf.toString('latin1');
    const charset = (
      latin1.match(/charset\s*=\s*["']?([\w-]+)/i)?.[1] ?? ''
    ).toLowerCase();
    if (charset.includes('utf-8') || charset.includes('utf8')) {
      return buf.toString('utf8');
    }
    return latin1;
  }

  private toFileUrl(fullPath: string): string {
    const normalized = fullPath.replace(/\\/g, '/');
    if (/^[a-zA-Z]:/.test(normalized)) {
      return `file:///${encodeURI(normalized)}`;
    }
    return `file://${encodeURI(normalized)}`;
  }

  private dirFileUrl(dir: string): string {
    const url = this.toFileUrl(path.resolve(dir));
    return url.endsWith('/') ? url : `${url}/`;
  }

  private resolveLogoFileUrl(html: string): string {
    const imgs = html.matchAll(/<img\b([^>]*)>/gi);
    for (const img of imgs) {
      const attrs = img[1] ?? '';
      if (/\bname\s*=\s*["']Entidad/i.test(attrs)) continue;
      const src = attrs.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1]?.trim();
      if (!src) continue;
      if (/^file:/i.test(src)) return src;
      const fileName = path.basename(
        src.replace(/\\/g, '/').split('?')[0] ?? '',
      );
      if (!fileName) continue;
      return this.toFileUrl(path.join(this.rootDir(), fileName));
    }
    return '';
  }

  private ensureUtf8Meta(html: string): string {
    if (/<head[^>]*>/i.test(html)) {
      return html.replace(/<head[^>]*>/i, (head) => `${head}\n<meta charset="utf-8">`);
    }
    return `<meta charset="utf-8">\n${html}`;
  }

  private rewriteAssetUrls(html: string, publicBase: string): string {
    const rewrite = (raw: string): string => {
      const value = String(raw ?? '').trim();
      if (
        !value ||
        value.startsWith('#') ||
        /^(https?:|data:|javascript:|mailto:)/i.test(value)
      ) {
        return raw;
      }
      let fileName = value;
      if (/^file:/i.test(value)) {
        try {
          const url = new URL(value);
          fileName = path.basename(decodeURIComponent(url.pathname));
        } catch {
          fileName = path.basename(value.replace(/\\/g, '/'));
        }
      } else {
        fileName = path.basename(value.replace(/\\/g, '/').split('?')[0] ?? '');
      }
      if (!fileName) return raw;
      return `${publicBase}${encodeURIComponent(fileName)}`;
    };

    return html
      .replace(
        /(\s(?:src|href))\s*=\s*"([^"]*)"/gi,
        (_m, attr: string, url: string) => `${attr}="${rewrite(url)}"`,
      )
      .replace(
        /(\s(?:src|href))\s*=\s*'([^']*)'/gi,
        (_m, attr: string, url: string) => `${attr}='${rewrite(url)}'`,
      )
      .replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (_m, quote: string, url: string) => {
        const next = rewrite(url);
        return `url(${quote}${next}${quote})`;
      });
  }
}
