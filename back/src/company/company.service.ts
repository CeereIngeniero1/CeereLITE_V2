import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  CompanyDetailDto,
  CompanyListItemDto,
} from './dto/company-response.dto';

@Injectable()
export class CompanyService {
  constructor(private readonly dataSource: DataSource) {}

  async list(): Promise<CompanyListItemDto[]> {
    const rows = await this.dataSource.query<
      { DocumentoEmpresa: string; NombreComercialEmpresa: string }[]
    >(`
      SELECT DocumentoEmpresa,
             NombreComercialEmpresa
      FROM dbo.[Lite Cnsta Empresa]
    `);

    if (!rows.length) {
      throw new NotFoundException('No se encontró información de la empresa');
    }

    return rows.map((r) => ({
      documentoEmpresa: r.DocumentoEmpresa,
      nombreComercialEmpresa: r.NombreComercialEmpresa,
    }));
  }

  async findByDocument(docEmpresa: string): Promise<CompanyDetailDto[]> {
    const rows = await this.dataSource.query<
      {
        NombreEmpresa: string;
        DocumentoEmpresa: string;
        DireccionEmpresa: string | null;
        TelefonoEmpresa: string | null;
        CorreoEmpresa: string | null;
      }[]
    >(
      `
      SELECT NombreEmpresa,
             DocumentoEmpresa,
             DireccionEmpresa,
             TelefonoEmpresa,
             CorreoEmpresa
      FROM dbo.[Lite Cnsta Empresa]
      WHERE DocumentoEmpresa = @0
    `,
      [docEmpresa],
    );

    if (!rows.length) {
      throw new NotFoundException('No se encontró información de la empresa');
    }

    return rows.map((r) => ({
      nombreEmpresa: r.NombreEmpresa,
      documentoEmpresa: r.DocumentoEmpresa,
      direccionEmpresa: r.DireccionEmpresa,
      telefonoEmpresa: r.TelefonoEmpresa,
      correoEmpresa: r.CorreoEmpresa,
    }));
  }
}
