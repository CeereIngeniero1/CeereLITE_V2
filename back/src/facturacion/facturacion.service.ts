import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

export type PresupuestoTratamientoDto = {
  idTratamiento: number;
  codigo: string;
  descripcion: string;
  idSubcapitulo: number | null;
};

export type PresupuestoTarifaDto = {
  idTipoTarifa: number;
  nombre: string;
};

export type PresupuestoItemDto = {
  codigo: string;
  descripcion: string;
  precio: number;
  ivaPct: number;
  descPct: number;
};

export type PresupuestoProfesionalDto = {
  documentoProfesional: string;
  nombreProfesional: string;
};

export type PresupuestoSiguienteNroDto = {
  numero: string;
};

const EMPRESA_CATALOGO_GLOBAL = '00000000-0';

function requireEmpresa(documentoEmpresa?: string): string {
  const doc = String(documentoEmpresa ?? '').trim();
  if (!doc) {
    throw new BadRequestException('Indique la empresa de trabajo.');
  }
  return doc;
}

function candidatosEmpresa(documentoEmpresa: string): string[] {
  const doc = String(documentoEmpresa ?? '').trim();
  const out = [doc];
  const dash = doc.lastIndexOf('-');
  if (dash > 0) {
    const padre = doc.slice(0, dash).trim();
    if (padre && !out.includes(padre)) out.push(padre);
  }
  if (!out.includes(EMPRESA_CATALOGO_GLOBAL)) out.push(EMPRESA_CATALOGO_GLOBAL);
  return out;
}

@Injectable()
export class FacturacionService {
  constructor(private readonly dataSource: DataSource) {}

  private async resolveDocumentoCatalogo(documentoEmpresa: string): Promise<string> {
    const candidatos = candidatosEmpresa(documentoEmpresa);
    const rows = await this.dataSource.query<
      { DocumentoEmpresa: string; n: number }[]
    >(
      `
      SELECT DocumentoEmpresa, COUNT(*) AS n
      FROM dbo.[Lite Cnsta PresupuestoTratamiento]
      WHERE LTRIM(RTRIM(DocumentoEmpresa)) IN (${candidatos.map((_, i) => `@${i}`).join(', ')})
      GROUP BY DocumentoEmpresa
      `,
      candidatos,
    );
    const counts = new Map(
      rows.map((r) => [String(r.DocumentoEmpresa ?? '').trim(), Number(r.n) || 0]),
    );
    for (const c of candidatos) {
      if ((counts.get(c) ?? 0) > 0) return c;
    }
    return documentoEmpresa;
  }

  async listTratamientos(
    documentoEmpresa?: string,
  ): Promise<PresupuestoTratamientoDto[]> {
    const empresa = await this.resolveDocumentoCatalogo(
      requireEmpresa(documentoEmpresa),
    );
    const rows = await this.dataSource.query<
      {
        IdTratamiento: number;
        CodigoTratamiento: string | null;
        DescripcionTratamiento: string | null;
        IdSubcapitulo: number | null;
      }[]
    >(
      `
      SELECT IdTratamiento,
             CodigoTratamiento,
             DescripcionTratamiento,
             IdSubcapitulo
      FROM dbo.[Lite Cnsta PresupuestoTratamiento]
      WHERE LTRIM(RTRIM(DocumentoEmpresa)) = LTRIM(RTRIM(@0))
      ORDER BY DescripcionTratamiento
      `,
      [empresa],
    );
    return rows.map((r) => ({
      idTratamiento: Number(r.IdTratamiento),
      codigo: String(r.CodigoTratamiento ?? '').trim(),
      descripcion: String(r.DescripcionTratamiento ?? '').trim(),
      idSubcapitulo:
        r.IdSubcapitulo == null ? null : Number(r.IdSubcapitulo),
    }));
  }

  async listTarifas(documentoEmpresa?: string): Promise<PresupuestoTarifaDto[]> {
    const empresa = await this.resolveDocumentoCatalogo(
      requireEmpresa(documentoEmpresa),
    );
    const rows = await this.dataSource.query<
      { IdTipoTarifa: number; NombreTarifa: string | null }[]
    >(
      `
      SELECT IdTipoTarifa, NombreTarifa
      FROM dbo.[Lite Cnsta PresupuestoTipoTarifa]
      WHERE LTRIM(RTRIM(DocumentoEmpresa)) = LTRIM(RTRIM(@0))
      ORDER BY NombreTarifa
      `,
      [empresa],
    );
    return rows.map((r) => ({
      idTipoTarifa: Number(r.IdTipoTarifa),
      nombre: String(r.NombreTarifa ?? '').trim() || `Tarifa ${r.IdTipoTarifa}`,
    }));
  }

