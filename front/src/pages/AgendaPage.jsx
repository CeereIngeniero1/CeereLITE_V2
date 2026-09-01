import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  createAgendaCita,
  fetchAgendaCitas,
  fetchAgendaProcedimientos,
  fetchAgendaProfesionales,
  fetchAgendaTiposCompromiso,
  fetchCompanies,
  fetchPacienteDatos,
  fetchUsers,
  messageFromAxiosError,
} from '../api/client';
import { PatientEditModal } from '../components/PatientEditModal';

const ESTADOS_CANCELADOS = new Set([60, 61, 64, 71]);
const SLOT_INICIO = 7 * 60;
const SLOT_PASO = 5;
const GRID_FIN = 18 * 60 + 30;
const GRID_MINUTOS = GRID_FIN - SLOT_INICIO;
const DURACION_DEFAULT_MIN = 30;

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

function addMinutesHm(hm, add) {
  const start = hmToMinutes(hm);
  if (start == null) return hm;
  return minutesToHm(Math.min(start + add, 23 * 60 + 59));
}

function duracionMinutos(procedimientos) {
  const sum = (procedimientos ?? []).reduce(
    (acc, p) => acc + (Number(p.tiempoMinutos) || 0),
    0,
  );
  return sum > 0 ? sum : DURACION_DEFAULT_MIN;
}

