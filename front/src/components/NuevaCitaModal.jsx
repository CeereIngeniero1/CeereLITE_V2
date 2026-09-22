import { useEffect, useState } from 'react';
import {
  createAgendaCita,
  fetchAgendaCitasPaciente,
  fetchAgendaPacientes,
  fetchAgendaProcedimientos,
  fetchPacienteDatos,
  messageFromAxiosError,
  updateAgendaCita,
} from '../api/client';
import { AgendaDisponibilidadPanel } from './AgendaDisponibilidadPanel';
import { AgendaHistorialPrintModal } from './AgendaHistorialPrintModal';
import { PatientEditModal } from './PatientEditModal';
import { TabPanel, Tabs } from './Tabs';

const CITA_TABS = [
  { id: 'cita', label: 'Cita' },
  { id: 'control', label: 'Control y citas' },
  { id: 'disponibilidad', label: 'Disponibilidad' },
];

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
    .match(/^(\d{1,2}):(\d{2})$/);
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

function formatHora12(hm) {
  const min = hmToMinutes(hm);
  if (min == null) return hm || '—';
  const h24 = Math.floor(min / 60);
  const mm = String(min % 60).padStart(2, '0');
  const suf = h24 >= 12 ? 'p. m.' : 'a. m.';
  const h12 = h24 % 12 || 12;
  return `${h12}:${mm} ${suf}`;
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

const ESTADOS_CANCELADOS = new Set([60, 61, 62, 63, 64, 71]);
const ID_ESTADO_ASISTIO = 59;

function rowClassForEstado(idEstado) {
  const id = Number(idEstado);
  if (ESTADOS_CANCELADOS.has(id)) {
    return 'agenda-historial-row agenda-historial-row--cancelada';
  }
  if (id === ID_ESTADO_ASISTIO) {
    return 'agenda-historial-row agenda-historial-row--asistio';
  }
  return 'agenda-historial-row';
}

function oleToCss(n) {
  const rgb = oleToRgb(n);
  if (!rgb) return null;
  return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
}

function FichaCampo({ label, value }) {
  return (
    <label className="agenda-ficha-field">
      <span>{label}</span>
      <input className="hc-input" readOnly value={value || ''} />
    </label>
  );
}

export function TablaProcedimientos({ rows, onQuitar, onTiempoChange }) {
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
        <FichaCampo label="Teléfono 1" value={s?.telefono1 || d.telefono} />
        <FichaCampo label="Celular" value={s?.celular || d.telefono} />
        <FichaCampo
          label="Zona"
          value={d.descripcionZonaResidencia || d.zonaResidencia}
        />
        <FichaCampo label="Municipio" value={d.nombreMunicipioResidencia} />
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

export function NuevaCitaModal({
  fecha,
  horaInicio,
  profesional,
  documentoEspacio,
  nombreEspacio,
  documentoEmpresa,
  nombreSede,
  tipos,
  citaInicial,
  onClose,
  onCreated,
}) {
  const esEdicion = Boolean(citaInicial?.idCita);
  const [tab, setTab] = useState('cita');
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
  const [busqueda, setBusqueda] = useState(
    () => String(citaInicial?.documentoPaciente || '').trim(),
  );
  const [loadingPacientes, setLoadingPacientes] = useState(true);
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
  const [historial, setHistorial] = useState([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);
  const [printHistorial, setPrintHistorial] = useState(false);

  function aplicarSumaSiHay(rows, inicioHm = horaCita) {
    const sum = sumaTiempos(rows);
    if (sum > 0) setHoraFin(addMinutesHm(inicioHm, sum));
  }

  useEffect(() => {
    let cancel = false;
    const t = setTimeout(() => {
      (async () => {
        setLoadingPacientes(true);
        try {
          const rows = await fetchAgendaPacientes(busqueda.trim());
          if (!cancel) setPacientes(Array.isArray(rows) ? rows : []);
        } catch {
          if (!cancel) setPacientes([]);
        } finally {
          if (!cancel) setLoadingPacientes(false);
        }
      })();
    }, 250);
    return () => {
      cancel = true;
      clearTimeout(t);
    };
  }, [busqueda]);

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
    if (!documentoPaciente || !documentoEmpresa) {
      setHistorial([]);
      setLoadingHistorial(false);
      return undefined;
    }
    let cancel = false;
    setLoadingHistorial(true);
    (async () => {
      try {
        const data = await fetchAgendaCitasPaciente(
          documentoPaciente,
          documentoEmpresa,
        );
        if (!cancel) {
          setHistorial(Array.isArray(data?.citas) ? data.citas : []);
        }
      } catch {
        if (!cancel) setHistorial([]);
      } finally {
        if (!cancel) setLoadingHistorial(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [documentoPaciente, documentoEmpresa]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape' && !saving && !editPaciente && !printHistorial) {
        onClose();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, saving, editPaciente, printHistorial]);

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
      setTab('cita');
      return;
    }
    if (!String(profesional?.documento ?? '').trim()) {
      setError('No hay profesional para esta franja.');
      setTab('cita');
      return;
    }
    if (!String(documentoEmpresa ?? '').trim()) {
      setError('Seleccione la empresa de trabajo.');
      setTab('cita');
      return;
    }
    const motivoFinal =
      motivo.trim() ||
      seleccionados.map((p) => p.descripcion || p.codigo).join(', ');
    if (!motivoFinal) {
      setError('Indique el motivo o seleccione un procedimiento.');
      setTab('cita');
      return;
    }
    const horaInicioEnvio =
      horaCita.length === 5 ? horaCita : horaCita.slice(0, 5);
    const horaFinEnvio = (horaFin || '').slice(0, 5);
    const iniMin = hmToMinutes(horaInicioEnvio);
    const finMin = hmToMinutes(horaFinEnvio);
    if (iniMin == null) {
      setError('Indique la hora de inicio.');
      setTab('cita');
      return;
    }
    if (finMin == null || finMin <= iniMin) {
      setError('La hora de fin debe ser posterior a la de inicio.');
      setTab('cita');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        documentoPaciente,
        documentoProfesional: String(profesional.documento).trim(),
        fecha: fechaCita,
        horaInicio: horaInicioEnvio,
        horaFin: horaFinEnvio,
        motivo: motivoFinal,
        idTipoCompromiso: Number(idTipo),
        codigosObjeto: seleccionados.map((p) => p.codigo),
        documentoEmpresa,
        documentoEspacio: documentoEspacio || undefined,
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
      setTab('cita');
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
              {profesional?.nombre || ''}
              {nombreEspacio ? ` · ${nombreEspacio}` : ''}
              {` · ${fechaCita} · ${horaCita}–${horaFin}`}
            </p>
          </div>
          <button type="button" className="btn-outline" onClick={onClose}>
            Cerrar
          </button>
        </header>
        <Tabs
          tabs={CITA_TABS}
          value={tab}
          onChange={setTab}
          ariaLabel="Secciones de la cita"
          idPrefix="agenda-cita"
        />
        <div className="modal-body">
          {error && <div className="alert alert-error">{error}</div>}

          <TabPanel id="cita" value={tab} idPrefix="agenda-cita">
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
                  {loadingPacientes ? (
                    <p className="muted">Cargando pacientes…</p>
                  ) : (
                    <>
                      {pacientes.map((p) => (
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
                      {!pacientes.length && (
                        <p className="muted">
                          No hay pacientes para esa búsqueda.
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
              <FichaPacienteCita
                datos={datosPaciente}
                loading={loadingFicha}
                sede={nombreSede}
                profesionalNombre={profesional?.nombre || ''}
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
          </TabPanel>

          <TabPanel id="control" value={tab} idPrefix="agenda-cita">
            <div className="agenda-historial">
              <div className="agenda-historial-toolbar">
                <button
                  type="button"
                  className="btn-outline"
                  disabled={!documentoPaciente || loadingHistorial}
                  onClick={() => setPrintHistorial(true)}
                >
                  Imprimir historial de citas
                </button>
              </div>
              <div className="agenda-historial-table-wrap">
                <table className="agenda-historial-table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Hora inicio</th>
                      <th>Hora fin</th>
                      <th>Tipo</th>
                      <th>Responsable</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!documentoPaciente ? (
                      <tr>
                        <td colSpan={6} className="muted">
                          Seleccione un paciente en la pestaña Cita para ver su
                          historial.
                        </td>
                      </tr>
                    ) : loadingHistorial ? (
                      <tr>
                        <td colSpan={6} className="muted">
                          Cargando historial…
                        </td>
                      </tr>
                    ) : historial.length ? (
                      historial.map((cita) => (
                        <tr
                          key={cita.idCita}
                          className={rowClassForEstado(cita.idEstado)}
                        >
                          <td>{formatFechaCorta(cita.fecha)}</td>
                          <td>{formatHora12(cita.hora)}</td>
                          <td>{formatHora12(cita.horaFin)}</td>
                          <td>{cita.tipoCompromiso || '—'}</td>
                          <td>{cita.nombreProfesional || '—'}</td>
                          <td>{cita.estado || '—'}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="muted">
                          No hay citas registradas para este paciente.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </TabPanel>

          <TabPanel id="disponibilidad" value={tab} idPrefix="agenda-cita">
            {esEdicion ? (
              <AgendaDisponibilidadPanel
                citaInicial={citaInicial}
                documentoEmpresa={documentoEmpresa}
                documentoPaciente={documentoPaciente}
                motivo={motivo}
                idTipo={idTipo}
                procedimientos={seleccionados}
                horaInicio={horaCita}
                horaFin={horaFin}
                documentoEspacioOriginal={documentoEspacio}
                disabled={saving}
                onMoved={(ymd) => onCreated(ymd)}
              />
            ) : (
              <p className="muted agenda-tab-placeholder">
                Guarde la cita primero para cambiarla de profesional.
              </p>
            )}
          </TabPanel>

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
      {printHistorial && documentoPaciente ? (
        <div role="presentation" onClick={(e) => e.stopPropagation()}>
          <AgendaHistorialPrintModal
            citas={historial}
            documentoPaciente={documentoPaciente}
            nombrePaciente={
              datosPaciente?.demografia?.nombreCompleto ||
              seleccionado?.name ||
              documentoPaciente
            }
            onClose={() => setPrintHistorial(false)}
          />
        </div>
      ) : null}
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
