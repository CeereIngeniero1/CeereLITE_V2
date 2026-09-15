import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  createAgendaCita,
  fetchAgendaCitas,
  fetchAgendaProcedimientos,
  fetchAgendaTiposCompromiso,
  fetchPacienteDatos,
  fetchUsers,
  messageFromAxiosError,
  updateAgendaCita,
} from '../api/client';
import { PatientEditModal } from '../components/PatientEditModal';
import { useCompany } from '../auth/CompanyContext';

const ESTADOS_CANCELADOS = new Set([60, 61, 64, 71]);
const SLOT_INICIO = 6 * 60;
const SLOT_PASO = 5;
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

function addMinutesHm(hm, add) {
  const start = hmToMinutes(hm);
  if (start == null) return hm;
  return minutesToHm(Math.min(start + add, 23 * 60 + 59));
}

function sumaTiempos(procedimientos) {
  return (procedimientos ?? []).reduce(
    (acc, p) => acc + (Number(p.tiempoMinutos) || 0),
    0,
  );
}

function formatFechaCorta(iso) {
  const s = String(iso ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return iso || '—';
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
}

function buildHourLabels() {
  const labels = [];
  const startHour = Math.ceil(SLOT_INICIO / 60);
  for (let h = startHour; h * 60 <= GRID_FIN; h += 1) {
    const min = h * 60;
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

function citasDeProfesional(citas, documento) {
  const doc = String(documento ?? '').trim();
  return citas.filter(
    (c) => (String(c.documentoProfesional ?? '').trim() || '—') === doc,
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

function FichaCampo({ label, value }) {
  return (
    <label className="agenda-ficha-field">
      <span>{label}</span>
      <input className="hc-input" readOnly value={value || ''} />
    </label>
  );
}

function TablaProcedimientos({ rows, onQuitar, onTiempoChange }) {
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
                <td>
                  {onTiempoChange ? (
                    <input
                      className="hc-input agenda-proc-tiempo"
                      type="number"
                      min={0}
                      step={5}
                      value={p.tiempoMinutos ?? 0}
                      onChange={(e) =>
                        onTiempoChange(
                          p.codigo,
                          Math.max(0, Number(e.target.value) || 0),
                        )
                      }
                    />
                  ) : (
                    p.tiempoMinutos ?? 0
                  )}
                </td>
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
  citaInicial,
  onClose,
  onCreated,
}) {
  const esEdicion = Boolean(citaInicial?.idCita);
  const [fechaCita, setFechaCita] = useState(
    () => citaInicial?.fecha || fecha,
  );
  const [horaCita, setHoraCita] = useState(
    () => (citaInicial?.hora || horaInicio || '').slice(0, 5),
  );
  const [horaFin, setHoraFin] = useState(
    () => (citaInicial?.horaFin || '').slice(0, 5),
  );
  const [pacientes, setPacientes] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [documentoPaciente, setDocumentoPaciente] = useState(
    () => citaInicial?.documentoPaciente || '',
  );
  const [datosPaciente, setDatosPaciente] = useState(null);
  const [loadingFicha, setLoadingFicha] = useState(false);
  const [qProc, setQProc] = useState('');
  const [catalogoProc, setCatalogoProc] = useState([]);
  const [seleccionados, setSeleccionados] = useState(() =>
    Array.isArray(citaInicial?.procedimientos)
      ? citaInicial.procedimientos
      : [],
  );
  const [motivo, setMotivo] = useState(() => citaInicial?.motivo || '');
  const defaultTipo = tipos.some((t) => t.idTipoCompromiso === 2)
    ? 2
    : (tipos[0]?.idTipoCompromiso ?? 2);
  const [idTipo, setIdTipo] = useState(
    () => citaInicial?.idTipoCompromiso || defaultTipo,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editPaciente, setEditPaciente] = useState(false);

  function aplicarSumaSiHay(rows, inicioHm = horaCita) {
    const sum = sumaTiempos(rows);
    if (sum > 0) setHoraFin(addMinutesHm(inicioHm, sum));
  }

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
      const next = [...prev, p];
      aplicarSumaSiHay(next);
      return next;
    });
  }

  function quitarProc(codigo) {
    setSeleccionados((prev) => {
      const next = prev.filter((x) => x.codigo !== codigo);
      aplicarSumaSiHay(next);
      return next;
    });
  }

  function cambiarTiempoProc(codigo, minutos) {
    setSeleccionados((prev) => {
      const next = prev.map((x) =>
        x.codigo === codigo ? { ...x, tiempoMinutos: minutos } : x,
      );
      aplicarSumaSiHay(next);
      return next;
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
    const horaInicio =
      horaCita.length === 5 ? horaCita : horaCita.slice(0, 5);
    const horaFinEnvio = (horaFin || '').slice(0, 5);
    const iniMin = hmToMinutes(horaInicio);
    const finMin = hmToMinutes(horaFinEnvio);
    if (iniMin == null) {
      setError('Indique la hora de inicio.');
      return;
    }
    if (finMin == null || finMin <= iniMin) {
      setError('La hora de fin debe ser posterior a la de inicio.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        documentoPaciente,
        documentoProfesional: profesional.documento,
        fecha: fechaCita,
        horaInicio,
        horaFin: horaFinEnvio,
        motivo: motivoFinal,
        idTipoCompromiso: Number(idTipo),
        codigosObjeto: seleccionados.map((p) => p.codigo),
        documentoEmpresa: documentoEmpresa || undefined,
      };
      if (esEdicion) {
        await updateAgendaCita(citaInicial.idCita, payload);
      } else {
        await createAgendaCita(payload);
      }
      onCreated(fechaCita);
    } catch (e) {
      setError(
        await messageFromAxiosError(
          e,
          esEdicion ? 'No se pudo guardar la cita' : 'No se pudo crear la cita',
        ),
      );
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
            <h2 id="agenda-cita-title">
              {esEdicion ? 'Editar cita' : 'Nueva cita'}
            </h2>
            <p className="muted" style={{ margin: '0.25rem 0 0' }}>
              {profesional.nombre}
              {` · ${fechaCita} · ${horaCita}–${horaFin}`}
            </p>
          </div>
          <button type="button" className="btn-outline" onClick={onClose}>
            Cerrar
          </button>
        </header>
        <div className="modal-body">
          {error && <div className="alert alert-error">{error}</div>}

          <div className="agenda-cuando-row">
            <label className="hc-field">
              <span className="hc-field-label">Fecha</span>
              <input
                className="hc-input"
                type="date"
                value={fechaCita}
                onChange={(e) => {
                  if (e.target.value) setFechaCita(e.target.value);
                }}
              />
            </label>
            <label className="hc-field">
              <span className="hc-field-label">Hora inicio</span>
              <input
                className="hc-input"
                type="time"
                step={300}
                value={horaCita}
                onChange={(e) => {
                  const v = e.target.value.slice(0, 5);
                  if (!v) return;
                  setHoraCita(v);
                  aplicarSumaSiHay(seleccionados, v);
                }}
              />
            </label>
            <label className="hc-field">
              <span className="hc-field-label">Hora fin</span>
              <input
                className="hc-input"
                type="time"
                step={300}
                value={horaFin}
                onChange={(e) => {
                  if (e.target.value) setHoraFin(e.target.value.slice(0, 5));
                }}
              />
            </label>
          </div>

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
            onQuitar={quitarProc}
            onTiempoChange={cambiarTiempoProc}
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
              {saving ? 'Guardando…' : esEdicion ? 'Guardar' : 'Agendar'}
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
  const [fecha, setFecha] = useState(() => ymdLocal(new Date()));
  const [citas, setCitas] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [filtroProf, setFiltroProf] = useState('');
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

  async function loadCitas(opts = {}) {
    if (!documentoEmpresa) {
      setCitas([]);
      if (!opts.silent) setLoading(false);
      return;
    }
    if (!opts.silent) setLoading(true);
    setError('');
    try {
      const data = await fetchAgendaCitas(fecha, documentoEmpresa);
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
    void loadCitas();
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

  const profesionalesDelDia = useMemo(() => {
    const byDoc = new Map();
    for (const c of citas) {
      const documento = String(c.documentoProfesional ?? '').trim() || '—';
      if (!byDoc.has(documento)) {
        byDoc.set(documento, {
          documento,
          nombre: c.nombreProfesional || documento,
        });
      }
    }
    return [...byDoc.values()].sort((a, b) =>
      a.nombre.localeCompare(b.nombre, 'es'),
    );
  }, [citas]);

  useEffect(() => {
    if (
      filtroProf &&
      !profesionalesDelDia.some((p) => p.documento === filtroProf)
    ) {
      setFiltroProf('');
    }
  }, [profesionalesDelDia, filtroProf]);

  const columnas = useMemo(() => {
    if (filtroProf) {
      return profesionalesDelDia.filter((c) => c.documento === filtroProf);
    }
    return profesionalesDelDia;
  }, [profesionalesDelDia, filtroProf]);

  const nowTop =
    esHoy && nowMin >= SLOT_INICIO && nowMin <= GRID_FIN
      ? ((nowMin - SLOT_INICIO) / SLOT_PASO) * SLOT_PX
      : null;

  function abrirNuevaCita(col, clientY, columnEl) {
    const rect = columnEl.getBoundingClientRect();
    const y = clientY - rect.top;
    const slotsFromTop = Math.floor(y / SLOT_PX);
    const minutes = SLOT_INICIO + slotsFromTop * SLOT_PASO;
    if (minutes < SLOT_INICIO || minutes >= GRID_FIN) return;
    setModal({
      horaInicio: minutesToHm(minutes),
      profesional: {
        documento: col.documento,
        nombre: col.nombre,
      },
    });
  }

  function modalDesdeCita(cita) {
    return {
      cita: { ...cita, fecha },
      profesional: {
        documento: cita.documentoProfesional,
        nombre: cita.nombreProfesional || cita.documentoProfesional,
      },
      horaInicio: cita.hora,
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
            value={filtroProf}
            onChange={(e) => setFiltroProf(e.target.value)}
            aria-label="Profesional"
          >
            <option value="">Todos</option>
            {profesionalesDelDia.map((p) => (
              <option key={p.documento} value={p.documento}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>
      </header>

      {error && <div className="alert alert-error">{error}</div>}

      {loading || !catalogReady ? (
        <p className="muted agenda-loading">Cargando citas…</p>
      ) : columnas.length === 0 ? (
        <p className="muted agenda-loading">
          No hay citas este día para la empresa seleccionada.
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
                const delDia = citasDeProfesional(citas, col.documento).filter(
                  (c) => !isCancelada(c),
                );
                const laid = layoutCitas(delDia);
                return (
                  <div
                    key={col.documento}
                    className="agenda-pro-col"
                    style={{ height: GRID_HEIGHT }}
                    onClick={(e) => {
                      if (e.target !== e.currentTarget) return;
                      abrirNuevaCita(col, e.clientY, e.currentTarget);
                    }}
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
                    {nowTop != null ? (
                      <div className="agenda-now-line" style={{ top: nowTop }} />
                    ) : null}
                    {laid.map(({ cita, index, total }) => {
                      const geo = blockGeometryPx(cita);
                      if (!geo) return null;
                      const color = oleToCss(cita.colorTipo) || 'var(--brand)';
                      const gap = 4;
                      return (
                        <div
                          key={cita.idCita}
                          className="agenda-cita-block"
                          role="button"
                          tabIndex={0}
                          style={{
                            top: geo.top,
                            height: Math.max(geo.height, 16),
                            width: `calc(${100 / total}% - ${gap}px)`,
                            left: `calc(${index * (100 / total)}% + ${gap / 2}px)`,
                            background:
                              oleSoftCss(cita.colorTipo) || 'var(--brand-soft)',
                            borderLeftColor: color,
                            color,
                          }}
                          onMouseEnter={(e) =>
                            showResumen(cita, e.currentTarget)
                          }
                          onMouseLeave={scheduleHideResumen}
                          onClick={(e) => {
                            e.stopPropagation();
                            setResumen(null);
                            setModal(modalDesdeCita(cita));
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              e.stopPropagation();
                              setModal(modalDesdeCita(cita));
                            }
                          }}
                        >
                          <div className="agenda-cita-time">
                            {cita.hora}
                            {cita.horaFin ? ` – ${cita.horaFin}` : ''}
                          </div>
                          <div className="agenda-cita-patient">
                            {cita.nombrePaciente || 'Paciente'}
                          </div>
                          <div className="agenda-cita-type">
                            {cita.tipoCompromiso || cita.motivo || ''}
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
            setModal(modalDesdeCita(cita));
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
              void loadCitas({ silent: true });
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
