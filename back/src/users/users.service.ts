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
      const stamp = fs.statSync(avatarPath).mtimeMs;
      return `${base}/static-images/${encodeURIComponent(fileName)}?t=${stamp}`;
    }
    return `${base}/static-images/AvatarPorDefecto.png`;
  }

  async listPatientsForAgenda(): Promise<PatientUserResponseDto[]> {
    const rows = await this.dataSource.query<
      Record<string, string | number | null>[]
    >(
      `
        SELECT id2, id, name, role, team, status, age, avatar, email, tipoentidad
        FROM dbo.[Lite Cnsta ListaPaciente]
        ORDER BY name ASC
      `,
    );

    return rows.map((row) => {
      const fileName = row.avatar != null ? String(row.avatar) : null;
      const baseName = fileName
        ? path.basename(fileName.replace(/\\/g, '/'))
        : null;
      return {
        id2: String(row.id2 ?? ''),
        id: String(row.id ?? ''),
        name: String(row.name ?? ''),
        role: String(row.role ?? ''),
        team: String(row.team ?? ''),
        status: String(row.status ?? ''),
        age: row.age != null ? Number(row.age) : null,
        avatar: this.resolveAvatarUrl(baseName),
        email: row.email != null ? String(row.email) : null,
        tipoentidad: String(row.tipoentidad ?? 'N/A'),
      };
    });
  }
}
