import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { JwtPayload } from '../auth/auth.service';
import { CreateEvaluacionDto } from './dto/create-evaluacion.dto';
import { RegistrarRipsDto } from './dto/registrar-rips.dto';
import { UpdateEvaluacionDiagDto } from './dto/update-evaluacion-diag.dto';
import { UpdatePacienteDemografiaDto } from './dto/update-paciente-demografia.dto';
import type {
  CatalogoPacienteItemDto,
  EvolucionSnapshotDto,
  PacienteDatosResponseDto,
  PacienteDemografiaDto,
} from './paciente-demografia.types';

export type EvolucionListItemDto = {
  idEvolucion: number;
  pacienteEvolucion: string;
  fechaEvolucion: string;
  estado: string;
  hora: string;
};

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
] as const;

type PacienteCatalogSegment = (typeof PACIENTE_CATALOG_SEGMENTS)[number];

@Injectable()
export class EvolucionService {
  constructor(private readonly dataSource: DataSource) {}

  async listEvolucionesMedicas(
    documentoEntidad: string,
  ): Promise<EvolucionListItemDto[]> {
    const rows = await this.dataSource.query<
      Record<string, string | number | Date | null>[]
    >(
      `
      SELECT eve.[Id Evaluación Entidad],
             en.[Primer Nombre Entidad] + ' ' + en.[Primer Apellido Entidad] AS [Nombre Paciente],
             eve.[Fecha Evaluación Entidad],
             CASE
               WHEN eve.[Id Estado] = 7 THEN 'Cerrado'
               WHEN eve.[Id Estado] = 8 THEN 'Abierto'
               ELSE ''
             END AS [Estado],
             FORMAT(eve.[Fecha Evaluación Entidad], 'hh:mm tt') AS [Hora]
      FROM [Evaluación Entidad] AS eve
      INNER JOIN Entidad AS en ON eve.[Documento Entidad] = en.[Documento Entidad]
      WHERE eve.[Id Tipo de Evaluación] = 1
        AND eve.[Documento Entidad] = @0
      ORDER BY eve.[Fecha Evaluación Entidad] DESC
    `,
      [documentoEntidad],
    );

    return rows.map((row) => ({
      idEvolucion: Number(row['Id Evaluación Entidad']),
      pacienteEvolucion: String(row['Nombre Paciente'] ?? ''),
      fechaEvolucion:
        row['Fecha Evaluación Entidad'] instanceof Date
          ? (row['Fecha Evaluación Entidad'] as Date).toISOString().split('T')[0]
          : String(row['Fecha Evaluación Entidad'] ?? ''),
      estado: String(row['Estado'] ?? ''),
      hora: String(row['Hora'] ?? ''),
    }));
  }

