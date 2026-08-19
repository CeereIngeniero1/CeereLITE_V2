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
      SELECT [Documento Empresa] AS DocumentoEmpresa,
             [Nombre Comercial Empresa] AS NombreComercialEmpresa
      FROM Empresa
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
      SELECT em.[Nombre Comercial Empresa] AS NombreEmpresa,
             em.[Documento Empresa] AS DocumentoEmpresa,
             em3.[Dirección EmpresaIII] AS DireccionEmpresa,
             em3.[Teléfono No 1 EmpresaIII] AS TelefonoEmpresa,
             em3.[E-mail 1 EmpresaIII] AS CorreoEmpresa
      FROM Empresa AS em
      LEFT JOIN EmpresaIII AS em3 ON em.[Documento Empresa] = em3.[Documento Empresa]
      WHERE em.[Documento Empresa] = @0
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