function formatFechaCorta(iso) {
  const s = String(iso ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return iso || '—';
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
}

function buildSlots() {
  const slots = [];
  for (let m = SLOT_INICIO; m < GRID_FIN; m += SLOT_PASO) {
    slots.push(minutesToHm(m));
  }
  return slots;
}

function slotMinutesOfHour(slot) {
  const total = hmToMinutes(slot);
  return total == null ? 0 : total % 60;
}

const SLOTS = buildSlots();

function isCancelada(cita) {
  return ESTADOS_CANCELADOS.has(Number(cita?.idEstado));
}

function citasDeProfesional(citas, documento) {
  return citas.filter(
    (c) => String(c.documentoProfesional ?? '') === String(documento ?? ''),
  );
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

function textOnOle(n) {
  const rgb = oleToRgb(n);
  if (!rgb) return '#111';
  const y = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return y > 0.55 ? '#111' : '#fff';
}

function blockGeometry(cita) {
  const start = hmToMinutes(cita.hora);
  if (start == null) return null;
  let end = hmToMinutes(cita.horaFin);
  if (end == null || end <= start) end = start + SLOT_PASO;
  const a = Math.max(start, SLOT_INICIO);
  const b = Math.min(end, GRID_FIN);
  if (b <= a) return null;
  return {
    topPct: ((a - SLOT_INICIO) / GRID_MINUTOS) * 100,
    heightPct: ((b - a) / GRID_MINUTOS) * 100,
  };
}

function FichaCampo({ label, value }) {
  return (
    <label className="agenda-ficha-field">
      <span>{label}</span>
      <input className="hc-input" readOnly value={value || ''} />
    </label>
  );
}

function TablaProcedimientos({ rows, onQuitar }) {
  return (
    <div className="agenda-proc-table-wrap">
      <table className="agenda-proc-table">
        <thead>
          <tr>
            <th>Código</th>
            <th>Tiempo</th>
            <th>Unidad</th>
            <th>Descripción</th>
            {onQuitar ? <th /> : null}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((p) => (
              <tr key={p.codigo}>
                <td className="td-mono">{p.codigo}</td>
                <td>{p.tiempoMinutos ?? 0}</td>
                <td>{p.unidad || '—'}</td>
                <td>{p.descripcion || '—'}</td>
                {onQuitar ? (
                  <td>
                    <button
                      type="button"
                      className="btn-sm"
                      onClick={() => onQuitar(p.codigo)}
                    >
                      Quitar
                    </button>
                  </td>
                ) : null}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={onQuitar ? 5 : 4} className="muted">
                Ningún procedimiento seleccionado
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function FichaPacienteCita({
  datos,
  loading,
  sede,
  profesionalNombre,
  onActualizar,
}) {
  const d = datos?.demografia;
  const s = datos?.evolucionSnapshot;
  if (loading) {
    return <p className="muted">Cargando ficha…</p>;
  }
  if (!d) {
    return (
      <p className="muted">Seleccione un paciente para ver su información.</p>
    );
  }
  return (
    <div className="agenda-ficha">
      <div className="agenda-ficha-grid">
        <FichaCampo label="Documento" value={d.documentoPaciente} />
        <FichaCampo
          label="Tipo"
          value={d.tipoDocumentoBase || d.descripcionTipoDocumento}
        />
        <FichaCampo label="Historia" value={d.documentoPaciente} />
        <FichaCampo label="1er nombre" value={d.primerNombre} />
        <FichaCampo label="2do nombre" value={d.segundoNombre} />
        <FichaCampo label="1er apellido" value={d.primerApellido} />
        <FichaCampo label="2do apellido" value={d.segundoApellido} />
        <FichaCampo
          label="Nacido"
          value={formatFechaCorta(d.fechaNacimiento)}
        />
        <FichaCampo label="Sexo" value={d.sexo || d.sexoPaciente} />
        <FichaCampo
          label="Edad"
          value={d.edad != null ? `${d.edad} Año(s)` : ''}
        />
        <FichaCampo label="Usuario" value={s?.tipoAfiliado} />
        <FichaCampo label="Aseg" value={s?.nombreAseguradora} />
        <FichaCampo label="Sede" value={sede} />
        <FichaCampo label="Profesional" value={profesionalNombre} />
        <FichaCampo label="Dirección" value={d.direccion} />
        <FichaCampo
          label="Teléfono 1"
          value={s?.telefono1 || d.telefono}
        />
        <FichaCampo label="Celular" value={s?.celular || d.telefono} />
        <FichaCampo
          label="Zona"
          value={d.descripcionZonaResidencia || d.zonaResidencia}
        />
        <FichaCampo
          label="Municipio"
          value={d.nombreMunicipioResidencia}
        />
        <FichaCampo label="E-mail" value={s?.email} />
      </div>
      <div className="agenda-ficha-side">
        {d.fotoUrl ? (
          <img className="agenda-ficha-foto" src={d.fotoUrl} alt="" />
        ) : (
          <div className="agenda-ficha-foto agenda-ficha-foto--empty">
            Sin foto
          </div>
        )}
        <button type="button" className="btn-outline" onClick={onActualizar}>
          Actualizar paciente
        </button>
      </div>
    </div>
  );
}

function NuevaCitaModal({
  fecha,
  horaInicio,
  profesional,
  documentoEmpresa,
  nombreSede,
  tipos,
  onClose,
  onCreated,
}) {
  const [pacientes, setPacientes] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [documentoPaciente, setDocumentoPaciente] = useState('');
  const [datosPaciente, setDatosPaciente] = useState(null);
  const [loadingFicha, setLoadingFicha] = useState(false);
  const [qProc, setQProc] = useState('');
  const [catalogoProc, setCatalogoProc] = useState([]);
  const [seleccionados, setSeleccionados] = useState([]);
  const [motivo, setMotivo] = useState('');
  const defaultTipo = tipos.some((t) => t.idTipoCompromiso === 2)
    ? 2
    : (tipos[0]?.idTipoCompromiso ?? 2);
  const [idTipo, setIdTipo] = useState(defaultTipo);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editPaciente, setEditPaciente] = useState(false);

  const horaFin = addMinutesHm(horaInicio, duracionMinutos(seleccionados));

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const rows = await fetchUsers();
        if (!cancel) setPacientes(Array.isArray(rows) ? rows : []);
      } catch {
        if (!cancel) setPacientes([]);
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    let cancel = false;
    const t = setTimeout(() => {
      (async () => {
        try {
          const rows = await fetchAgendaProcedimientos(qProc.trim());
          if (!cancel) setCatalogoProc(Array.isArray(rows) ? rows : []);
        } catch {
          if (!cancel) setCatalogoProc([]);
        }
      })();
    }, 250);
    return () => {
      cancel = true;
      clearTimeout(t);
    };
  }, [qProc]);

  useEffect(() => {
    if (!documentoPaciente) {
      setDatosPaciente(null);
      return undefined;
    }
    let cancel = false;
    setLoadingFicha(true);
    (async () => {
      try {
        const data = await fetchPacienteDatos(documentoPaciente);
        if (!cancel) setDatosPaciente(data ?? null);
      } catch {
        if (!cancel) setDatosPaciente(null);
      } finally {
        if (!cancel) setLoadingFicha(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [documentoPaciente]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape' && !saving && !editPaciente) onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, saving, editPaciente]);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return pacientes.slice(0, 40);
    return pacientes
      .filter((p) => {
        const name = (p.name ?? '').toLowerCase();
        const id = (p.id ?? '').toLowerCase();
        const id2 = (p.id2 ?? '').toLowerCase();
        return name.includes(q) || id.includes(q) || id2.includes(q);
      })
      .slice(0, 40);
  }, [pacientes, busqueda]);

  const seleccionado = pacientes.find((p) => p.id === documentoPaciente);
  const tipoSel = tipos.find((t) => t.idTipoCompromiso === Number(idTipo));

  function addProc(p) {
    const codigo = String(p.codigo ?? '').trim();
    if (!codigo) return;
    setSeleccionados((prev) => {
      if (prev.some((x) => x.codigo === codigo)) return prev;
      return [...prev, p];
    });
  }

  async function guardar() {
    if (!documentoPaciente) {
      setError('Seleccione un paciente.');
      return;
    }
    const motivoFinal =
      motivo.trim() ||
      seleccionados.map((p) => p.descripcion || p.codigo).join(', ');
    if (!motivoFinal) {
      setError('Indique el motivo o seleccione un procedimiento.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await createAgendaCita({
        documentoPaciente,
        documentoProfesional: profesional.documento,
        fecha,
        horaInicio,
        horaFin,
        motivo: motivoFinal,
        idTipoCompromiso: Number(idTipo),
        codigosObjeto: seleccionados.map((p) => p.codigo),
        documentoEmpresa: documentoEmpresa || undefined,
      });
      onCreated();
    } catch (e) {
      setError(await messageFromAxiosError(e, 'No se pudo crear la cita'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-dialog confirm-dialog agenda-cita-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="agenda-cita-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <div>
            <p className="page-eyebrow">Agenda</p>
            <h2 id="agenda-cita-title">Nueva cita</h2>
            <p className="muted" style={{ margin: '0.25rem 0 0' }}>
              {profesional.nombre} · {fecha} · {horaInicio}–{horaFin}
            </p>
          </div>
          <button type="button" className="btn-outline" onClick={onClose}>
            Cerrar
          </button>
        </header>
        <div className="modal-body">
          {error && <div className="alert alert-error">{error}</div>}

          <h3 className="agenda-section-title">Procedimientos</h3>
          <label className="hc-field">
            <span className="hc-field-label">Buscar procedimiento</span>
            <input
              className="hc-input"
              type="search"
              placeholder="Código o descripción"
              value={qProc}
              onChange={(e) => setQProc(e.target.value)}
            />
          </label>
          <div className="agenda-proc-list">
            {catalogoProc.map((p) => (
              <button
                key={p.codigo}
                type="button"
                className="agenda-paciente-item"
                onClick={() => addProc(p)}
              >
                <span>
                  <span className="td-mono">{p.codigo}</span>
                  {` · ${p.descripcion || ''}`}
                </span>
                <span className="muted">{p.tiempoMinutos ?? 0} min</span>
              </button>
            ))}
            {!catalogoProc.length && (
              <p className="muted">No hay procedimientos para esa búsqueda.</p>
            )}
          </div>
          <TablaProcedimientos
            rows={seleccionados}
            onQuitar={(codigo) =>
              setSeleccionados((prev) => prev.filter((x) => x.codigo !== codigo))
            }
          />

          <h3 className="agenda-section-title">Paciente</h3>
          <div className="agenda-paciente-layout">
            <div>
              <label className="hc-field">
                <span className="hc-field-label">Buscar paciente</span>
                <input
                  className="hc-input"
                  type="search"
                  placeholder="Nombre o documento"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                />
              </label>
              <div className="agenda-paciente-list">
                {filtrados.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={
                      documentoPaciente === p.id
                        ? 'agenda-paciente-item is-selected'
                        : 'agenda-paciente-item'
                    }
                    onClick={() => setDocumentoPaciente(p.id)}
                  >
                    <span>{p.name || p.id}</span>
                    <span className="muted td-mono">{p.id2 || p.id}</span>
                  </button>
                ))}
                {!filtrados.length && (
                  <p className="muted">No hay pacientes para esa búsqueda.</p>
                )}
              </div>
            </div>
            <FichaPacienteCita
              datos={datosPaciente}
              loading={loadingFicha}
              sede={nombreSede}
              profesionalNombre={profesional.nombre}
              onActualizar={() => {
                if (documentoPaciente) setEditPaciente(true);
              }}
            />
          </div>

          <label className="hc-field">
            <span className="hc-field-label">Motivo</span>
            <input
              className="hc-input"
              type="text"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Si lo deja vacío se usan los procedimientos"
            />
          </label>
          <label className="hc-field">
            <span className="hc-field-label">Tipo de compromiso</span>
            <span className="agenda-tipo-row">
              <select
                className="hc-input"
                value={idTipo}
                onChange={(e) => setIdTipo(Number(e.target.value))}
              >
                {tipos.map((t) => (
                  <option key={t.idTipoCompromiso} value={t.idTipoCompromiso}>
                    {t.tipoCompromiso}
                  </option>
                ))}
              </select>
              <span
                className="agenda-tipo-swatch"
                style={{
                  background: oleToCss(tipoSel?.colorTipo) || '#ccc',
                }}
                title={tipoSel?.tipoCompromiso || ''}
              />
            </span>
          </label>
          <div className="confirm-actions">
            <button
              type="button"
              className="secondary"
              onClick={onClose}
              disabled={saving}
            >
              Cancelar
            </button>
            <button type="button" onClick={() => void guardar()} disabled={saving}>
              {saving ? 'Guardando…' : 'Agendar'}
            </button>
          </div>
        </div>
      </div>
      {editPaciente && documentoPaciente ? (
        <div role="presentation" onClick={(e) => e.stopPropagation()}>
          <PatientEditModal
            documentoPaciente={documentoPaciente}
            nombrePaciente={seleccionado?.name || documentoPaciente}
            onClose={() => setEditPaciente(false)}
            onSaved={async () => {
              try {
                const data = await fetchPacienteDatos(documentoPaciente);
                setDatosPaciente(data ?? null);
              } catch {
                /* ficha queda como estaba */
              }
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

function CitaResumenPopover({
  cita,
  anchor,
  onClose,
  onKeep,
  onEvolucionar,
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
  const [fecha, setFecha] = useState(() => ymdLocal(new Date()));
  const [citas, setCitas] = useState([]);
  const [profesionales, setProfesionales] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [filtroProf, setFiltroProf] = useState('');
  const [docEmpresa, setDocEmpresa] = useState('');
  const [nombreSede, setNombreSede] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [resumen, setResumen] = useState(null);
  const [editPaciente, setEditPaciente] = useState(null);
  const hideResumenTimer = useRef(null);

  const esHoy = fecha === ymdLocal(new Date());

  async function loadCitas(opts = {}) {
    if (!opts.silent) setLoading(true);
    setError('');
    try {
      const data = await fetchAgendaCitas(fecha);
      setCitas(Array.isArray(data?.citas) ? data.citas : []);
    } catch (e) {
      setCitas([]);
      setError(await messageFromAxiosError(e, 'No se pudieron cargar las citas'));
    } finally {
      if (!opts.silent) setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [profs, companies, tiposRows] = await Promise.all([
          fetchAgendaProfesionales(),
          fetchCompanies(),
          fetchAgendaTiposCompromiso(),
        ]);
        if (cancelled) return;
        setProfesionales(Array.isArray(profs) ? profs : []);
        setTipos(Array.isArray(tiposRows) ? tiposRows : []);
        const coArr = Array.isArray(companies) ? companies : [];
        const first = coArr[0];
        setDocEmpresa((prev) => prev || (first?.documentoEmpresa ?? ''));
        setNombreSede(first?.nombreComercialEmpresa ?? '');
      } catch {
        /* catálogos opcionales */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void loadCitas();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recargar al cambiar fecha
  }, [fecha]);

  const columnas = useMemo(() => {
    if (filtroProf) {
      const p = profesionales.find(
        (x) => x.documentoProfesional === filtroProf,
      );
      return [
        {
          documento: filtroProf,
          nombre: p?.nombreProfesional || filtroProf,
        },
      ];
    }
    const map = new Map();
    for (const c of citas) {
      const doc = String(c.documentoProfesional ?? '').trim();
      if (!doc || map.has(doc)) continue;
      map.set(doc, {
        documento: doc,
        nombre: c.nombreProfesional || doc,
      });
    }
    return [...map.values()];
  }, [filtroProf, profesionales, citas]);

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
      <header className="usuarios-header">
        <div>
          <p className="page-eyebrow">Consultorio</p>
          <h1>Agenda</h1>
          <p className="muted">{formatDiaLargo(fecha)}</p>
        </div>
      </header>

      <div className="agenda-toolbar">
        <button
          type="button"
          className="btn-outline"
          onClick={() => setFecha((f) => addDays(f, -1))}
        >
          Anterior
        </button>
        <label className="agenda-date-label">
          Fecha
          <input
            type="date"
            value={fecha}
            onChange={(e) => {
              if (e.target.value) setFecha(e.target.value);
            }}
          />
        </label>
        <button
          type="button"
          className="btn-outline"
          onClick={() => setFecha((f) => addDays(f, 1))}
        >
          Siguiente
        </button>
        <button
          type="button"
          className="btn-outline"
          disabled={esHoy}
          onClick={() => setFecha(ymdLocal(new Date()))}
        >
          Hoy
        </button>
        <label className="agenda-date-label">
          Profesional
          <select
            value={filtroProf}
            onChange={(e) => setFiltroProf(e.target.value)}
          >
            <option value="">Todos</option>
            {profesionales.map((p) => (
              <option
                key={p.documentoProfesional}
                value={p.documentoProfesional}
              >
                {p.nombreProfesional}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <p className="muted">Cargando citas…</p>
      ) : columnas.length === 0 ? (
        <p className="muted">
          No hay citas en este día. Elija un profesional para agendar.
        </p>
      ) : (
        <div className="agenda-grid-wrap">
          <div className="agenda-day">
            <div className="agenda-times">
              <div className="agenda-col-head">Hora</div>
              <div
                className="agenda-col-body"
                style={{
                  height: `calc(var(--agenda-slot-h) * ${SLOTS.length})`,
                }}
              >
                {SLOTS.map((slot) => {
                  const min = slotMinutesOfHour(slot);
                  const isHour = min === 0;
                  const isQuarter = min % 15 === 0;
                  return (
                    <div
                      key={slot}
                      className={
                        isHour
                          ? 'agenda-time-label agenda-time-label--hour'
                          : isQuarter
                            ? 'agenda-time-label agenda-time-label--quarter'
                            : 'agenda-time-label'
                      }
                    >
                      {isQuarter ? slot : ''}
                    </div>
                  );
                })}
              </div>
            </div>
            {columnas.map((col) => {
              const delDia = citasDeProfesional(citas, col.documento).filter(
                (c) => !isCancelada(c),
              );
              return (
                <div key={col.documento} className="agenda-col">
                  <div className="agenda-col-head">
                    {col.nombre}
                    <div className="muted agenda-profesional-doc">
                      {col.documento}
                    </div>
                  </div>
                  <div
                    className="agenda-col-body"
                    style={{
                      height: `calc(var(--agenda-slot-h) * ${SLOTS.length})`,
                    }}
                  >
                    {SLOTS.map((slot) => {
                      const min = slotMinutesOfHour(slot);
                      const slotClass = [
                        'agenda-slot',
                        'agenda-slot--empty',
                        min === 0 ? 'agenda-slot--hour' : '',
                        min % 15 === 0 ? 'agenda-slot--quarter' : '',
                      ]
                        .filter(Boolean)
                        .join(' ');
                      return (
                        <button
                          key={slot}
                          type="button"
                          className={slotClass}
                          title={`Agendar ${slot}`}
                          aria-label={`Agendar ${slot}`}
                          onClick={() =>
                            setModal({
                              horaInicio: slot,
                              profesional: col,
                            })
                          }
                        >
                          Agendar
                        </button>
                      );
                    })}
                    {delDia.map((cita) => {
                      const geo = blockGeometry(cita);
                      if (!geo) return null;
                      const bg = oleToCss(cita.colorTipo);
                      const fg = textOnOle(cita.colorTipo);
                      return (
                        <div
                          key={cita.idCita}
                          className="agenda-cita-block"
                          style={{
                            top: `${geo.topPct}%`,
                            height: `${geo.heightPct}%`,
                            background:
                              bg ||
                              'color-mix(in srgb, var(--brand) 18%, var(--surface-card))',
                            color: fg,
                          }}
                          onMouseEnter={(e) =>
                            showResumen(cita, e.currentTarget)
                          }
                          onMouseLeave={scheduleHideResumen}
                        >
                          <strong>{cita.nombrePaciente || 'Paciente'}</strong>
                          <span>
                            {cita.hora}
                            {cita.horaFin ? `–${cita.horaFin}` : ''}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
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
          horaInicio={modal.horaInicio}
          profesional={modal.profesional}
          documentoEmpresa={docEmpresa}
          nombreSede={nombreSede}
          tipos={tipos}
          onClose={() => setModal(null)}
          onCreated={() => {
            setModal(null);
            void loadCitas({ silent: true });
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