  async getEvolucionMedicaById(idEvaluacion: number): Promise<unknown[]> {
    const rows = await this.dataSource.query(
      `
      SELECT eve.[Id Evaluación Entidad], tpe.[Tipo de Evaluación], eve.[Id Tipo de Evaluación], enpro.[Nombre Completo Entidad] AS [Nombre Profesional],
             [Fecha Evaluación Entidad], en.[Nombre Completo Entidad] AS [Nombre Paciente],
             eve.[Documento Entidad] AS [Documento Paciente], eve.[Dirección Domicilio], eve.[Id Ciudad], Ciudad.Ciudad,
             eve.[Teléfono Domicilio], eve.[Fecha Nacimiento], eve.[Edad Entidad Evaluación Entidad] AS [Edad Paciente],
             eve.[Id Unidad de Medida Edad], ume.[Descripción Unidad de Medida Edad] AS [Unidad Medida], eve.[Id Sexo], Sexo.[Descripción Sexo],
             eve.[Id Estado Civil], ec.[Estado Civil], eve.[Id Ocupación], oc.Ocupación, eve.[Documento Aseguradora],
             enase.[Nombre Completo Entidad] AS [Nombre Aseguradora], eve.[Id Tipo de Afiliado], tpa.[Tipo de Afiliado],
             eve.[Acompañante Evaluación Entidad] AS [Acompanante],
             eve.[Id Parentesco],
             pa.Parentesco AS [Parentesco Acompanante],
             eve.[Teléfono Acompañante],
             eve.[Responsable Evaluación Entidad] AS [Responsable], eve.[Id Parentesco Responsable], pr.Parentesco AS [Parentesco Responsable],
             eve.[Teléfono Responsable], eve.[Diagnóstico General Evaluación Entidad] AS [Diagnostico General],
             eve.[Diagnóstico Específico Evaluación Entidad] AS [Diagnostico especifico], eve.[Firma Evaluación Entidad],
             everips.[Id Acto Quirúrgico],
             everips.[Id Tipo de Rips], tpr.[Tipo Rips], everips.[Codigo Rips], ob.[Descripción Objeto] AS [Nombre Procedimiento],
             everips.[Codigo Rips2], ob2.[Descripción Objeto] AS [Nombre Procedimiento 2], everips.[Diagnostico Rips],
             obd.[Descripción Objeto] AS [Nombre Diagnóstico], everips.[Diagnostico Rips2],
             obd2.[Descripción Objeto] AS [Nombre Diagnostico 2], everips.[Documento Tipo Rips] AS [Documento Entidad],
             ent.[Nombre Completo Entidad] AS [Nombre Entidad], everips.[Id Modalidad Atencion], rma.[Nombre Modalidad Atencion] AS [Modalidad Atencion],
             everips.[Id Grupo Servicios], rgs.[Nombre Grupo Servicios] AS [Grupo Servicios], everips.[Id Servicios],
             rs.[Nombre Servicios] AS [Servicios], everips.[Id Finalidad Consulta], fnc.[Descripción Finalidad Consulta] AS [Finalidad Consulta],
             everips.[Id Causa Externa], ce.[Descripción Causa Externa] AS [Causa Externa],
             everips.[Id Tipo de Diagnóstico Principal], tpd.[Descripción Tipo de Diagnóstico Principal] AS [Tipo Diagnostico Principal],
             everips.[Id Via Ingreso Usuario], rvi.[Nombre Via Ingreso Usuario] AS [Via Ingreso],
             fnp.[Descripción Finalidad del Procedimiento] AS [Finalidad Procedimiento]
      FROM [Evaluación Entidad] AS eve
      LEFT JOIN [Tipo de Evaluación] AS tpe ON eve.[Id Tipo de Evaluación] = tpe.[Id Tipo de Evaluación]
      LEFT JOIN Entidad AS en ON eve.[Documento Entidad] = en.[Documento Entidad]
      LEFT JOIN Entidad AS enpro ON eve.[Documento Profesional] = enpro.[Documento Entidad]
      LEFT JOIN Ciudad ON eve.[Id Ciudad] = Ciudad.[Id Ciudad]
      LEFT JOIN [Unidad de Medida Edad] AS ume ON eve.[Id Unidad de Medida Edad] = ume.[Id Unidad de Medida Edad]
      LEFT JOIN Sexo ON eve.[Id Sexo] = Sexo.[Id Sexo]
      LEFT JOIN [Estado Civil] AS ec ON eve.[Id Estado Civil] = ec.[Id Estado Civil]
      LEFT JOIN Ocupación AS oc ON eve.[Id Ocupación] = oc.[Id Ocupación]
      LEFT JOIN Entidad AS enase ON eve.[Documento Aseguradora] = enase.[Documento Entidad]
      LEFT JOIN [Tipo de Afiliado] AS tpa ON eve.[Id Tipo de Afiliado] = tpa.[Id Tipo de Afiliado]
      LEFT JOIN Parentesco AS pa ON eve.[Id Parentesco] = pa.[Id Parentesco]
      LEFT JOIN Parentesco AS pr ON eve.[Id Parentesco Responsable] = pr.[Id Parentesco]
      LEFT JOIN [Evaluación Entidad Rips] AS everips ON eve.[Id Evaluación Entidad] = everips.[Id Evaluación Entidad]
      LEFT JOIN [Tipo Rips] AS tpr ON everips.[Id Tipo de Rips] = tpr.[Id Tipo Rips]
      LEFT JOIN Objeto AS ob ON everips.[Codigo Rips] = ob.[Código Objeto]
      LEFT JOIN Objeto AS ob2 ON everips.[Codigo Rips2] = ob2.[Código Objeto]
      LEFT JOIN Objeto AS obd ON everips.[Diagnostico Rips] = obd.[Código Objeto]
      LEFT JOIN Objeto AS obd2 ON everips.[Diagnostico Rips2] = obd2.[Código Objeto]
      LEFT JOIN Entidad AS ent ON everips.[Documento Tipo Rips] = ent.[Documento Entidad]
      LEFT JOIN [RIPS Modalidad Atención] AS rma ON everips.[Id Modalidad Atencion] = rma.[Id Modalidad Atencion]
      LEFT JOIN [RIPS Grupo Servicios] AS rgs ON everips.[Id Grupo Servicios] = rgs.[Id Grupo Servicios]
      LEFT JOIN [RIPS Servicios] AS rs ON everips.[Id Servicios] = rs.[Id Servicios]
      LEFT JOIN [Finalidad Consulta] AS fnc ON everips.[Id Finalidad Consulta] = fnc.[Id Finalidad Consulta]
      LEFT JOIN [Causa Externa] AS ce ON everips.[Id Causa Externa] = ce.[Id Causa Externa]
      LEFT JOIN [Tipo de Diagnóstico Principal] AS tpd ON everips.[Id Tipo de Diagnóstico Principal] = tpd.[Id Tipo de Diagnóstico Principal]
      LEFT JOIN [RIPS Via Ingreso Usuario] AS rvi ON everips.[Id Via Ingreso Usuario] = rvi.[Id Via Ingreso Usuario]
      LEFT JOIN [Finalidad del Procedimiento] AS fnp ON everips.[Id Finalidad Consulta] = fnp.[Id Finalidad del Procedimiento]
      WHERE eve.[Id Tipo de Evaluación] = 1 AND eve.[Id Evaluación Entidad] = @0
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
      SELECT en.[Nombre Completo Entidad] AS [Nombre Paciente],
             en.[Documento Entidad] AS [Documento Paciente],
             en.[Id Tipo de Documento] AS [Id Tipo Documento],
             td.[Descripción Tipo de Documento] AS [Tipo Documento],
             en.[Primer Apellido Entidad] AS [Primer Apellido Paciente],
             en.[Segundo Apellido Entidad] AS [Segundo Apellido Paciente],
             en.[Primer Nombre Entidad] AS [Primer Nombre Paciente],
             en.[Segundo Nombre Entidad] AS [Segundo Nombre Paciente],
             en2.[Dirección EntidadII] AS [Direccion Paciente],
             Ciudad.[Id Ciudad],
             Ciudad.Ciudad,
             en2.[Teléfono Celular EntidadII] AS [Celular Paciente],
             CONVERT(DATE, en3.[Fecha Nacimiento EntidadIII], 101) AS [Fecha Nacimiento Paciente],
             en3.[Edad EntidadIII] AS [Edad Paciente],
             en3.[Id Unidad de Medida Edad],
             ume.[Descripción Unidad de Medida Edad],
             Sexo.[Id Sexo],
             Sexo.[Descripción Sexo] AS Sexo,
             en3.[Id Estado Civil],
             esc.[Estado Civil],
             ocu.[Id Ocupación],
             ocu.Ocupación,
             en24.[Id Tipo de Afiliado],
             tpa.[Descripción Tipo de Afiliado],
             en24.[Documento Entidad Prepago] AS [Documento EPS],
             en3.[Acompañante EntidadIII] AS [Nombre Responsable],
             en3.[Id Parentesco],
             en3.[Tel Acompañante EntidadIII] AS [Teléfono Responsable]
      FROM Entidad AS en
      LEFT JOIN [Tipo de Documento] AS td
             ON en.[Id Tipo de Documento] = td.[Id Tipo de Documento]
      LEFT JOIN EntidadII AS en2 ON en.[Documento Entidad] = en2.[Documento Entidad]
      LEFT JOIN EntidadIII AS en3 ON en.[Documento Entidad] = en3.[Documento Entidad]
      INNER JOIN Ciudad ON en2.[Id Ciudad] = Ciudad.[Id Ciudad]
      LEFT JOIN Sexo ON en3.[Id Sexo] = Sexo.[Id Sexo]
      LEFT JOIN [Estado Civil] AS esc ON en3.[Id Estado Civil] = esc.[Id Estado Civil]
      LEFT JOIN EntidadVI AS en6 ON en.[Documento Entidad] = en6.[Documento Entidad]
      INNER JOIN Ocupación AS ocu ON en6.[Id Ocupación] = ocu.[Id Ocupación]
      LEFT JOIN EntidadXXIV AS en24 ON en.[Documento Entidad] = en24.[Documento Entidad]
      INNER JOIN [Tipo de Afiliado] AS tpa ON en24.[Id Tipo de Afiliado] = tpa.[Id Tipo de Afiliado]
      LEFT JOIN Entidad AS enr ON en3.[Documento Responsable] = enr.[Documento Entidad]
      LEFT JOIN [Unidad de Medida Edad] AS ume ON en3.[Id Unidad de Medida Edad] = ume.[Id Unidad de Medida Edad]
      WHERE en.[Documento Entidad] = @0
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

    let demografia: PacienteDemografiaDto | null = null;
    if (rows.length > 0) {
      const row = rows[0];
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

      demografia = {
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
      };
    }

    const evolucionSnapshot = await this.getEvolucionSnapshot(doc);
    return { demografia, evolucionSnapshot };
  }

  private async getEvolucionSnapshot(
    documento: string,
  ): Promise<EvolucionSnapshotDto | null> {
    const rows = await this.dataSource.query<
      Record<string, string | number | null>[]
    >(
      `
      SELECT Ciudad.[Id Ciudad],
             en3.[Id Estado Civil],
             en24.[Documento Entidad Prepago] AS [Documento EPS],
             en24.[Id Tipo de Afiliado],
             en3.[Id Parentesco],
             en3.[Acompañante EntidadIII] AS [Nombre Responsable],
             en3.[Tel Acompañante EntidadIII] AS [Teléfono Responsable],
             en3.[Id Unidad de Medida Edad],
             ume.[Descripción Unidad de Medida Edad]
      FROM Entidad AS en
      LEFT JOIN EntidadII AS en2 ON en.[Documento Entidad] = en2.[Documento Entidad]
      LEFT JOIN EntidadIII AS en3 ON en.[Documento Entidad] = en3.[Documento Entidad]
      LEFT JOIN Ciudad ON en2.[Id Ciudad] = Ciudad.[Id Ciudad]
      LEFT JOIN EntidadXXIV AS en24 ON en.[Documento Entidad] = en24.[Documento Entidad]
      LEFT JOIN [Unidad de Medida Edad] AS ume
             ON en3.[Id Unidad de Medida Edad] = ume.[Id Unidad de Medida Edad]
      WHERE en.[Documento Entidad] = @0
    `,
      [documento],
    );
    if (!rows.length) return null;
    const row = rows[0];
    return {
      idListaCiudad: numOrNull(row['Id Ciudad']),
      idEstadoCivil: numOrNull(row['Id Estado Civil']),
      documentoAseguradora: strOrNull(row['Documento EPS']),
      idTipoAfiliado: numOrNull(row['Id Tipo de Afiliado']),
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
      default:
        return [];
    }
  }

  async listTiposEvaluacion(): Promise<TipoEvaluacionDto[]> {
    const rows = await this.dataSource.query<
      Record<string, string | number | null>[]
    >(
      `SELECT [Id Tipo de Evaluación], [Tipo de Evaluación]
       FROM [Tipo de Evaluación]
       WHERE [Id Estado] = 7`,
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
      `SELECT TOP 1 [Documento Empresa] AS DocumentoEmpresa FROM Empresa`,
    );
    if (!rows.length) {
      throw new NotFoundException('No hay empresa en catálogo');
    }
    return rows[0].DocumentoEmpresa;
  }

  async createEvaluacionSinRips(
    user: JwtPayload,
    dto: CreateEvaluacionDto,
  ): Promise<{ idEvaluacion: number }> {
    const docEmpresa = await this.resolveDocumentoEmpresa(dto.documentoEmpresa);
    const tipo = dto.idTipoEvaluacion ?? 1;
    const docUsuario = user.documentoEntidad;
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
      strOrNullIfEmpty(dto.documentoAseguradora),
      optionalIntFk(dto.idTipoAfiliado),
      strOrNullIfEmpty(dto.responsableNombre),
      optionalIntFk(dto.idParentescoResponsable),
      strOrNullIfEmpty(dto.telefonoResponsable),
      docUsuario,
      docEmpresa,
      docUsuario,
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
         [Sincronizado], [PreguntarControl], [Rips])
      OUTPUT INSERTED.[Id Evaluación Entidad] INTO @InsertedIds(id)
      VALUES
        (@0, SYSUTCDATETIME(), @1, @2, @3, @4, @5, @6, @7, 0, @8, @9, @10, @11, @12, @13, 8, @14, @15, @16, @17, @18, @19, @20, @21, @22, @23, 1, 0, 0, 0, 0);

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
      params.push(dto.diagnosticoGeneral);
    }
    if (dto.diagnosticoEspecifico !== undefined) {
      setParts.push(
        `[Diagnóstico Específico Evaluación Entidad] = @${params.length}`,
      );
      params.push(dto.diagnosticoEspecifico);
    }
    const idPlaceholder = `@${params.length}`;
    params.push(idEvaluacion);

    await this.dataSource.query(
      `UPDATE [Evaluación Entidad]
       SET ${setParts.join(', ')}
       WHERE [Id Evaluación Entidad] = ${idPlaceholder} AND [Id Tipo de Evaluación] = 1`,
      params,
    );
  }

  private async getEvolucionEstadoById(
    idEvaluacion: number,
  ): Promise<number | null> {
    const rows = await this.dataSource.query<{ estado: number | null }[]>(
      `SELECT [Id Estado] AS estado
       FROM [Evaluación Entidad]
       WHERE [Id Evaluación Entidad] = @0 AND [Id Tipo de Evaluación] = 1`,
      [idEvaluacion],
    );
    if (!rows.length) {
      return null;
    }
    return rows[0].estado != null ? Number(rows[0].estado) : null;
  }

  private async assertEvolucionMedicaExiste(idEvaluacion: number): Promise<void> {
    const estado = await this.getEvolucionEstadoById(idEvaluacion);
    if (estado == null) {
      throw new NotFoundException('Evolución no encontrada');
    }
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

  async listRipsPorEvaluacion(idEvaluacion: number): Promise<unknown[]> {
    await this.assertEvolucionMedicaExiste(idEvaluacion);
    return this.dataSource.query(
      `SELECT *
       FROM [Evaluación Entidad Rips]
       WHERE [Id Evaluación Entidad] = @0
       ORDER BY [Id Evaluación Entidad Rips]`,
      [idEvaluacion],
    );
  }

  async registrarRips(
    idEvaluacion: number,
    dto: RegistrarRipsDto,
  ): Promise<{ ok: true }> {
    await this.assertEvolucionMedicaEditable(idEvaluacion);

    if (dto.actoQuirurgico === 1) {
      if (dto.idCausaExterna == null || dto.idTipoDiagnosticoPrincipal == null) {
        throw new BadRequestException(
          'Para acto consulta (AC) indique causa externa y tipo de diagnóstico principal',
        );
      }
    } else {
      if (dto.idViaIngresoUsuario == null) {
        throw new BadRequestException(
          'Para acto procedimiento (AP) indique vía de ingreso del usuario',
        );
      }
    }

    const cod2 =
      dto.codigoRips2 != null && String(dto.codigoRips2).trim() !== ''
        ? String(dto.codigoRips2).trim()
        : null;
    const dx2 =
      dto.diagnosticoRips2 != null && String(dto.diagnosticoRips2).trim() !== ''
        ? String(dto.diagnosticoRips2).trim()
        : null;

    await this.dataSource.transaction(async (em) => {
      if (dto.actoQuirurgico === 1) {
        await em.query(
          `
          INSERT INTO [Evaluación Entidad Rips]
            ([Id Evaluación Entidad], [Codigo Rips], [Codigo Rips2], [Diagnostico Rips], [Diagnostico Rips2],
             [Id Tipo de Rips], [Documento Tipo Rips], [Id Finalidad Consulta], [Id Causa Externa],
             [Id Tipo de Diagnóstico Principal], [Id Acto Quirúrgico], [Id Modalidad Atencion],
             [Id Grupo Servicios], [Id Servicios])
          VALUES
            (@0, @1, @2, @3, @4, @5, @6, @7, @8, @9, 1, @10, @11, @12)
        `,
          [
            idEvaluacion,
            dto.codigoRips.trim(),
            cod2,
            dto.diagnosticoRips.trim(),
            dx2,
            dto.idTipoRips,
            dto.documentoTipoRips.trim(),
            dto.idFinalidadConsulta,
            dto.idCausaExterna,
            dto.idTipoDiagnosticoPrincipal,
            dto.idModalidadAtencion,
            dto.idGrupoServicios,
            dto.idServicios,
          ],
        );
      } else {
        await em.query(
          `
          INSERT INTO [Evaluación Entidad Rips]
            ([Id Evaluación Entidad], [Codigo Rips], [Codigo Rips2], [Diagnostico Rips], [Diagnostico Rips2],
             [Id Tipo de Rips], [Documento Tipo Rips], [Id Finalidad Consulta], [Id Acto Quirúrgico],
             [Id Modalidad Atencion], [Id Grupo Servicios], [Id Servicios], [Id Via Ingreso Usuario])
          VALUES
            (@0, @1, @2, @3, @4, @5, @6, @7, 2, @8, @9, @10, @11)
        `,
          [
            idEvaluacion,
            dto.codigoRips.trim(),
            cod2,
            dto.diagnosticoRips.trim(),
            dx2,
            dto.idTipoRips,
            dto.documentoTipoRips.trim(),
            dto.idFinalidadConsulta,
            dto.idModalidadAtencion,
            dto.idGrupoServicios,
            dto.idServicios,
            dto.idViaIngresoUsuario,
          ],
        );
      }

      await em.query(
        `UPDATE [Evaluación Entidad] SET [Rips] = 1 WHERE [Id Evaluación Entidad] = @0`,
        [idEvaluacion],
      );
    });

    return { ok: true };
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
       WHERE [Id Evaluación Entidad] = @0 AND [Id Tipo de Evaluación] = 1`,
      [idEvaluacion],
    );
    return { ok: true };
  }

