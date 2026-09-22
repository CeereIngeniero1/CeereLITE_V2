import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  fetchAgendaCitas,
  fetchAgendaEstadosCita,
  messageFromAxiosError,
  updateAgendaCitaEstado,
} from '../api/client';
import { useCompany } from '../auth/CompanyContext';
import {
  getStoredAgendaFecha,
  setStoredAgendaFecha,
  setStoredHcDocumento,
} from '../config';

const ESTADOS_CANCELADOS = new Set([60, 61, 62, 63, 64, 71]);
const ID_ESTADO_ASISTIO = 59;

const SORT_COLS = [
  { key: 'profesional', label: 'Profesional' },
  { key: 'paciente', label: 'Paciente' },
  { key: 'telefono', label: 'Teléfono' },
  { key: 'hora', label: 'Hora inicio' },
  { key: 'estado', label: 'Estado' },
  { key: 'motivo', label: 'Descripción' },
  { key: 'tipo', label: 'Tipo de compromiso' },
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

function hmToMinutes(hm) {
  const m = String(hm ?? '')
    .trim()
    .match(/^(\d{1,2}):(\d{2})/);
  if (!m) return 0;
  return Number(m[1]) * 60 + Number(m[2]);
}

function formatHora12(hm) {
  const min = hmToMinutes(hm);
  const h24 = Math.floor(min / 60);
  const mm = String(min % 60).padStart(2, '0');
  const suf = h24 >= 12 ? 'p. m.' : 'a. m.';
  const h12 = h24 % 12 || 12;
  return `${h12}:${mm} ${suf}`;
}

function rowClassForEstado(idEstado) {
  const id = Number(idEstado);
  if (ESTADOS_CANCELADOS.has(id)) {
    return 'programaciones-row programaciones-row--cancelada';
  }
  if (id === ID_ESTADO_ASISTIO) {
    return 'programaciones-row programaciones-row--asistio';
  }
  return 'programaciones-row';
}

function SortTh({ col, sortKey, sortDir, onSort }) {
  const active = sortKey === col.key;
  return (
    <th
      aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button type="button" className="programaciones-sort" onClick={() => onSort(col.key)}>
        {col.label}
        {active ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
      </button>
    </th>
  );
}

function EstadoSelect({ cita, estados, saving, onChange }) {
  const actual = Number(cita.idEstado);
  const opciones = [...estados];
  if (
    Number.isFinite(actual) &&
    actual > 0 &&
    !opciones.some((e) => e.idEstado === actual)
  ) {
    opciones.unshift({
      idEstado: actual,
      estado: cita.estado || `Estado ${actual}`,
    });
  }
  return (
    <select
      className="programaciones-estado"
      value={Number.isFinite(actual) && actual > 0 ? String(actual) : ''}
      disabled={saving}
      aria-label="Estado de la cita"
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => {
        e.stopPropagation();
        const id = Number(e.target.value);
        if (!Number.isFinite(id) || id === actual) return;
        void onChange(cita, id);
      }}
    >
      {opciones.map((e) => (
        <option key={e.idEstado} value={e.idEstado}>
          {e.estado}
        </option>
      ))}
    </select>
  );
}

export default function ProgramacionesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { documentoEmpresa } = useCompany();
  const [fecha, setFecha] = useState(() => {
    const fromState = String(location.state?.fecha ?? '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(fromState)) return fromState;
    return getStoredAgendaFecha() || ymdLocal(new Date());
  });
  const [citas, setCitas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortKey, setSortKey] = useState('profesional');
  const [sortDir, setSortDir] = useState('asc');
  const [estados, setEstados] = useState([]);
  const [savingId, setSavingId] = useState(null);

  const esHoy = fecha === ymdLocal(new Date());

  useEffect(() => {
    setStoredAgendaFecha(fecha);
  }, [fecha]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const rows = await fetchAgendaEstadosCita();
        if (!cancel) setEstados(Array.isArray(rows) ? rows : []);
      } catch {
        if (!cancel) setEstados([]);
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    let cancel = false;
    (async () => {
      if (!documentoEmpresa) {
        setCitas([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const data = await fetchAgendaCitas(fecha, documentoEmpresa);
        if (!cancel) {
          setCitas(Array.isArray(data?.citas) ? data.citas : []);
        }
      } catch (e) {
        if (!cancel) {
          setCitas([]);
          setError(
            await messageFromAxiosError(e, 'No se pudieron cargar las citas'),
          );
        }
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [fecha, documentoEmpresa]);

  const agrupado = sortKey === 'profesional';

  const filasPlanas = useMemo(() => {
    const rows = [...citas];
    const dir = sortDir === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      const va = {
        profesional: String(a.nombreProfesional ?? ''),
        paciente: String(a.nombrePaciente ?? ''),
        telefono: String(a.telefonoPaciente ?? ''),
        hora: hmToMinutes(a.hora),
        estado: String(a.estado ?? ''),
        motivo: String(a.motivo ?? ''),
        tipo: String(a.tipoCompromiso ?? ''),
      }[sortKey];
      const vb = {
        profesional: String(b.nombreProfesional ?? ''),
        paciente: String(b.nombrePaciente ?? ''),
        telefono: String(b.telefonoPaciente ?? ''),
        hora: hmToMinutes(b.hora),
        estado: String(b.estado ?? ''),
        motivo: String(b.motivo ?? ''),
        tipo: String(b.tipoCompromiso ?? ''),
      }[sortKey];
      if (typeof va === 'number' && typeof vb === 'number') {
        return (va - vb) * dir;
      }
      return String(va).localeCompare(String(vb), 'es') * dir;
    });
    return rows;
  }, [citas, sortKey, sortDir]);

  const grupos = useMemo(() => {
    const map = new Map();
    const ordered = [...citas].sort((a, b) => {
      const np = String(a.nombreProfesional ?? '').localeCompare(
        String(b.nombreProfesional ?? ''),
        'es',
      );
      if (np !== 0) return np * (sortDir === 'asc' ? 1 : -1);
      return (hmToMinutes(a.hora) - hmToMinutes(b.hora)) * (sortDir === 'asc' ? 1 : -1);
    });
    for (const cita of ordered) {
      const key = String(cita.documentoProfesional ?? '').trim() || '—';
      if (!map.has(key)) {
        map.set(key, {
          nombre: cita.nombreProfesional || key,
          citas: [],
        });
      }
      map.get(key).citas.push(cita);
    }
    return [...map.values()];
  }, [citas, sortDir]);

  function onSort(key) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDir('asc');
  }

  function goHc(documentoPaciente, cancelada) {
    if (cancelada) return;
    const doc = String(documentoPaciente ?? '').trim();
    if (!doc) return;
    setStoredHcDocumento(doc);
    navigate('/principal/evolucion', { state: { documentoPaciente: doc } });
  }

  async function cambiarEstado(cita, idEstado) {
    setSavingId(cita.idCita);
    setError('');
    try {
      const data = await updateAgendaCitaEstado(cita.idCita, idEstado);
      setCitas((prev) =>
        prev.map((c) =>
          c.idCita === cita.idCita
            ? {
                ...c,
                idEstado: data.idEstado,
                estado: data.estado,
              }
            : c,
        ),
      );
    } catch (e) {
      setError(
        await messageFromAxiosError(e, 'No se pudo cambiar el estado'),
      );
    } finally {
      setSavingId(null);
    }
  }

  const vacio = agrupado ? grupos.length === 0 : filasPlanas.length === 0;

  return (
    <div className="page programaciones-page">
      <header className="agenda-topbar">
        <div className="agenda-topbar-left">
          <div className="agenda-brand">Programaciones</div>
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
          <button
            type="button"
            className="agenda-today-btn"
            onClick={() =>
              navigate('/principal/agenda', { state: { fecha } })
            }
          >
            Calendario
          </button>
          <input
            className="agenda-date-input"
            type="date"
            value={fecha}
            onChange={(e) => {
              if (e.target.value) setFecha(e.target.value);
            }}
            aria-label="Fecha"
          />
        </div>
      </header>

      {error ? <div className="alert alert-error">{error}</div> : null}

      {loading ? (
        <p className="muted">Cargando programaciones…</p>
      ) : vacio ? (
        <p className="muted">No hay citas este día para la empresa seleccionada.</p>
      ) : (
        <div className="programaciones-table-wrap">
          <table className="programaciones-table">
            <thead>
              <tr>
                {SORT_COLS.map((col) => (
                  <SortTh
                    key={col.key}
                    col={col}
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={onSort}
                  />
                ))}
              </tr>
            </thead>
            <tbody>
              {agrupado
                ? grupos.map((grupo) =>
                    grupo.citas.map((cita, i) => {
                      const cancelada = ESTADOS_CANCELADOS.has(
                        Number(cita.idEstado),
                      );
                      return (
                        <tr
                          key={cita.idCita}
                          className={rowClassForEstado(cita.idEstado)}
                          onDoubleClick={() =>
                            goHc(cita.documentoPaciente, cancelada)
                          }
                        >
                          {i === 0 ? (
                            <td
                              className="programaciones-pro"
                              rowSpan={grupo.citas.length}
                              onDoubleClick={(e) => e.stopPropagation()}
                            >
                              {grupo.nombre}
                            </td>
                          ) : null}
                          <td>{cita.nombrePaciente || '—'}</td>
                          <td>{cita.telefonoPaciente || '—'}</td>
                          <td>{formatHora12(cita.hora)}</td>
                          <td className="programaciones-estado-cell">
                            <EstadoSelect
                              cita={cita}
                              estados={estados}
                              saving={savingId === cita.idCita}
                              onChange={cambiarEstado}
                            />
                          </td>
                          <td>{cita.motivo || '—'}</td>
                          <td>{cita.tipoCompromiso || '—'}</td>
                        </tr>
                      );
                    }),
                  )
                : filasPlanas.map((cita) => {
                    const cancelada = ESTADOS_CANCELADOS.has(
                      Number(cita.idEstado),
                    );
                    return (
                      <tr
                        key={cita.idCita}
                        className={rowClassForEstado(cita.idEstado)}
                        onDoubleClick={() =>
                          goHc(cita.documentoPaciente, cancelada)
                        }
                      >
                        <td>{cita.nombreProfesional || '—'}</td>
                        <td>{cita.nombrePaciente || '—'}</td>
                        <td>{cita.telefonoPaciente || '—'}</td>
                        <td>{formatHora12(cita.hora)}</td>
                        <td className="programaciones-estado-cell">
                          <EstadoSelect
                            cita={cita}
                            estados={estados}
                            saving={savingId === cita.idCita}
                            onChange={cambiarEstado}
                          />
                        </td>
                        <td>{cita.motivo || '—'}</td>
                        <td>{cita.tipoCompromiso || '—'}</td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
