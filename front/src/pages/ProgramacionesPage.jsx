import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { fetchAgendaCitas, messageFromAxiosError } from '../api/client';
import { useCompany } from '../auth/CompanyContext';

const ESTADOS_CANCELADOS = new Set([60, 61, 64, 71]);

const SORT_COLS = [
  { key: 'profesional', label: 'Profesional' },
  { key: 'paciente', label: 'Paciente' },
  { key: 'hora', label: 'Hora' },
  { key: 'estado', label: 'Estado' },
  { key: 'motivo', label: 'Motivo' },
  { key: 'tipo', label: 'Tipo' },
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

export default function ProgramacionesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { documentoEmpresa } = useCompany();
  const [fecha, setFecha] = useState(
    () => location.state?.fecha || ymdLocal(new Date()),
  );
  const [citas, setCitas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortKey, setSortKey] = useState('profesional');
  const [sortDir, setSortDir] = useState('asc');

  const esHoy = fecha === ymdLocal(new Date());

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
        hora: hmToMinutes(a.hora),
        estado: String(a.estado ?? ''),
        motivo: String(a.motivo ?? ''),
        tipo: String(a.tipoCompromiso ?? ''),
      }[sortKey];
      const vb = {
        profesional: String(b.nombreProfesional ?? ''),
        paciente: String(b.nombrePaciente ?? ''),
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
    navigate('/principal/evolucion', { state: { documentoPaciente: doc } });
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
                          className={
                            cancelada
                              ? 'programaciones-row programaciones-row--cancelada'
                              : 'programaciones-row'
                          }
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
                          <td>{formatHora12(cita.hora)}</td>
                          <td>{cita.estado || '—'}</td>
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
                        className={
                          cancelada
                            ? 'programaciones-row programaciones-row--cancelada'
                            : 'programaciones-row'
                        }
                        onDoubleClick={() =>
                          goHc(cita.documentoPaciente, cancelada)
                        }
                      >
                        <td>{cita.nombreProfesional || '—'}</td>
                        <td>{cita.nombrePaciente || '—'}</td>
                        <td>{formatHora12(cita.hora)}</td>
                        <td>{cita.estado || '—'}</td>
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
