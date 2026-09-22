import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  fetchAgendaCitas,
  fetchAgendaEspacios,
  fetchAgendaTiposCompromiso,
  messageFromAxiosError,
} from '../api/client';
import { PatientEditModal } from '../components/PatientEditModal';
import {
  NuevaCitaModal,
  TablaProcedimientos,
} from '../components/NuevaCitaModal';
import { useCompany } from '../auth/CompanyContext';
import { getStoredAgendaFecha, setStoredAgendaFecha } from '../config';

const ESTADOS_CANCELADOS = new Set([60, 61, 64, 71]);
const SLOT_INICIO = 6 * 60;
const SLOT_PASO = 5;
const CELDA_MIN = 30;
const GRID_FIN = 22 * 60;
const GRID_MINUTOS = GRID_FIN - SLOT_INICIO;
const SLOT_PX = 20;
const GRID_HEIGHT = (GRID_MINUTOS / SLOT_PASO) * SLOT_PX;
const AVATAR_PALETTE = [
  '#1a73e8',
  '#188038',
  '#9334e6',
  '#e37400',
  '#484a7d',
  '#cf3722',
  '#0d9488',
  '#c026d3',
];

function ymdLocal(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDays(ymd, n) {
  const [y, m, d] = String(ymd).split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return ymdLocal(dt);
}

function formatDiaLargo(ymd) {
  const [y, m, d] = String(ymd).split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const texto = dt.toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function minutesToHm(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

function hmToMinutes(hm) {
  const m = String(hm ?? '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function buildHourLabels() {
  const labels = [];
  for (let min = SLOT_INICIO; min <= GRID_FIN; min += CELDA_MIN) {
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

function inicialesNombre(nombre) {
  return String(nombre ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function avatarColor(key) {
  const s = String(key ?? '');
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}

function isCancelada(cita) {
  return ESTADOS_CANCELADOS.has(Number(cita?.idEstado));
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

function oleToRgb(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v < 0) return null;
  return {
    r: v & 255,
    g: (v >> 8) & 255,
    b: (v >> 16) & 255,
  };
}

function oleToCss(n) {
  const rgb = oleToRgb(n);
  if (!rgb) return null;
  return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
}

function oleSoftCss(n) {
  const rgb = oleToRgb(n);
  if (!rgb) return null;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.12)`;
}

function citaRango(cita) {
  const start = hmToMinutes(cita.hora);
  if (start == null) return null;
  let end = hmToMinutes(cita.horaFin);
  if (end == null || end <= start) end = start + SLOT_PASO;
  return { start, end };
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

function calcularSolapamientos(citasProfesional) {
  const grupos = [];
  const sorted = [...citasProfesional].sort((a, b) => {
    const ra = citaRango(a);
    const rb = citaRango(b);
    return (ra?.start ?? 0) - (rb?.start ?? 0);
  });
  for (const cita of sorted) {
    const r = citaRango(cita);
    if (!r) continue;
    let grupo = null;
    for (const g of grupos) {
      const ultima = citaRango(g[g.length - 1]);
      if (ultima && r.start < ultima.end) {
        grupo = g;
        break;
      }
    }
    if (grupo) grupo.push(cita);
    else grupos.push([cita]);
  }
  return grupos;
}

function layoutCitas(citasProfesional) {
  return calcularSolapamientos(citasProfesional).flatMap((grupo) =>
    grupo.map((cita, index) => ({ cita, index, total: grupo.length })),
  );
}

function CitaResumenPopover({
  cita,
  anchor,
  onClose,
  onKeep,
  onEvolucionar,
  onEditarCita,
  onEditarPaciente,
}) {
  const ref = useRef(null);
  const procs = Array.isArray(cita.procedimientos) ? cita.procedimientos : [];

  useEffect(() => {
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [onClose]);

  const top = Math.min(anchor.top, window.innerHeight - 280);
  const left = Math.min(anchor.left + anchor.width + 8, window.innerWidth - 340);

  return (
    <div
      ref={ref}
      className="agenda-resumen"
      style={{ top, left }}
      onMouseEnter={onKeep}
      onMouseLeave={onClose}
    >
      <strong>{cita.nombrePaciente || 'Paciente'}</strong>
      <p className="muted" style={{ margin: '0.15rem 0 0.4rem' }}>
        {cita.hora}
        {cita.horaFin ? `–${cita.horaFin}` : ''}
        {cita.tipoCompromiso ? ` · ${cita.tipoCompromiso}` : ''}
      </p>
      <p style={{ margin: '0 0 0.45rem' }}>{cita.motivo || '—'}</p>
      <TablaProcedimientos rows={procs} />
      <div className="agenda-resumen-actions">
        <button
          type="button"
          className="btn-sm"
          onClick={() => onEditarCita(cita)}
        >
          Editar cita
        </button>
        <button
          type="button"
          className="btn-sm"
          disabled={!String(cita.documentoPaciente ?? '').trim()}
          onClick={() => onEditarPaciente(cita)}
        >
          Actualizar paciente
        </button>
        <button
          type="button"
          className="btn-sm"
          disabled={!String(cita.documentoPaciente ?? '').trim()}
          onClick={() => onEvolucionar(cita.documentoPaciente)}
        >
          Evolucionar
        </button>
      </div>
    </div>
  );
}

export default function AgendaPage() {
  const navigate = useNavigate();
  const { documentoEmpresa, nombreComercialEmpresa } = useCompany();
  const [fecha, setFecha] = useState(
    () => getStoredAgendaFecha() || ymdLocal(new Date()),
  );
  const [citas, setCitas] = useState([]);
  const [primarias, setPrimarias] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [filtroCol, setFiltroCol] = useState('');
  const [loading, setLoading] = useState(true);
  const [catalogReady, setCatalogReady] = useState(false);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [resumen, setResumen] = useState(null);
  const [editPaciente, setEditPaciente] = useState(null);
  const hideResumenTimer = useRef(null);
  const [nowMin, setNowMin] = useState(() => {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  });

  const esHoy = fecha === ymdLocal(new Date());

  useEffect(() => {
    setStoredAgendaFecha(fecha);
  }, [fecha]);

  async function loadDia(opts = {}) {
    if (!documentoEmpresa) {
      setCitas([]);
      setPrimarias([]);
      if (!opts.silent) setLoading(false);
      return;
    }
    if (!opts.silent) setLoading(true);
    setError('');
    try {
      const [citasData, espaciosData] = await Promise.all([
        fetchAgendaCitas(fecha, documentoEmpresa),
        fetchAgendaEspacios(fecha, documentoEmpresa),
      ]);
      setCitas(Array.isArray(citasData?.citas) ? citasData.citas : []);
      setPrimarias(
        Array.isArray(espaciosData?.primarias) ? espaciosData.primarias : [],
      );
    } catch (e) {
      setCitas([]);
      setPrimarias([]);
      setError(await messageFromAxiosError(e, 'No se pudieron cargar las citas'));
    } finally {
      if (!opts.silent) setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const tiposRows = await fetchAgendaTiposCompromiso();
        if (cancelled) return;
        setTipos(Array.isArray(tiposRows) ? tiposRows : []);
      } catch {
        /* catálogos opcionales */
      } finally {
        if (!cancelled) setCatalogReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void loadDia();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recargar al cambiar fecha o sede
  }, [fecha, documentoEmpresa]);

  useEffect(() => {
    if (!esHoy) return undefined;
    const tick = () => {
      const n = new Date();
      setNowMin(n.getHours() * 60 + n.getMinutes());
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [esHoy]);

  const columnas = useMemo(() => {
    if (filtroCol) {
      return primarias.filter((c) => c.documento === filtroCol);
    }
    return primarias;
  }, [primarias, filtroCol]);

  useEffect(() => {
    if (filtroCol && !primarias.some((p) => p.documento === filtroCol)) {
      setFiltroCol('');
    }
  }, [primarias, filtroCol]);

  const nowTop =
    esHoy && nowMin >= SLOT_INICIO && nowMin <= GRID_FIN
      ? ((nowMin - SLOT_INICIO) / SLOT_PASO) * SLOT_PX
      : null;

  function abrirNuevaCita(col, celda) {
    setModal({
      horaInicio: minutesToHm(celda.start),
      profesional: {
        documento: celda.documento,
        nombre: celda.nombre,
      },
      documentoEspacio: col.documento,
      nombreEspacio: col.nombre,
    });
  }

  function modalDesdeCita(cita, col) {
    return {
      cita: { ...cita, fecha },
      profesional: {
        documento: cita.documentoProfesional,
        nombre: cita.nombreProfesional || cita.documentoProfesional,
      },
      horaInicio: cita.hora,
      documentoEspacio: col?.documento || '',
      nombreEspacio: col?.nombre || '',
    };
  }

  function goEvolucion(documentoPaciente) {
    const doc = String(documentoPaciente ?? '').trim();
    if (!doc) return;
    navigate('/principal/evolucion', { state: { documentoPaciente: doc } });
  }

  function showResumen(cita, el) {
    if (hideResumenTimer.current) {
      clearTimeout(hideResumenTimer.current);
      hideResumenTimer.current = null;
    }
    const box = el.getBoundingClientRect();
    setResumen({
      cita,
      anchor: {
        top: box.top,
        left: box.left,
        width: box.width,
      },
    });
  }

  function scheduleHideResumen() {
    if (hideResumenTimer.current) clearTimeout(hideResumenTimer.current);
    hideResumenTimer.current = setTimeout(() => setResumen(null), 180);
  }

  return (
    <div className="page agenda-page">
      <header className="agenda-topbar">
        <div className="agenda-topbar-left">
          <div className="agenda-brand">Agenda</div>
          <button
            type="button"
            className="agenda-today-btn"
            disabled={esHoy}
            onClick={() => setFecha(ymdLocal(new Date()))}
          >
            Hoy
          </button>
          <div className="agenda-nav">
            <button
              type="button"
              className="agenda-nav-btn"
              aria-label="Día anterior"
              onClick={() => setFecha((f) => addDays(f, -1))}
            >
              ‹
            </button>
            <button
              type="button"
              className="agenda-nav-btn"
              aria-label="Día siguiente"
              onClick={() => setFecha((f) => addDays(f, 1))}
            >
              ›
            </button>
          </div>
          <div className="agenda-date-title">{formatDiaLargo(fecha)}</div>
        </div>
        <div className="agenda-topbar-right">
          <Link
            className="agenda-today-btn"
            to="/principal/programaciones"
            state={{ fecha }}
          >
            Lista de citas
          </Link>
          <input
            className="agenda-date-input"
            type="date"
            value={fecha}
            onChange={(e) => {
              if (e.target.value) setFecha(e.target.value);
            }}
            aria-label="Fecha"
          />
          <select
            className="agenda-view-select"
            value={filtroCol}
            onChange={(e) => setFiltroCol(e.target.value)}
            aria-label="Espacio"
          >
            <option value="">Todos</option>
            {primarias.map((p) => (
              <option key={p.documento} value={p.documento}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>
      </header>

      {error && <div className="alert alert-error">{error}</div>}

      {loading || !catalogReady ? (
        <p className="muted agenda-loading">Cargando agenda…</p>
      ) : columnas.length === 0 ? (
        <p className="muted agenda-loading">
          No hay espacios programados este día.
        </p>
      ) : (
        <div className="agenda-cal-wrap">
          <div className="agenda-cal-scroll">
            <div className="agenda-cal-header">
              <div className="agenda-header-time" />
              {columnas.map((col) => (
                <div key={col.documento} className="agenda-pro-head">
                  <div className="agenda-pro-inner">
                    <div
                      className="agenda-pro-avatar"
                      style={{ background: avatarColor(col.documento) }}
                    >
                      {inicialesNombre(col.nombre) || '·'}
                    </div>
                    <div className="agenda-pro-name">{col.nombre}</div>
                    <div className="agenda-pro-doc">{col.documento}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="agenda-cal-body">
              <div className="agenda-time-col" style={{ height: GRID_HEIGHT }}>
                <div
                  className="agenda-time-area"
                  style={{ height: GRID_HEIGHT }}
                >
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
                const delDia = citasDeColumna(citas, col);
                const laid = layoutCitas(delDia);
                const celdas = (col.secundarias ?? []).flatMap((sec) =>
                  celdasDeSecundaria(sec).filter(
                    (celda) => !celdaSolapaCitas(celda, delDia),
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
                        style={{
                          top: ((celda.start - SLOT_INICIO) / SLOT_PASO) * SLOT_PX,
                          height: (CELDA_MIN / SLOT_PASO) * SLOT_PX,
                        }}
                        onClick={() => abrirNuevaCita(col, celda)}
                      >
                        {celda.nombre}
                      </button>
                    ))}
                    {nowTop != null ? (
                      <div className="agenda-now-line" style={{ top: nowTop }} />
                    ) : null}
                    {laid.map(({ cita, index, total }) => {
                      const geo = blockGeometryPx(cita);
                      if (!geo) return null;
                      const color = oleToCss(cita.colorTipo) || 'var(--brand)';
                      return (
                        <div
                          key={cita.idCita}
                          className="agenda-cita-block"
                          role="button"
                          tabIndex={0}
                          style={{
                            top: geo.top,
                            height: Math.max(geo.height, 48),
                            width: `${100 / total}%`,
                            left: `${index * (100 / total)}%`,
                            background: color,
                            borderLeftColor: color,
                            color: '#111',
                          }}
                          onMouseEnter={(e) =>
                            showResumen(cita, e.currentTarget)
                          }
                          onMouseLeave={scheduleHideResumen}
                          onClick={(e) => {
                            e.stopPropagation();
                            setResumen(null);
                            setModal(modalDesdeCita(cita, col));
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              e.stopPropagation();
                              setModal(modalDesdeCita(cita, col));
                            }
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

      {resumen ? (
        <CitaResumenPopover
          cita={resumen.cita}
          anchor={resumen.anchor}
          onClose={() => setResumen(null)}
          onKeep={() => {
            if (hideResumenTimer.current) {
              clearTimeout(hideResumenTimer.current);
              hideResumenTimer.current = null;
            }
          }}
          onEvolucionar={(doc) => {
            setResumen(null);
            goEvolucion(doc);
          }}
          onEditarCita={(cita) => {
            setResumen(null);
            const col = columnas.find(
              (c) => citasDeColumna([cita], c).length > 0,
            );
            setModal(modalDesdeCita(cita, col));
          }}
          onEditarPaciente={(cita) => {
            setResumen(null);
            setEditPaciente({
              documento: cita.documentoPaciente,
              nombre: cita.nombrePaciente,
            });
          }}
        />
      ) : null}

      {modal ? (
        <NuevaCitaModal
          fecha={fecha}
          horaInicio={modal.horaInicio || modal.cita?.hora || '06:00'}
          profesional={modal.profesional}
          documentoEspacio={modal.documentoEspacio}
          nombreEspacio={modal.nombreEspacio}
          documentoEmpresa={documentoEmpresa}
          nombreSede={nombreComercialEmpresa}
          tipos={tipos}
          citaInicial={modal.cita || null}
          onClose={() => setModal(null)}
          onCreated={(ymd) => {
            setModal(null);
            if (ymd && ymd !== fecha) {
              setFecha(ymd);
            } else {
              void loadDia({ silent: true });
            }
          }}
        />
      ) : null}

      {editPaciente ? (
        <PatientEditModal
          documentoPaciente={editPaciente.documento}
          nombrePaciente={editPaciente.nombre}
          onClose={() => setEditPaciente(null)}
          onSaved={() => setEditPaciente(null)}
        />
      ) : null}
    </div>
  );
}
