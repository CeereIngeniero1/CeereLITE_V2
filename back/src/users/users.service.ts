import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { PatientUserResponseDto } from './dto/patient-user-response.dto';

@Injectable()
export class UsersService {
  private readonly staticImagesPath: string;

  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {
    this.staticImagesPath =
      this.config.getOrThrow<string>('STATIC_IMAGES_PATH');
  }

  private resolveAvatarUrl(fileName: string | null): string {
    const base = this.config
      .getOrThrow<string>('API_PUBLIC_BASE_URL')
      .replace(/\/$/, '');
    if (!fileName) {
      return `${base}/static-images/AvatarPorDefecto.png`;
    }
    const avatarPath = path.join(this.staticImagesPath, fileName);
    if (fs.existsSync(avatarPath)) {
      return `${base}/static-images/${encodeURIComponent(fileName)}`;
    }
    return `${base}/static-images/AvatarPorDefecto.png`;
  }

  async listPatientsForAgenda(): Promise<PatientUserResponseDto[]> {
    const rows = await this.dataSource.query<
      Record<string, string | number | null>[]
    >(
      `
        SELECT
            COALESCE(TipoDoc.[Tipo de Documento] + ' ', '') + COALESCE(Ent.[Documento Entidad], '') AS id2,
            Ent.[Documento Entidad] AS id,
            Ent.[Nombre Completo Entidad] AS name,
            'Paciente' AS role,
            'Desarrollador' AS team,
            EstaEnt.[Estado Entidad] AS status,
            EntIII.[Edad EntidadIII] AS age,
            Ent.[Foto Entidad] AS avatar,
            EntII.[E-mail Nro 1 EntidadII] AS email,
            TipoEnt.[Descripción Tipo Entidad] AS tipoentidad
        FROM Entidad AS Ent
        INNER JOIN EntidadII AS EntII ON Ent.[Documento Entidad] = EntII.[Documento Entidad]
        INNER JOIN [Función Por Entidad] AS FunEnt ON Ent.[Documento Entidad] = FunEnt.[Documento Entidad]
        INNER JOIN [EntidadIII] AS EntIII ON EntII.[Documento Entidad] = EntIII.[Documento Entidad]
        INNER JOIN [Tipo de Documento] AS TipoDoc ON Ent.[Id Tipo de Documento] = TipoDoc.[Id Tipo de Documento]
        INNER JOIN [Estado Entidad] EstaEnt ON EntIII.[Id Estado Entidad] = EstaEnt.[Id Estado Entidad]
        INNER JOIN [Tipo Entidad] AS TipoEnt ON EntIII.[Id Tipo Entidad] = TipoEnt.[Id Tipo Entidad]
        WHERE (Ent.[Nombre Completo Entidad] LIKE '%[^ ]%')
          AND (FunEnt.[Id Función] = 3)
        ORDER BY Ent.[Nombre Completo Entidad] ASC
      `,
    );

    return rows.map((row) => ({
      id2: String(row.id2 ?? ''),
      id: String(row.id ?? ''),
      name: String(row.name ?? ''),
      role: String(row.role ?? ''),
      team: String(row.team ?? ''),
      status: String(row.status ?? ''),
      age: row.age != null ? Number(row.age) : null,
      avatar: this.resolveAvatarUrl(
        row.avatar != null ? String(row.avatar) : null,
      ),
      email: row.email != null ? String(row.email) : null,
      tipoentidad: String(row.tipoentidad ?? 'N/A'),
    }));
  }
}