  async catalogoRipsTipoRips() {
    const rows = await this.dataSource.query<Record<string, unknown>[]>(
      `SELECT [Id Tipo Rips], [Tipo Rips], [Código Tipo Rips]
       FROM [Tipo Rips]
       WHERE [Tipo Rips] IS NOT NULL AND [Id Estado] = 7`,
    );
    return rows.map((row) => ({
      idTipoRips: row['Id Tipo Rips'],
      descripcionTipoRips: row['Tipo Rips'],
      codigoTipoRips: row['Código Tipo Rips'],
    }));
  }

  async catalogoRipsEntidadesPorFuncion(idFuncion: number) {
    const rows = await this.dataSource.query<Record<string, unknown>[]>(
      `SELECT en.[Documento Entidad], en.[Nombre Completo Entidad]
       FROM [Función Por Entidad] AS fe
       INNER JOIN Entidad AS en ON fe.[Documento Entidad] = en.[Documento Entidad]
       INNER JOIN Función AS f ON fe.[Id Función] = f.[Id Función]
       WHERE f.[Id Función] = @0
       ORDER BY en.[Nombre Completo Entidad] ASC`,
      [idFuncion],
    );
    return rows.map((row) => ({
      idEntidad: row['Documento Entidad'],
      descripcionEntidad: row['Nombre Completo Entidad'],
    }));
  }

