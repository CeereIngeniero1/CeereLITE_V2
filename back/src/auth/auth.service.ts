import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { LoginDto } from './dto/login.dto';

export type AuthUserRow = {
  username: string;
  documentoEntidad: string;
  nombreUsuario: string;
  userLevel: number;
};

export type JwtPayload = AuthUserRow;

@Injectable()
export class AuthService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly jwtService: JwtService,
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
    const userLevel = row.idNivel;
    if (![1, 2, 3].includes(userLevel)) {
      throw new UnauthorizedException('Nivel de usuario no reconocido');
    }

    const payload: JwtPayload = {
      username: row.username,
      documentoEntidad: row.documentoEntidad,
      nombreUsuario: row.nombreUsuario,
      userLevel,
    };

    const token = await this.jwtService.signAsync(payload);

    return {
      token,
      userLevel,
      documentoEntidad: row.documentoEntidad,
      nombreUsuario: row.nombreUsuario,
    };
  }
}
