import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { JwtPayload } from '../auth/auth.service';
import { CreateAgendaCitaDto } from './dto/create-agenda-cita.dto';

const ESTADOS_CANCELADOS = [60, 61, 64, 71];
const ID_ESTADO_VIGENTE = 58;
const HORA_BASE = '1899-12-30';
const PROC_TOP = 40;

export type AgendaProcedimientoDto = {
  codigo: string;
  tiempoMinutos: number;
  unidad: string;
  descripcion: string;
};

export type AgendaCitaDto = {
  idCita: number;
  hora: string;
  horaFin: string;
  idEstado: number | null;
  idTipoCompromiso: number | null;
  tipoCompromiso: string;
  colorTipo: number | null;
  documentoPaciente: string;
  nombrePaciente: string;
  documentoProfesional: string;
  nombreProfesional: string;
  motivo: string;
  estado: string;
  procedimientos: AgendaProcedimientoDto[];
};

export type AgendaDiaDto = {
  fecha: string;
  citas: AgendaCitaDto[];
};

export type AgendaProfesionalDto = {
  documentoProfesional: string;
  nombreProfesional: string;
};

export type AgendaTipoCompromisoDto = {
  idTipoCompromiso: number;
  tipoCompromiso: string;
  colorTipo: number | null;
};

function parseYmd(raw: string | undefined): string | null {
  const s = String(raw ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) {
    return null;
  }
  return s;
}

function ymdToSqlDateTime(ymd: string): string {
  return `${ymd} 00:00:00`;
}