  async catalogoRipsModalidadAtencion() {
    const rows = await this.dataSource.query<Record<string, unknown>[]>(
      `SELECT [Id Modalidad Atencion], [Nombre Modalidad Atencion]
       FROM [RIPS Modalidad Atención]
       WHERE [Id Estado] = 7`,
    );
    return rows.map((row) => ({
      codigoModalidad: row['Id Modalidad Atencion'],
      nombreModalidad: row['Nombre Modalidad Atencion'],
    }));
  }

  async catalogoRipsGrupoServicios() {
    const rows = await this.dataSource.query<Record<string, unknown>[]>(
      `SELECT [Id Grupo Servicios], [Nombre Grupo Servicios]
       FROM [RIPS Grupo Servicios]
       WHERE [Id Estado] = 7`,
    );
    return rows.map((row) => ({
      codigoServicios: row['Id Grupo Servicios'],
      nombreServicios: row['Nombre Grupo Servicios'],
    }));
  }

  async catalogoRipsServicios() {
    const rows = await this.dataSource.query<Record<string, unknown>[]>(
      `SELECT [Id Servicios], [Nombre Servicios]
       FROM [RIPS Servicios]
       WHERE [Id Estado] = 7`,
    );
    return rows.map((row) => ({
      codigoServicios: row['Id Servicios'],
      nombreServicios: row['Nombre Servicios'],
    }));
  }