  async siguienteNumero(
    documentoEmpresa?: string,
  ): Promise<PresupuestoSiguienteNroDto> {
    const sesion = requireEmpresa(documentoEmpresa);
    const catalogo = await this.resolveDocumentoCatalogo(sesion);
    const rows = await this.dataSource.query<{ MaxNro: number | null }[]>(
      `
      SELECT MAX(Nro) AS MaxNro
      FROM dbo.[Lite Cnsta PresupuestoNro]
      WHERE LTRIM(RTRIM(ISNULL(DocumentoEmpresa, N''))) IN (@0, @1)
         OR LTRIM(RTRIM(ISNULL(DocumentoSede, N''))) IN (@0, @1)
      `,
      [sesion, catalogo],
    );
    const max = Number(rows[0]?.MaxNro);
    const siguiente = Number.isFinite(max) && max > 0 ? max + 1 : 1;
    return { numero: String(siguiente) };
  }

  async listItems(
    idTratamiento: number,
    documentoEmpresa?: string,
    idTipoTarifaRaw?: string,
  ): Promise<PresupuestoItemDto[]> {
    requireEmpresa(documentoEmpresa);
    const idTipoTarifa = Number(idTipoTarifaRaw);
    const tarifa = Number.isFinite(idTipoTarifa) ? idTipoTarifa : 0;
    const rows = await this.dataSource.query<
      {
        CodigoObjeto: string | null;
        DescripcionObjeto: string | null;
        Orden: number | null;
        Precio: number | null;
        IvaPct: number | null;
        DescPct: number | null;
      }[]
    >(
      `
      SELECT i.CodigoObjeto,
             i.DescripcionObjeto,
             i.Orden,
             p.Precio,
             p.IvaPct,
             p.DescPct
      FROM dbo.[Lite Cnsta PresupuestoTratamientoItems] AS i
      LEFT JOIN dbo.[Lite Cnsta PresupuestoPrecioVenta] AS p
        ON i.CodigoObjeto = p.CodigoObjeto
       AND LTRIM(RTRIM(i.DocumentoEmpresa)) = LTRIM(RTRIM(p.DocumentoEmpresa))
       AND p.IdTipoTarifa = @1
      WHERE i.IdTratamiento = @0
      ORDER BY i.Orden, i.DescripcionObjeto, i.CodigoObjeto
      `,
      [idTratamiento, tarifa],
    );
    return rows.map((r) => ({
      codigo: String(r.CodigoObjeto ?? '').trim(),
      descripcion: String(r.DescripcionObjeto ?? '').trim(),
      precio: Number(r.Precio ?? 0) || 0,
      ivaPct: Number(r.IvaPct ?? 0) || 0,
      descPct: Number(r.DescPct ?? 0) || 0,
    }));
  }

  async listProfesionales(
    idTratamiento: number,
    documentoEmpresa?: string,
  ): Promise<PresupuestoProfesionalDto[]> {
    const empresa = await this.resolveDocumentoCatalogo(
      requireEmpresa(documentoEmpresa),
    );
    const rows = await this.dataSource.query<
      {
        DocumentoProfesional: string | null;
        NombreProfesional: string | null;
      }[]
    >(
      `
      SELECT DISTINCT DocumentoProfesional, NombreProfesional
      FROM dbo.[Lite Cnsta PresupuestoProfesionalTratamiento]
      WHERE IdTratamiento = @0
        AND LTRIM(RTRIM(DocumentoEmpresa)) = LTRIM(RTRIM(@1))
      ORDER BY NombreProfesional
      `,
      [idTratamiento, empresa],
    );
    return rows
      .map((r) => ({
        documentoProfesional: String(r.DocumentoProfesional ?? '').trim(),
        nombreProfesional: String(r.NombreProfesional ?? '').trim(),
      }))
      .filter((r) => r.documentoProfesional);
  }
}
