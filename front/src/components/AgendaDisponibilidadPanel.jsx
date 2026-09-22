import { useEffect, useMemo, useState } from 'react';
import {
  fetchAgendaCitas,
  fetchAgendaEspacios,
  fetchAgendaProfesionales,
  messageFromAxiosError,
  updateAgendaCita,
} from '../api/client';

const ESTADOS_CANCELADOS = new Set([60, 61, 62, 63, 64, 71]);
const SLOT_INICIO = 6 * 60;
const SLOT_PASO = 5;
const CELDA_MIN = 30;
const GRID_FIN = 22 * 60;
const GRID_MINUTOS = GRID_FIN - SLOT_INICIO;
const SLOT_PX = 20;
const GRID_HEIGHT = (GRID_MINUTOS / SLOT_PASO) * SLOT_PX;

function pad2(n) {
  return String(n).padStart(2, '0');
}

function minutesToHm(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

function hmToMinutes(hm) {
  const m = String(hm ?? '')
    .trim()
    .match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function buildHourLabels() {
  const labels = [];
  for (let min = SLOT_INICIO; min <= GRID_FIN; min += 30) {
    labels.push({
      hm: minutesToHm(min),
      top: ((min - SLOT_INICIO) / SLOT_PASO) * SLOT_PX,
    });
  }
  return labels;
}

function buildGridMarks() {
  const marks = [];
  for (let m = SLOT_INICIO; m <= GRID_FIN; m += 15) {
    marks.push({
      top: ((m - SLOT_INICIO) / SLOT_PASO) * SLOT_PX,
      hour: m % 60 === 0,
    });
  }
  return marks;
}

const HOUR_LABELS = buildHourLabels();
const GRID_MARKS = buildGridMarks();

function citaRango(cita) {
  const start = hmToMinutes(cita.hora);
  if (start == null) return null;
  let end = hmToMinutes(cita.horaFin);
  if (end == null || end <= start) end = start + SLOT_PASO;
  return { start, end };
}

function rangoDeHoras(horaInicio, horaFin) {
  const start = hmToMinutes(horaInicio);
  if (start == null) return null;
  let end = hmToMinutes(horaFin);
  if (end == null || end <= start) end = start + SLOT_PASO;
  return { start, end };
}

function rangosSolapan(a, b) {
  return a.start < b.end && b.start < a.end;
}

function isCancelada(cita) {
  return ESTADOS_CANCELADOS.has(Number(cita?.idEstado));
}

function secsDelProfesional(col, documentoProfesional) {
  const doc = String(documentoProfesional ?? '').trim();
  return (col?.secundarias ?? []).filter(
    (s) => String(s.documento ?? '').trim() === doc,
  );
}

function citasDeColumna(citas, col) {
  const secs = col?.secundarias ?? [];
  return citas.filter((cita) => {
    if (isCancelada(cita)) return false;
    const cr = citaRango(cita);
    if (!cr) return false;
    const doc = String(cita.documentoProfesional ?? '').trim();
    return secs.some((s) => {
      if (String(s.documento ?? '').trim() !== doc) return false;
      const sr = rangoDeHoras(s.horaInicio, s.horaFin);
      return sr && rangosSolapan(cr, sr);
    });
  });
}

function celdasDeSecundaria(sec) {
  const r = rangoDeHoras(sec.horaInicio, sec.horaFin);
  if (!r) return [];
  const cells = [];
  for (let t = SLOT_INICIO; t < GRID_FIN; t += CELDA_MIN) {
    const cell = { start: t, end: t + CELDA_MIN };
    if (!rangosSolapan(cell, r)) continue;
    cells.push({
      start: t,
      end: t + CELDA_MIN,
      nombre: sec.nombre || sec.documento,
      documento: sec.documento,
      id: sec.id,
    });
  }
  return cells;
}

function celdaSolapaCitas(celda, citasCol) {
  const cr = { start: celda.start, end: celda.end };
  return citasCol.some((c) => {
    const r = citaRango(c);
    return r && rangosSolapan(cr, r);
  });
}

function blockGeometryPx(cita) {
  const r = citaRango(cita);
  if (!r) return null;
  const a = Math.max(r.start, SLOT_INICIO);
  const b = Math.min(r.end, GRID_FIN);
  if (b <= a) return null;
  return {
    top: ((a - SLOT_INICIO) / SLOT_PASO) * SLOT_PX,
    height: ((b - a) / SLOT_PASO) * SLOT_PX,
  };
}

function oleToCss(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v < 0) return null;
  return `rgb(${v & 255}, ${(v >> 8) & 255}, ${(v >> 16) & 255})`;
}

function durationMinutes(horaInicio, horaFin) {
  const a = hmToMinutes(horaInicio);
  const b = hmToMinutes(horaFin);
  if (a == null || b == null || b <= a) return 30;
  return b - a;
}

export function AgendaDisponibilidadPanel({
  citaInicial,
  documentoEmpresa,
  documentoPaciente,
  motivo,
  idTipo,
  procedimientos,
  horaInicio,
  horaFin,
  documentoEspacioOriginal,
  onMoved,
  disabled,
}) {
  const [fechaDisp, setFechaDisp] = useState(
    () => citaInicial?.fecha || '',
  );
  const [docProfesional, setDocProfesional] = useState(
    () => String(citaInicial?.documentoProfesional ?? '').trim(),
  );
  const [profesionales, setProfesionales] = useState([]);
  const [primarias, setPrimarias] = useState([]);
  const [citas, setCitas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const rows = await fetchAgendaProfesionales();
        if (!cancel) setProfesionales(Array.isArray(rows) ? rows : []);
      } catch {
        if (!cancel) setProfesionales([]);
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    if (!documentoEmpresa || !fechaDisp) {
      setCitas([]);
      setPrimarias([]);
      return undefined;
    }
    let cancel = false;
    setLoading(true);
    setError('');
    (async () => {
      try {
        const [citasData, espaciosData] = await Promise.all([
          fetchAgendaCitas(fechaDisp, documentoEmpresa),
          fetchAgendaEspacios(fechaDisp, documentoEmpresa),
        ]);
        if (cancel) return;
        setCitas(Array.isArray(citasData?.citas) ? citasData.citas : []);
        setPrimarias(
          Array.isArray(espaciosData?.primarias) ? espaciosData.primarias : [],
        );
      } catch (e) {
        if (cancel) return;
        setCitas([]);
        setPrimarias([]);
        setError(
          await messageFromAxiosError(e, 'No se pudo cargar la disponibilidad'),
        );
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [documentoEmpresa, fechaDisp]);

  const citasVisibles = useMemo(() => {
    const idActual = Number(citaInicial?.idCita);
    return citas.filter((c) => Number(c.idCita) !== idActual);
  }, [citas, citaInicial?.idCita]);

  const columnas = useMemo(() => {
    const doc = String(docProfesional ?? '').trim();
    if (!doc) return [];
    return primarias.filter((col) => secsDelProfesional(col, doc).length > 0);
  }, [primarias, docProfesional]);

  async function moverA(col, startMin) {
    if (disabled || moving) return;
    const idCita = Number(citaInicial?.idCita);
    if (!Number.isInteger(idCita) || idCita < 1) {
      setError('Guarde la cita primero para cambiarla de profesional.');
      return;
    }
    const prof = String(docProfesional ?? '').trim();
    if (!prof) {
      setError('Seleccione el profesional destino.');
      return;
    }
    const paciente = String(documentoPaciente ?? '').trim();
    if (!paciente) {
      setError('Seleccione un paciente en la pestaña Cita.');
      return;
    }
    const dur = durationMinutes(horaInicio, horaFin);
    const finMin = Math.min(startMin + dur, 23 * 60 + 59);
    const horaIni = minutesToHm(startMin);
    const horaFinNueva = minutesToHm(finMin);
    const motivoFinal =
      String(motivo ?? '').trim() ||
      (procedimientos ?? []).map((p) => p.descripcion || p.codigo).join(', ');
    if (!motivoFinal) {
      setError('Indique el motivo o seleccione un procedimiento.');
      return;
    }
    setMoving(true);
    setError('');
    try {
      await updateAgendaCita(idCita, {
        documentoPaciente: paciente,
        documentoProfesional: prof,
        fecha: fechaDisp,
        horaInicio: horaIni,
        horaFin: horaFinNueva,
        motivo: motivoFinal,
        idTipoCompromiso: Number(idTipo) || undefined,
        codigosObjeto: (procedimientos ?? []).map((p) => p.codigo),
        documentoEmpresa,
        documentoEspacio:
          col.documento ||
          documentoEspacioOriginal ||
          undefined,
      });
      onMoved(fechaDisp);
    } catch (e) {
      setError(
        await messageFromAxiosError(e, 'No se pudo mover la cita'),
      );
    } finally {
      setMoving(false);
    }
  }

  return (
    <div className="agenda-disp">
      <div className="agenda-disp-toolbar">
        <label className="hc-field">
          <span className="hc-field-label">Fecha</span>
          <input
            className="hc-input"
            type="date"
            value={fechaDisp}
            disabled={disabled || moving}
            onChange={(e) => {
              if (e.target.value) setFechaDisp(e.target.value);
            }}
          />
        </label>
        <label className="hc-field">
          <span className="hc-field-label">Profesional</span>
          <select
            className="hc-input"
            value={docProfesional}
            disabled={disabled || moving}
            onChange={(e) => setDocProfesional(e.target.value)}
          >
            <option value="">— Seleccione —</option>
            {profesionales.map((p) => (
              <option
                key={p.documentoProfesional}
                value={p.documentoProfesional}
              >
                {p.nombreProfesional || p.documentoProfesional}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error ? <div className="alert alert-error">{error}</div> : null}
      {!esEdicionHint(citaInicial) ? (
        <p className="muted agenda-tab-placeholder">
          Guarde la cita primero para cambiarla de profesional.
        </p>
      ) : !docProfesional ? (
        <p className="muted agenda-tab-placeholder">
          Seleccione el profesional al que va a cambiar la cita.
        </p>
      ) : loading ? (
        <p className="muted">Cargando disponibilidad…</p>
      ) : columnas.length === 0 ? (
        <p className="muted agenda-tab-placeholder">
          Este profesional no tiene espacios programados este día.
        </p>
      ) : (
        <div className="agenda-cal-wrap agenda-disp-cal">
          <div className="agenda-cal-scroll">
            <div className="agenda-cal-header">
              <div className="agenda-header-time" />
              {columnas.map((col) => (
                <div key={col.documento} className="agenda-pro-head">
                  <div className="agenda-pro-inner">
                    <div className="agenda-pro-name">{col.nombre}</div>
                    {col.documento ? (
                      <div className="agenda-pro-doc">{col.documento}</div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
            <div className="agenda-cal-body">
              <div className="agenda-time-col" style={{ height: GRID_HEIGHT }}>
                <div className="agenda-time-area" style={{ height: GRID_HEIGHT }}>
                  {HOUR_LABELS.map((h, i) => (
                    <div
                      key={h.hm}
                      className={
                        i === 0
                          ? 'agenda-hour-label agenda-hour-label--first'
                          : 'agenda-hour-label'
                      }
                      style={{ top: h.top }}
                    >
                      {h.hm}
                    </div>
                  ))}
                </div>
              </div>
              {columnas.map((col) => {
                const secs = secsDelProfesional(col, docProfesional);
                const delCol = citasDeColumna(citasVisibles, col);
                const doc = String(docProfesional ?? '').trim();
                const delDia = delCol.filter(
                  (c) => String(c.documentoProfesional ?? '').trim() === doc,
                );
                const celdas = secs.flatMap((sec) =>
                  celdasDeSecundaria(sec).filter(
                    (celda) => !celdaSolapaCitas(celda, delCol),
                  ),
                );
                return (
                  <div
                    key={col.documento}
                    className="agenda-pro-col"
                    style={{ height: GRID_HEIGHT }}
                  >
                    {GRID_MARKS.map((m) => (
                      <div
                        key={m.top}
                        className={
                          m.hour
                            ? 'agenda-grid-line agenda-grid-line--hour'
                            : 'agenda-grid-line agenda-grid-line--quarter'
                        }
                        style={{ top: m.top }}
                      />
                    ))}
                    {celdas.map((celda) => (
                      <button
                        key={`${celda.id}-${celda.start}`}
                        type="button"
                        className="agenda-secundaria-celda"
                        disabled={moving}
                        style={{
                          top:
                            ((celda.start - SLOT_INICIO) / SLOT_PASO) *
                            SLOT_PX,
                          height: (CELDA_MIN / SLOT_PASO) * SLOT_PX,
                        }}
                        onClick={() => void moverA(col, celda.start)}
                      >
                        {celda.nombre}
                      </button>
                    ))}
                    {delDia.map((cita) => {
                      const geo = blockGeometryPx(cita);
                      if (!geo) return null;
                      const color = oleToCss(cita.colorTipo) || 'var(--brand)';
                      return (
                        <div
                          key={cita.idCita}
                          className="agenda-cita-block"
                          style={{
                            top: geo.top,
                            height: Math.max(geo.height, 24),
                            width: '100%',
                            left: 0,
                            background: color,
                            borderLeftColor: color,
                            color: '#111',
                            pointerEvents: 'none',
                          }}
                        >
                          <div className="agenda-cita-patient">
                            {cita.nombrePaciente || 'Paciente'}
                          </div>
                          <div className="agenda-cita-time">
                            {cita.hora}
                            {cita.horaFin ? ` – ${cita.horaFin}` : ''}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function esEdicionHint(citaInicial) {
  return Number(citaInicial?.idCita) > 0;
}