  async catalogoRipsFinalidadConsulta() {
    const rows = await this.dataSource.query<Record<string, unknown>[]>(
      `SELECT [Id Finalidad Consulta], [Descripción Finalidad Consulta]
       FROM [Finalidad Consulta]
       WHERE ([Id Finalidad Consulta] <> 1) AND ([Id Estado] = 7)`,
    );
    return rows.map((row) => ({
      codigoFinalidad: row['Id Finalidad Consulta'],
      nombreFinalidad: row['Descripción Finalidad Consulta'],
    }));
  }

  async catalogoRipsFinalidadProcedimiento() {
    const rows = await this.dataSource.query<Record<string, unknown>[]>(
      `SELECT [Id Finalidad del Procedimiento], [Descripción Finalidad del Procedimiento]
       FROM [Finalidad del Procedimiento]
       WHERE ([Id Finalidad del Procedimiento] <> 1) AND ([Id Estado] = 7)`,
    );
    return rows.map((row) => ({
      codigoFinalidad: row['Id Finalidad del Procedimiento'],
      nombreFinalidad: row['Descripción Finalidad del Procedimiento'],
    }));
  }

  async catalogoRipsCausaExterna() {
    const rows = await this.dataSource.query<Record<string, unknown>[]>(
      `SELECT [Id Causa Externa], [Descripción Causa Externa]
       FROM [Causa Externa]
       WHERE ([Id Causa Externa] <> 1) AND ([Id Estado] = 7)`,
    );
    return rows.map((row) => ({
      codigoCausa: row['Id Causa Externa'],
      nombreCausa: row['Descripción Causa Externa'],
    }));
  }

