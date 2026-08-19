import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * Vistas/tablas de catálogo 1888 (mismo mapa que Relacionador RdaConsultaExternaRoutes).
 * Solo se permiten estas claves en la API (evita inyección SQL).
 */
const CATALOGO_1888_VISTAS: Record<string, string> = {
  EntornoAtencion: '[Cnsta Entorno de atencion 1888]',
  TipoAlergia: '[Cnsta Tipo de alergia 1888]',
  ParentescoFamiliar: '[Cnsta Parentesco familiar RDA 1888]',
  TipoDiagnosticoPrincipal: '[Cnsta Tipo diagnostico principal 1888]',
  UnidadMedidaDosis: '[Cnsta Unidad medida dosis 1888]',
  ViaAdministracionMedicamento: '[Cnsta Via administracion medicamento 1888]',
  UnidadTiempoDuracion: '[Cnsta Unidad tiempo duracion 1888]',
  UnidadTiempoFrecuencia: '[Cnsta Unidad tiempo frecuencia 1888]',
  FinalidadTecnologiaSalud: '[Cnsta Finalidad tecnologia salud 1888]',
  OtraTecnologiaCategoria: '[Cnsta Otra tecnologia categoria 1888]',
  AlcanceIncapacidad: '[Cnsta Alcance incapacidad 1888]',
};

export type Catalogo1888Row = {
  Codigo: string | number | null;
  Descripcion: string | null;
  IdEstado: number | null;
};

@Injectable()
export class RdaService {
  constructor(private readonly dataSource: DataSource) {}

  overview() {
    return {
      proyecto: 'CeereLite (Nuevo_CeereLIte)',
      normativa: 'Resolución 1888 / RDA MinSalud',
      modulos: [
        {
          id: 'paciente',
          nombre: 'RDA Paciente',
          descripcion:
            'Historia clínica electrónica del paciente; bundles FHIR e IHCE.',
          referencia:
            'Relacionador: RdaPacienteRoutes.js — POST /EvaluacionEntidadRDA/, hijos, FhirBundle, EnviarIHCE',
        },
        {
          id: 'consulta-externa',
          nombre: 'RDACE — Consulta externa',
          descripcion:
            'Atención ambulatoria; prescripciones, diagnósticos relacionados, envío IHCE.',
          referencia:
            'Relacionador: RdaConsultaExternaRoutes.js — POST /EvaluacionEntidadRDACE/, catálogos, PDF, EnviarIHCE',
        },
        {
          id: 'envio-masivo',
          nombre: 'Envío masivo RDA',
          referencia: 'Relacionador: RdaEnvioMasivoRoutes.js',
        },
        {
          id: 'login-ihce',
          nombre: 'RdaLogin (token / profesional / organización IHCE)',
          referencia: 'Relacionador: RdaLoginRoutes.js',
        },
      ],
      apiEsteBackend: {
        catalogos1888:
          'GET /api/v1/rda/catalog/egreso-remision | factor-riesgo | tipo-tecnologia-salud | 1888/:clave',
        ui: 'Los catálogos se consumen desde la pantalla «HC / Evolución» junto a la nota clínica.',
        nota:
          'Persistencia RDA/RDACE (POST evaluación, FHIR, IHCE) se puede portar desde NUEVO_RELACIONADOR.',
      },
    };
  }

  listCatalogoEgresoRemision(q?: string): Promise<Catalogo1888Row[]> {
    return this.buscarCatalogoFijo(
      '[Cnsta Egreso y Remision 1888]',
      q,
    ) as Promise<Catalogo1888Row[]>;
  }

  listCatalogoFactorRiesgo(q?: string): Promise<Catalogo1888Row[]> {
    return this.buscarCatalogoFijo(
      '[Cnsta Factor De Riesgo 1888]',
      q,
    ) as Promise<Catalogo1888Row[]>;
  }

  listCatalogoTipoTecnologiaSalud(q?: string): Promise<Catalogo1888Row[]> {
    return this.buscarCatalogoFijo(
      '[Cnsta Tipo de tecnología en salud 1888]',
      q,
    ) as Promise<Catalogo1888Row[]>;
  }

  listCatalogo1888(clave: string, q?: string): Promise<Catalogo1888Row[]> {
    const vista = CATALOGO_1888_VISTAS[clave];
    if (!vista) {
      throw new NotFoundException({
        error: 'Catálogo 1888 no reconocido',
        clave,
        permitidas: Object.keys(CATALOGO_1888_VISTAS),
      });
    }
    return this.buscarCatalogoFijo(vista, q) as Promise<Catalogo1888Row[]>;
  }

  clavesCatalogo1888(): string[] {
    return Object.keys(CATALOGO_1888_VISTAS);
  }

  private async buscarCatalogoFijo(
    vista: string,
    q?: string,
  ): Promise<Record<string, unknown>[]> {
    const term = q?.trim();
    if (!term) {
      return this.dataSource.query(
        `SELECT Codigo, Descripcion, IdEstado FROM ${vista}`,
      );
    }
    return this.dataSource.query(
      `SELECT Codigo, Descripcion, IdEstado FROM ${vista}
       WHERE Descripcion LIKE @0 OR CAST(Codigo AS NVARCHAR(50)) LIKE @0`,
      [`%${term}%`],
    );
  }
}
