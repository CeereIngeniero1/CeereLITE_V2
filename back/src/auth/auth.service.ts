import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as fs from 'fs';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { saveEntidadFoto, type UploadedFotoFile } from '../entidad-foto';

export type AuthUserRow = {
  username: string;
  documentoEntidad: string;
  nombreUsuario: string;
  userLevel: number;
};

export type JwtPayload = AuthUserRow;

export type AuthProfileDto = AuthUserRow & {
  primerNombre: string;
  segundoNombre: string;
  primerApellido: string;
  segundoApellido: string;
  email: string;
  telefono: string;
  fotoUrl: string;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    const rows = await this.dataSource.query<
      {
        username: string;
        documentoEntidad: string;
        nombreUsuario: string;
        idNivel: number;
      }[]
    >(
      `
      SELECT [Nombre de Usuario] AS username,
             en.[Documento Entidad] AS documentoEntidad,
             en.[Nombre Completo Entidad] AS nombreUsuario,
             [Id Nivel] AS idNivel
      FROM Contraseña
      INNER JOIN Entidad AS en ON Contraseña.[Documento Entidad] = en.[Documento Entidad]
      WHERE [Nombre de Usuario] = @0 AND Contraseña = @1
    `,
      [dto.username, dto.password],
    );

    if (!rows.length) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    const row = rows[0];
    const userLevel = Number(row.idNivel);
    if (![1, 2, 3].includes(userLevel)) {
      throw new UnauthorizedException('Nivel de usuario no reconocido');
    }

    const payload: JwtPayload = {
      username: String(row.username ?? ''),
      documentoEntidad: String(row.documentoEntidad ?? ''),
      nombreUsuario: String(row.nombreUsuario ?? ''),
      userLevel,
    };

    const token = await this.jwtService.signAsync(payload);

    return {
      token,
      username: payload.username,
      userLevel,
      documentoEntidad: payload.documentoEntidad,
      nombreUsuario: payload.nombreUsuario,
    };
  }

  async getProfile(user: JwtPayload): Promise<AuthProfileDto> {
    const session = this.normalizeSession(user);
    const rows = await this.dataSource.query<Record<string, unknown>[]>(
      `
      SELECT TOP 1
             username,
             documentoEntidad,
             nombreUsuario,
             primerNombre,
             segundoNombre,
             primerApellido,
             segundoApellido,
             email,
             telefono,
             foto,
             idNivel
      FROM dbo.[Lite Cnsta UsuarioPerfil]
      WHERE LTRIM(RTRIM(documentoEntidad)) = LTRIM(RTRIM(@0))
      ORDER BY CASE
        WHEN username = @1 THEN 0
        ELSE 1
      END
    `,
      [session.documentoEntidad, session.username],
    );
    const row = rows[0];
    if (!row) {
      this.logger.warn(
        `Perfil no encontrado para documento=${session.documentoEntidad} usuario=${session.username}`,
      );
      return this.fromJwt(session);
    }
    return this.mapProfile(row, session);
  }

  async updateFoto(
    user: JwtPayload,
    file: UploadedFotoFile,
  ): Promise<AuthProfileDto> {
    const session = this.normalizeSession(user);
    await saveEntidadFoto(
      this.dataSource,
      this.config,
      session.documentoEntidad,
      file,
    );
    return this.getProfile(session);
  }

  async updateProfile(
    user: JwtPayload,
    dto: UpdateProfileDto,
  ): Promise<AuthProfileDto> {
    const session = this.normalizeSession(user);
    const email = String(dto.email ?? '').trim();
    const telefono = String(dto.telefono ?? '').trim();

    if (dto.newPassword) {
      const current = String(dto.currentPassword ?? '');
      if (!current) {
        throw new BadRequestException('Indique la contraseña actual');
      }
      const ok = await this.dataSource.query<{ username: string }[]>(
        `
        SELECT TOP 1 [Nombre de Usuario] AS username
        FROM Contraseña
        WHERE [Nombre de Usuario] = @0
          AND Contraseña = @1
          AND LTRIM(RTRIM([Documento Entidad])) = LTRIM(RTRIM(@2))
      `,
        [session.username, current, session.documentoEntidad],
      );
      if (!ok.length) {
        throw new BadRequestException('La contraseña actual no es correcta');
      }
    }

    const primerNombre = dto.primerNombre.trim();
    const segundoNombre = String(dto.segundoNombre ?? '').trim();
    const primerApellido = dto.primerApellido.trim();
    const segundoApellido = String(dto.segundoApellido ?? '').trim();

    await this.dataSource.query(
      `
      UPDATE Entidad
      SET [Primer Nombre Entidad] = @0,
          [Segundo Nombre Entidad] = @1,
          [Primer Apellido Entidad] = @2,
          [Segundo Apellido Entidad] = @3
      WHERE LTRIM(RTRIM([Documento Entidad])) = LTRIM(RTRIM(@4))
    `,
      [
        primerNombre,
        segundoNombre,
        primerApellido,
        segundoApellido,
        session.documentoEntidad,
      ],
    );

    await this.dataSource.query(
      `
      IF EXISTS (
        SELECT 1 FROM EntidadII
        WHERE LTRIM(RTRIM([Documento Entidad])) = LTRIM(RTRIM(@0))
      )
      BEGIN
        UPDATE EntidadII
        SET [E-mail Nro 1 EntidadII] = @1,
            [Teléfono Celular EntidadII] = @2
        WHERE LTRIM(RTRIM([Documento Entidad])) = LTRIM(RTRIM(@0))
      END
      ELSE
      BEGIN
        INSERT INTO EntidadII (
          [Documento Entidad],
          [E-mail Nro 1 EntidadII],
          [Teléfono Celular EntidadII]
        )
        VALUES (@0, @1, @2)
      END
    `,
      [session.documentoEntidad, email, telefono],
    );

    if (dto.newPassword) {
      await this.dataSource.query(
        `
        UPDATE Contraseña
        SET Contraseña = @0
        WHERE [Nombre de Usuario] = @1
          AND LTRIM(RTRIM([Documento Entidad])) = LTRIM(RTRIM(@2))
      `,
        [dto.newPassword, session.username, session.documentoEntidad],
      );
    }

    const nombreCompleto = [primerNombre, segundoNombre, primerApellido, segundoApellido]
      .filter(Boolean)
      .join(' ');
    return this.getProfile({
      ...session,
      nombreUsuario: nombreCompleto,
    });
  }

  private normalizeSession(user: JwtPayload): JwtPayload {
    return {
      username: String(user?.username ?? '').trim(),
      documentoEntidad: String(user?.documentoEntidad ?? '').trim(),
      nombreUsuario: String(user?.nombreUsuario ?? '').trim(),
      userLevel: Number(user?.userLevel) || 0,
    };
  }

  private fromJwt(user: JwtPayload): AuthProfileDto {
    return {
      username: user.username ?? '',
      userLevel: Number(user.userLevel) || 0,
      documentoEntidad: user.documentoEntidad ?? '',
      nombreUsuario: user.nombreUsuario ?? '',
      primerNombre: '',
      segundoNombre: '',
      primerApellido: '',
      segundoApellido: '',
      email: '',
      telefono: '',
      fotoUrl: this.resolveAvatarUrl(null),
    };
  }

  private col(row: Record<string, unknown>, ...keys: string[]): string {
    for (const key of keys) {
      const direct = row[key];
      if (direct != null && String(direct).trim() !== '') {
        return String(direct).trim();
      }
    }
    const lower = new Map(
      Object.entries(row).map(([k, v]) => [k.toLowerCase(), v]),
    );
    for (const key of keys) {
      const value = lower.get(key.toLowerCase());
      if (value != null && String(value).trim() !== '') {
        return String(value).trim();
      }
    }
    return '';
  }

  private mapProfile(
    row: Record<string, unknown>,
    user: JwtPayload,
  ): AuthProfileDto {
    const idNivel = this.col(row, 'idNivel', 'Id Nivel', 'userLevel');
    return {
      username: this.col(row, 'username', 'Nombre de Usuario') || user.username,
      documentoEntidad:
        this.col(row, 'documentoEntidad', 'Documento Entidad') ||
        user.documentoEntidad,
      nombreUsuario:
        this.col(row, 'nombreUsuario', 'Nombre Completo Entidad') ||
        user.nombreUsuario,
      userLevel: idNivel ? Number(idNivel) : user.userLevel,
      primerNombre: this.col(row, 'primerNombre', 'Primer Nombre Entidad'),
      segundoNombre: this.col(row, 'segundoNombre', 'Segundo Nombre Entidad'),
      primerApellido: this.col(
        row,
        'primerApellido',
        'Primer Apellido Entidad',
      ),
      segundoApellido: this.col(
        row,
        'segundoApellido',
        'Segundo Apellido Entidad',
      ),
      email: this.col(row, 'email', 'E-mail Nro 1 EntidadII'),
      telefono: this.col(
        row,
        'telefono',
        'Teléfono Celular EntidadII',
        'Teléfono No 1 EntidadII',
      ),
      fotoUrl: this.resolveAvatarUrl(
        this.col(row, 'foto', 'Foto Entidad') || null,
      ),
    };
  }

  private resolveAvatarUrl(fileName: string | null): string {
    const base = this.config
      .getOrThrow<string>('API_PUBLIC_BASE_URL')
      .replace(/\/$/, '');
    const fallback = `${base}/static-images/AvatarPorDefecto.png`;
    if (!fileName) return fallback;
    const imagesPath = this.config.get<string>('STATIC_IMAGES_PATH');
    if (!imagesPath) return fallback;
    const baseName = path.basename(String(fileName).replace(/\\/g, '/'));
    if (!baseName) return fallback;
    const avatarPath = path.join(imagesPath, baseName);
    if (fs.existsSync(avatarPath)) {
      const stamp = fs.statSync(avatarPath).mtimeMs;
      return `${base}/static-images/${encodeURIComponent(baseName)}?t=${stamp}`;
    }
    return fallback;
  }
}