  async catalogoRipsTipoDiagnostico() {
    const rows = await this.dataSource.query<Record<string, unknown>[]>(
      `SELECT [Id Tipo de Diagnóstico Principal], [Descripción Tipo de Diagnóstico Principal]
       FROM [Tipo de Diagnóstico Principal]
       WHERE [Id Estado] = 7 AND [Código Tipo de Diagnóstico Principal] IS NOT NULL`,
    );
    return rows.map((row) => ({
      codigoObjeto: row['Id Tipo de Diagnóstico Principal'],
      descripcionObjeto: row['Descripción Tipo de Diagnóstico Principal'],
    }));
  }

  async catalogoRipsViaIngreso() {
    const rows = await this.dataSource.query<Record<string, unknown>[]>(
      `SELECT [Id Via Ingreso Usuario], [Nombre Via Ingreso Usuario]
       FROM [RIPS Via Ingreso Usuario]
       WHERE [Id Estado] = 7`,
    );
    return rows.map((row) => ({
      codigoObjeto: row['Id Via Ingreso Usuario'],
      descripcionObjeto: row['Nombre Via Ingreso Usuario'],
    }));
  }

  /** CUPS por acto (AC/AP). Sin `q` o q corto: TOP 10; con q: búsqueda por código/nombre. */
  async catalogoRipsCupsPorTipo(tipo: string, q?: string) {
    const t = tipo.trim().toUpperCase();
    if (t !== 'AC' && t !== 'AP') {
      throw new BadRequestException('tipo debe ser AC o AP');
    }
    const term = (q ?? '').trim();
    const rows =
      term.length < 2
        ? await this.dataSource.query<Record<string, unknown>[]>(
            `
      SELECT TOP 10 Codigo, Descripcion, Nombre, Tipo
      FROM [Cnsta Relacionador Cups]
      WHERE Tipo = @0
      ORDER BY Nombre
    `,
            [t],
          )
        : await this.dataSource.query<Record<string, unknown>[]>(
            `
      SELECT TOP 100 Codigo, Descripcion, Nombre, Tipo
      FROM [Cnsta Relacionador Cups]
      WHERE Tipo = @0
        AND (Codigo LIKE @1 OR Nombre LIKE @1 OR Descripcion LIKE @1)
      ORDER BY Nombre
    `,
            [t, `%${term}%`],
          );
    return rows.map((row) => ({
      codigo: row.Codigo != null ? String(row.Codigo) : '',
      nombre: row.Nombre != null ? String(row.Nombre) : '',
      descripcion: row.Descripcion != null ? String(row.Descripcion) : null,
      tipo: row.Tipo != null ? String(row.Tipo) : t,
    }));
  }

  /** CIE-10. Sin `q` o q corto: TOP 10; con q: búsqueda (como /apiV3/Cie/:Busqueda). */
  async catalogoRipsCie10(q?: string) {
    const term = (q ?? '').trim();
    const rows =
      term.length < 2
        ? await this.dataSource.query<Record<string, unknown>[]>(
            `
      SELECT TOP 10 Codigo, Nombre, Descripcion
      FROM [Cnsta Relacionador Cie10]
      ORDER BY Codigo
    `,
          )
        : await this.dataSource.query<Record<string, unknown>[]>(
            `
      SELECT TOP 100 Codigo, Nombre, Descripcion
      FROM [Cnsta Relacionador Cie10]
      WHERE Codigo LIKE @0 OR Nombre LIKE @0 OR Descripcion LIKE @0
      ORDER BY Codigo
    `,
            [`%${term}%`],
          );
    return rows.map((row) => ({
      codigo: row.Codigo != null ? String(row.Codigo) : '',
      nombre: row.Nombre != null ? String(row.Nombre) : '',
      descripcion: row.Descripcion != null ? String(row.Descripcion) : null,
    }));
  }
}