function ymdExclusiveEndSql(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + 1);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} 00:00:00`;
}

function hmToMinutes(hm: string): number | null {
  const m = String(hm ?? '').trim().match(/^(\d{2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

function horaSql(hm: string): string {
  return `${HORA_BASE} ${hm}:00`;
}

function minutesToHm(min: number): string {
  const clamped = Math.max(0, Math.min(min, 23 * 60 + 59));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function sumaTiempos(tiempos: number[]): number {
  return tiempos.reduce((acc, n) => acc + (Number.isFinite(n) ? n : 0), 0);
}

function resolverHoraFin(
  inicioMin: number,
  horaFinRaw: string | undefined,
  tiempos: number[],
): string {
  const fromClient = hmToMinutes(String(horaFinRaw ?? '').trim());
  if (fromClient != null && fromClient > inicioMin) {
    return minutesToHm(fromClient);
  }
  const sum = sumaTiempos(tiempos);
  if (sum > 0) {
    const fin = inicioMin + sum;
    if (fin > inicioMin && fin <= 23 * 60 + 59) {
      return minutesToHm(fin);
    }
  }
  throw new BadRequestException(
    'horaFin debe ser posterior a horaInicio (sin duración por defecto)',
  );
}

function mapProcedimiento(
  row: Record<string, string | number | null>,
): AgendaProcedimientoDto {
  return {
    codigo: String(row.CodigoObjeto ?? '').trim(),
    tiempoMinutos: Number(row.TiempoMinutos ?? 0) || 0,
    unidad: String(row.UnidadTiempo ?? '').trim(),
    descripcion: String(row.DescripcionObjeto ?? '').trim(),
  };
}

function extractInsertedId(result: unknown): number | null {
  if (!Array.isArray(result) || result.length === 0) return null;
  const row = result[0] as Record<string, unknown>;
  const raw = row?.id ?? row?.Id;
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isNaN(n) ? null : n;
}

@Injectable()
export class AgendaService {
  constructor(private readonly dataSource: DataSource) {}

  async listProfesionales(): Promise<AgendaProfesionalDto[]> {
    const rows = await this.dataSource.query<
      Record<string, string | null>[]
    >(
      `
      SELECT DocumentoProfesional, NombreProfesional
      FROM dbo.[Lite Cnsta AgendaProfesional]
      ORDER BY NombreProfesional
      `,
    );
    return rows.map((row) => ({
      documentoProfesional: String(row.DocumentoProfesional ?? '').trim(),
      nombreProfesional: String(row.NombreProfesional ?? '').trim(),
    }));
  }

  async listProcedimientos(qRaw?: string): Promise<AgendaProcedimientoDto[]> {
    const q = String(qRaw ?? '').trim();
    const like = q ? `%${q}%` : null;
    const rows = await this.dataSource.query<
      Record<string, string | number | null>[]
    >(
      like
        ? `
      SELECT TOP (${PROC_TOP}) CodigoObjeto, DescripcionObjeto, TiempoMinutos, UnidadTiempo
      FROM dbo.[Lite Cnsta AgendaProcedimientos]
      WHERE CodigoObjeto LIKE @0 OR DescripcionObjeto LIKE @0
      ORDER BY CodigoObjeto
      `
        : `
      SELECT TOP (${PROC_TOP}) CodigoObjeto, DescripcionObjeto, TiempoMinutos, UnidadTiempo
      FROM dbo.[Lite Cnsta AgendaProcedimientos]
      ORDER BY CodigoObjeto
      `,
      like ? [like] : [],
    );
    return rows.map(mapProcedimiento);
  }

  async listTiposCompromiso(): Promise<AgendaTipoCompromisoDto[]> {
    const rows = await this.dataSource.query<
      Record<string, string | number | null>[]
    >(
      `
      SELECT IdTipoCompromiso, TipoCompromiso, ColorTipo
      FROM dbo.[Lite Cnsta AgendaTipoCompromiso]
      ORDER BY IdTipoCompromiso
      `,
    );
    return rows.map((row) => ({
      idTipoCompromiso: Number(row.IdTipoCompromiso ?? 0),
      tipoCompromiso: String(row.TipoCompromiso ?? '').trim(),
      colorTipo: row.ColorTipo == null ? null : Number(row.ColorTipo),
    }));
  }

  async listCitasDelDia(fechaRaw: string | undefined): Promise<AgendaDiaDto> {
    const fecha = parseYmd(fechaRaw);
    if (!fecha) {
      throw new BadRequestException('fecha debe ser YYYY-MM-DD');
    }
    const desdeSql = ymdToSqlDateTime(fecha);
    const hastaExclSql = ymdExclusiveEndSql(fecha);
    const rows = await this.dataSource.query<
      Record<string, string | number | Date | null>[]
    >(
      `
      SELECT IdCita,
             Fecha,
             HoraInicio,
             Hora,
             HoraFin,
             IdEstado,
             IdTipoCompromiso,
             TipoCompromiso,
             ColorTipo,
             DocumentoPaciente,
             NombrePaciente,
             DocumentoProfesional,
             NombreProfesional,
             Motivo,
             Estado
      FROM dbo.[Lite Cnsta AgendaCitas]
      WHERE Fecha >= CONVERT(datetime, @0, 120)
        AND Fecha < CONVERT(datetime, @1, 120)
      ORDER BY NombreProfesional, HoraInicio, IdCita
      `,
      [desdeSql, hastaExclSql],
    );

    const citas: AgendaCitaDto[] = rows.map((row) => ({
      idCita: Number(row.IdCita ?? 0),
      hora: String(row.Hora ?? ''),
      horaFin: String(row.HoraFin ?? ''),
      idEstado: row.IdEstado == null ? null : Number(row.IdEstado),
      idTipoCompromiso:
        row.IdTipoCompromiso == null ? null : Number(row.IdTipoCompromiso),
      tipoCompromiso: String(row.TipoCompromiso ?? ''),
      colorTipo: row.ColorTipo == null ? null : Number(row.ColorTipo),
      documentoPaciente: String(row.DocumentoPaciente ?? ''),
      nombrePaciente: String(row.NombrePaciente ?? ''),
      documentoProfesional: String(row.DocumentoProfesional ?? ''),
      nombreProfesional: String(row.NombreProfesional ?? ''),
      motivo: String(row.Motivo ?? ''),
      estado: String(row.Estado ?? ''),
      procedimientos: [],
    }));

    const ids = citas.map((c) => c.idCita).filter((id) => id > 0);
    if (ids.length) {
      const procRows = await this.dataSource.query<
        Record<string, string | number | null>[]
      >(
        `
        SELECT IdCita, CodigoObjeto, TiempoMinutos, UnidadTiempo, DescripcionObjeto
        FROM dbo.[Lite Cnsta AgendaCitaProcedimientos]
        WHERE IdCita IN (${ids.join(',')})
        ORDER BY IdCita, CodigoObjeto
        `,
      );
      const byCita = new Map<number, AgendaProcedimientoDto[]>();
      for (const row of procRows) {
        const id = Number(row.IdCita ?? 0);
        const list = byCita.get(id) ?? [];
        list.push(mapProcedimiento(row));
        byCita.set(id, list);
      }
      for (const cita of citas) {
        cita.procedimientos = byCita.get(cita.idCita) ?? [];
      }
    }

    return { fecha, citas };
  }

  async crearCita(
    user: JwtPayload,
    dto: CreateAgendaCitaDto,
  ): Promise<{ idCita: number }> {
    const fecha = parseYmd(dto.fecha);
    if (!fecha) {
      throw new BadRequestException('fecha debe ser YYYY-MM-DD');
    }
    const inicioMin = hmToMinutes(dto.horaInicio);
    if (inicioMin == null) {
      throw new BadRequestException('horaInicio debe ser HH:mm');
    }
    const procedimientos = await this.resolveProcedimientos(dto.codigosObjeto);
    const horaFin = resolverHoraFin(
      inicioMin,
      dto.horaFin,
      procedimientos.map((p) => p.tiempoMinutos),
    );
    const paciente = dto.documentoPaciente.trim();
    const profesional = dto.documentoProfesional.trim();
    const motivo =
      String(dto.motivo ?? '').trim() ||
      procedimientos.map((p) => p.descripcion || p.codigo).join(', ');
    if (!paciente || !profesional) {
      throw new BadRequestException('paciente y profesional son obligatorios');
    }
    if (!motivo) {
      throw new BadRequestException(
        'Indique el motivo o seleccione un procedimiento',
      );
    }
    const idTipo = await this.resolveIdTipoCompromiso(dto.idTipoCompromiso);
    const docEmpresa = await this.resolveDocumentoEmpresa(dto.documentoEmpresa);
    const docUsuario = String(user.documentoEntidad ?? '').trim();
    const desdeSql = ymdToSqlDateTime(fecha);
    const hastaExclSql = ymdExclusiveEndSql(fecha);
    const horaIniSql = horaSql(dto.horaInicio);
    const horaFinSql = horaSql(horaFin);

    await this.assertHorarioLibre(
      profesional,
      desdeSql,
      hastaExclSql,
      horaIniSql,
      horaFinSql,
    );

    const colDigitacion = '[Fecha Digitaci\u00f3n CompromisoVI]';
    const result = await this.dataSource.query(
      `
      DECLARE @InsertedIds TABLE (id INT);

      INSERT INTO dbo.CompromisoVI (
        [Entidad Principal],
        [Entidad Responsable],
        [Descripci\u00f3n CompromisoIV],
        [Fecha Inicio CompromisoVI],
        [Fecha Fin CompromisoVI],
        [Hora Inicio CompromisoVI],
        [Hora Fin CompromisoVI],
        [Id Tipo Compromiso],
        [Entidad Atendida],
        [Entidad Que Atendio],
        ${colDigitacion},
        [Id Estado],
        [Documento Personal],
        [Documento Empresa]
      )
      OUTPUT INSERTED.[Id CompromisoVI] INTO @InsertedIds(id)
      VALUES (
        @0, @1, @2,
        CONVERT(datetime, @3, 120), CONVERT(datetime, @3, 120),
        CONVERT(datetime, @4, 120), CONVERT(datetime, @5, 120),
        @6, @0, @1,
        SYSUTCDATETIME(), @7, @8, @9
      );

      SELECT COALESCE(
        (SELECT TOP 1 id FROM @InsertedIds),
        CAST(SCOPE_IDENTITY() AS INT)
      ) AS id;
      `,
      [
        paciente,
        profesional,
        motivo,
        desdeSql,
        horaIniSql,
        horaFinSql,
        idTipo,
        ID_ESTADO_VIGENTE,
        docUsuario,
        docEmpresa,
      ],
    );

    const idCita = extractInsertedId(result);
    if (idCita == null) {
      throw new BadRequestException('No se pudo guardar la cita');
    }
    for (const proc of procedimientos) {
      await this.dataSource.query(
        `
        INSERT INTO dbo.CompromisoVII ([Id CompromisoVI], [Código Objeto])
        VALUES (@0, @1)
        `,
        [idCita, proc.codigo],
      );
    }
    return { idCita };
  }

  async actualizarCita(
    user: JwtPayload,
    idRaw: number,
    dto: CreateAgendaCitaDto,
  ): Promise<{ idCita: number }> {
    const idCita = Number(idRaw);
    if (!Number.isInteger(idCita) || idCita < 1) {
      throw new BadRequestException('id de cita no válido');
    }
    const exists = await this.dataSource.query<{ id: number }[]>(
      `SELECT TOP 1 [Id CompromisoVI] AS id FROM dbo.CompromisoVI WHERE [Id CompromisoVI] = @0`,
      [idCita],
    );
    if (!exists.length) {
      throw new NotFoundException('Cita no encontrada');
    }

    const fecha = parseYmd(dto.fecha);
    if (!fecha) {
      throw new BadRequestException('fecha debe ser YYYY-MM-DD');
    }
    const inicioMin = hmToMinutes(dto.horaInicio);
    if (inicioMin == null) {
      throw new BadRequestException('horaInicio debe ser HH:mm');
    }
    const procedimientos = await this.resolveProcedimientos(dto.codigosObjeto);
    const horaFin = resolverHoraFin(
      inicioMin,
      dto.horaFin,
      procedimientos.map((p) => p.tiempoMinutos),
    );
    const paciente = dto.documentoPaciente.trim();
    const profesional = dto.documentoProfesional.trim();
    const motivo =
      String(dto.motivo ?? '').trim() ||
      procedimientos.map((p) => p.descripcion || p.codigo).join(', ');
    if (!paciente || !profesional) {
      throw new BadRequestException('paciente y profesional son obligatorios');
    }
    if (!motivo) {
      throw new BadRequestException(
        'Indique el motivo o seleccione un procedimiento',
      );
    }
    const idTipo = await this.resolveIdTipoCompromiso(dto.idTipoCompromiso);
    const docUsuario = String(user.documentoEntidad ?? '').trim();
    const desdeSql = ymdToSqlDateTime(fecha);
    const hastaExclSql = ymdExclusiveEndSql(fecha);
    const horaIniSql = horaSql(dto.horaInicio);
    const horaFinSql = horaSql(horaFin);

    await this.assertHorarioLibre(
      profesional,
      desdeSql,
      hastaExclSql,
      horaIniSql,
      horaFinSql,
      idCita,
    );

    await this.dataSource.query(
      `
      UPDATE dbo.CompromisoVI
      SET [Entidad Principal] = @0,
          [Entidad Responsable] = @1,
          [Descripci\u00f3n CompromisoIV] = @2,
          [Fecha Inicio CompromisoVI] = CONVERT(datetime, @3, 120),
          [Fecha Fin CompromisoVI] = CONVERT(datetime, @3, 120),
          [Hora Inicio CompromisoVI] = CONVERT(datetime, @4, 120),
          [Hora Fin CompromisoVI] = CONVERT(datetime, @5, 120),
          [Id Tipo Compromiso] = @6,
          [Entidad Atendida] = @0,
          [Entidad Que Atendio] = @1,
          [DocumentoCambioCita] = @8
      WHERE [Id CompromisoVI] = @7
      `,
      [
        paciente,
        profesional,
        motivo,
        desdeSql,
        horaIniSql,
        horaFinSql,
        idTipo,
        idCita,
        docUsuario,
      ],
    );

    await this.dataSource.query(
      `DELETE FROM dbo.CompromisoVII WHERE [Id CompromisoVI] = @0`,
      [idCita],
    );
    for (const proc of procedimientos) {
      await this.dataSource.query(
        `
        INSERT INTO dbo.CompromisoVII ([Id CompromisoVI], [Código Objeto])
        VALUES (@0, @1)
        `,
        [idCita, proc.codigo],
      );
    }
    return { idCita };
  }

  private async assertHorarioLibre(
    profesional: string,
    desdeSql: string,
    hastaExclSql: string,
    horaIniSql: string,
    horaFinSql: string,
    excludeId?: number,
  ): Promise<void> {
    const choques = await this.dataSource.query<{ id: number }[]>(
      `
      SELECT TOP 1 [Id CompromisoVI] AS id
      FROM dbo.CompromisoVI
      WHERE LTRIM(RTRIM([Entidad Responsable])) = LTRIM(RTRIM(@0))
        AND [Fecha Inicio CompromisoVI] >= CONVERT(datetime, @1, 120)
        AND [Fecha Inicio CompromisoVI] < CONVERT(datetime, @2, 120)
        AND ISNULL([Id Estado], 0) NOT IN (${ESTADOS_CANCELADOS.join(', ')})
        AND CONVERT(time, [Hora Inicio CompromisoVI]) < CONVERT(time, @4)
        AND CONVERT(time, ISNULL([Hora Fin CompromisoVI], [Hora Inicio CompromisoVI]))
            > CONVERT(time, @3)
        AND (@5 IS NULL OR [Id CompromisoVI] <> @5)
      `,
      [
        profesional,
        desdeSql,
        hastaExclSql,
        horaIniSql,
        horaFinSql,
        excludeId ?? null,
      ],
    );
    if (choques.length) {
      throw new ConflictException(
        'Ese horario ya está ocupado para el profesional',
      );
    }
  }

  private async resolveProcedimientos(
    raw: string[] | undefined,
  ): Promise<AgendaProcedimientoDto[]> {
    const codes = [
      ...new Set(
        (raw ?? [])
          .map((c) => String(c ?? '').trim())
          .filter((c) => c.length > 0),
      ),
    ];
    if (!codes.length) return [];
    const found: AgendaProcedimientoDto[] = [];
    for (const code of codes) {
      const rows = await this.dataSource.query<
        Record<string, string | number | null>[]
      >(
        `
        SELECT TOP 1 CodigoObjeto, DescripcionObjeto, TiempoMinutos, UnidadTiempo
        FROM dbo.[Lite Cnsta AgendaProcedimientos]
        WHERE LTRIM(RTRIM(CodigoObjeto)) = LTRIM(RTRIM(@0))
        `,
        [code],
      );
      if (!rows.length) {
        throw new BadRequestException(
          `Procedimiento no válido: ${code}`,
        );
      }
      found.push(mapProcedimiento(rows[0]));
    }
    return found;
  }

  private async resolveDocumentoEmpresa(
    explicit: string | undefined,
  ): Promise<string> {
    if (explicit?.trim()) {
      return explicit.trim();
    }
    const rows = await this.dataSource.query<{ DocumentoEmpresa: string }[]>(
      `SELECT TOP 1 DocumentoEmpresa FROM dbo.[Lite Cnsta Empresa]`,
    );
    if (!rows.length) {
      throw new NotFoundException('No hay empresa en catálogo');
    }
    return rows[0].DocumentoEmpresa;
  }

  private async resolveIdTipoCompromiso(
    raw: number | undefined,
  ): Promise<number> {
    const requested = raw == null || Number.isNaN(Number(raw)) ? 2 : Number(raw);
    const rows = await this.dataSource.query<{ id: number }[]>(
      `
      SELECT IdTipoCompromiso AS id
      FROM dbo.[Lite Cnsta AgendaTipoCompromiso]
      WHERE IdTipoCompromiso = @0
      `,
      [requested],
    );
    if (!rows.length) {
      throw new BadRequestException('Tipo de compromiso no válido');
    }
    return Number(rows[0].id);
  }
}
