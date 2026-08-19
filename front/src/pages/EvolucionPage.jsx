import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  createEvaluacion,
  fetchCompanies,
  fetchEvolucionDetalle,
  fetchEvolucionesPaciente,
  fetchEvolucionRipsCatalog,
  fetchEvolucionRipsLines,
  fetchPacienteDatos,
  fetchRipsCie,
  fetchRipsCups,
  patchCerrarEvolucion,
  patchEvolucionDiagnosticos,
  postEvolucionRips,
} from '../api/client';
import { HcAccordionSection } from '../components/HcAccordionSection';
import { PatientDataPanel } from '../components/PatientDataPanel';
import { RipsCatalogSearch } from '../components/RipsCatalogSearch';

function pickDiagFromRow(row) {
  if (!row) return { general: '', especifico: '' };
  return {
    general: String(row['Diagnostico General'] ?? ''),
    especifico: String(row['Diagnostico especifico'] ?? ''),
  };
}

/** Entero de catálogo: null si falta o es 0 (evita FK inválida). */
function optionalFkInt(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (Number.isNaN(n) || n === 0) return null;
  return n;
}

function buildCreatePayload({
  formFields,
  evolucionSnapshot,
  documentoPaciente,
  documentoEmpresa,
  diagnosticoGeneral,
  diagnosticoEspecifico,
  nombreAcompanante,
  telefonoAcompanante,
}) {
  const snap = evolucionSnapshot ?? {};
  const form = formFields ?? {};
  const fechaNac =
    form.nacimientoPaciente && String(form.nacimientoPaciente).includes('T')
      ? String(form.nacimientoPaciente)
      : form.nacimientoPaciente
        ? `${form.nacimientoPaciente}T00:00`
        : '1970-01-01T00:00';

  return {
    documentoPaciente,
    documentoEmpresa,
    idTipoEvaluacion: 1,
    edadPaciente: form.edadPaciente ?? 0,
    nombreAcompanante: nombreAcompanante ?? '',
    idParentescoAcompanante: null,
    telefonoAcompanante: telefonoAcompanante ?? '',
    diagnosticoGeneral,
    diagnosticoEspecifico,
    direccionPaciente: form.direccionPaciente ?? '',
    idCiudad: optionalFkInt(snap.idListaCiudad),
    telefonoDomicilio: form.celularPaciente ?? '',
    fechaNacimiento: fechaNac,
    idUnidadMedidaEdad: optionalFkInt(snap.idUnidad),
    idSexo: optionalFkInt(form.idSexo) ?? 0,
    idEstadoCivil: optionalFkInt(snap.idEstadoCivil),
    idOcupacion: optionalFkInt(form.idOcupacion),
    documentoAseguradora: snap.documentoAseguradora ?? '',
    idTipoAfiliado: optionalFkInt(snap.idTipoAfiliado),
    responsableNombre: snap.nombreResponsable ?? '',
    idParentescoResponsable: optionalFkInt(snap.idParentescoResponsable),
    telefonoResponsable: snap.telefonoResponsable ?? '',
  };
}

const RIPS_INITIAL_FORM = {
  acto: 1,
  idTipoRips: '',
  docTipoRips: '',
  idModalidad: '',
  idGrupo: '',
  idServicio: '',
  idFinalidad: '',
  idCausa: '',
  idTipoDx: '',
  idVia: '',
  cups1: '',
  cups2: '',
  cie1: '',
  cie2: '',
};

function cupsTipoFromActo(acto) {
  return acto === 2 ? 'AP' : 'AC';
}

/** @returns {{ ok: true } | { ok: false, labels: string[] }} */
function validateRipsForm(form) {
  const need = [
    ['tipo RIPS', form.idTipoRips],
    ['documento prestador', form.docTipoRips],
    ['modalidad', form.idModalidad],
    ['grupo servicios', form.idGrupo],
    ['servicio', form.idServicio],
    ['finalidad', form.idFinalidad],
    ['CUPS principal', form.cups1],
    ['CIE principal', form.cie1],
  ];
  const missing = need
    .filter(([, v]) => v === '' || v == null)
    .map(([k]) => k);
  if (form.acto === 1) {
    if (form.idCausa === '' || form.idCausa == null) {
      missing.push('causa externa');
    }
    if (form.idTipoDx === '' || form.idTipoDx == null) {
      missing.push('tipo diagnóstico principal');
    }
  } else if (form.idVia === '' || form.idVia == null) {
    missing.push('vía de ingreso');
  }
  if (missing.length) return { ok: false, labels: missing };
  return { ok: true };
}

function buildRipsPayload(form) {
  return {
    actoQuirurgico: form.acto,
    idTipoRips: Number(form.idTipoRips),
    documentoTipoRips: String(form.docTipoRips).trim(),
    idModalidadAtencion: Number(form.idModalidad),
    idGrupoServicios: Number(form.idGrupo),
    idServicios: Number(form.idServicio),
    idFinalidadConsulta: Number(form.idFinalidad),
    idCausaExterna: form.acto === 1 ? Number(form.idCausa) : undefined,
    idTipoDiagnosticoPrincipal:
      form.acto === 1 ? Number(form.idTipoDx) : undefined,
    idViaIngresoUsuario: form.acto === 2 ? Number(form.idVia) : undefined,
    codigoRips: String(form.cups1).trim(),
    codigoRips2: form.cups2?.trim() || undefined,
    diagnosticoRips: String(form.cie1).trim(),
    diagnosticoRips2: form.cie2?.trim() || undefined,
  };
}

export default function EvolucionPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const documentoPaciente = location.state?.documentoPaciente;

  const [pacienteDatos, setPacienteDatos] = useState(null);
  const [patientFormFields, setPatientFormFields] = useState(null);
  const [lista, setLista] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [docEmpresa, setDocEmpresa] = useState('');

  const [selectedId, setSelectedId] = useState(null);
  const [detailRows, setDetailRows] = useState(null);
  const [diagGeneral, setDiagGeneral] = useState('');
  const [diagEspecifico, setDiagEspecifico] = useState('');
  const [nombreAcompanante, setNombreAcompanante] = useState('');
  const [telefonoAcompanante, setTelefonoAcompanante] = useState('');

  const [ripsCat, setRipsCat] = useState(null);
  const [ripsLines, setRipsLines] = useState([]);
  const [ripsForm, setRipsForm] = useState(RIPS_INITIAL_FORM);
  const [ripsEnabled, setRipsEnabled] = useState(false);
  const [ripsAccordionOpen, setRipsAccordionOpen] = useState(false);
  const [draftStartedAt, setDraftStartedAt] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingRips, setSavingRips] = useState(false);
  const [error, setError] = useState('');

  const demografia = pacienteDatos?.demografia ?? null;
  const evolucionSnapshot = pacienteDatos?.evolucionSnapshot ?? null;
  const hasPaciente = !!demografia;

  const reloadPacienteDatos = useCallback(async () => {
    if (!documentoPaciente) return;
    const data = await fetchPacienteDatos(documentoPaciente);
    setPacienteDatos(data);
  }, [documentoPaciente]);

  const reloadLista = useCallback(async () => {
    if (!documentoPaciente) return;
    const ev = await fetchEvolucionesPaciente(documentoPaciente);
    setLista(Array.isArray(ev) ? ev : []);
  }, [documentoPaciente]);

  useEffect(() => {
    if (!documentoPaciente) {
      setLoading(false);
      setRipsEnabled(false);
      return;
    }
    let cancel = false;
    setLoading(true);
    setError('');
    (async () => {
      try {
        const [datos, cos] = await Promise.all([
          fetchPacienteDatos(documentoPaciente),
          fetchCompanies(),
        ]);
        if (cancel) return;
        setPacienteDatos(datos);
        const coArr = Array.isArray(cos) ? cos : [];
        setCompanies(coArr);
        setDocEmpresa((prev) => prev || (coArr[0]?.documentoEmpresa ?? ''));
        const ev = await fetchEvolucionesPaciente(documentoPaciente);
        if (cancel) return;
        setLista(Array.isArray(ev) ? ev : []);
      } catch (e) {
        if (!cancel) {
          setError(
            e.response?.data?.message ??
              e.response?.data?.error ??
              e.message ??
              'Error al cargar datos',
          );
        }
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [documentoPaciente]);

  useEffect(() => {
    if (!documentoPaciente || !hasPaciente) return;
    let cancel = false;
    (async () => {
      try {
        const [
          tipoRips,
          modalidad,
          grupoServicios,
          servicios,
          finalidadConsulta,
          finalidadProcedimiento,
          causaExterna,
          tipoDiagnostico,
          viaIngreso,
        ] = await Promise.all([
          fetchEvolucionRipsCatalog('tipo-rips'),
          fetchEvolucionRipsCatalog('modalidad-atencion'),
          fetchEvolucionRipsCatalog('grupo-servicios'),
          fetchEvolucionRipsCatalog('servicios'),
          fetchEvolucionRipsCatalog('finalidad-consulta'),
          fetchEvolucionRipsCatalog('finalidad-procedimiento'),
          fetchEvolucionRipsCatalog('causa-externa'),
          fetchEvolucionRipsCatalog('tipo-diagnostico'),
          fetchEvolucionRipsCatalog('via-ingreso'),
        ]);
        if (cancel) return;
        setRipsCat({
          tipoRips: Array.isArray(tipoRips) ? tipoRips : [],
          modalidad: Array.isArray(modalidad) ? modalidad : [],
          grupoServicios: Array.isArray(grupoServicios) ? grupoServicios : [],
          servicios: Array.isArray(servicios) ? servicios : [],
          finalidadConsulta: Array.isArray(finalidadConsulta)
            ? finalidadConsulta
            : [],
          finalidadProcedimiento: Array.isArray(finalidadProcedimiento)
            ? finalidadProcedimiento
            : [],
          causaExterna: Array.isArray(causaExterna) ? causaExterna : [],
          tipoDiagnostico: Array.isArray(tipoDiagnostico) ? tipoDiagnostico : [],
          viaIngreso: Array.isArray(viaIngreso) ? viaIngreso : [],
        });
      } catch (e) {
        if (!cancel) console.warn('Catálogos RIPS:', e);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [documentoPaciente, hasPaciente]);

  useEffect(() => {
    setRipsForm((f) => ({ ...f, idFinalidad: '', cups1: '', cups2: '' }));
  }, [ripsForm.acto]);

  const finalidadOptions = useMemo(() => {
    if (!ripsCat) return [];
    return ripsForm.acto === 1
      ? ripsCat.finalidadConsulta
      : ripsCat.finalidadProcedimiento;
  }, [ripsCat, ripsForm.acto]);
  const isConsultaRips = ripsForm.acto === 1;

  const searchCups = useCallback(
    (q) => fetchRipsCups(cupsTipoFromActo(ripsForm.acto), q),
    [ripsForm.acto],
  );

  const searchCie = useCallback((q) => fetchRipsCie(q), []);

  function startNueva() {
    setRipsEnabled(true);
    setRipsAccordionOpen(false);
    setDraftStartedAt(new Date());
    setSelectedId(null);
    setDetailRows(null);
    setDiagGeneral('');
    setDiagEspecifico('');
    setNombreAcompanante('');
    setTelefonoAcompanante('');
    setRipsLines([]);
    setRipsForm({ ...RIPS_INITIAL_FORM, docTipoRips: docEmpresa ?? '' });
  }

  async function openDetalle(id) {
    setRipsEnabled(true);
    setDraftStartedAt(null);
    setError('');
    setSelectedId(id);
    try {
      const rows = await fetchEvolucionDetalle(id);
      const arr = Array.isArray(rows) ? rows : [];
      setDetailRows(arr);
      const { general, especifico } = pickDiagFromRow(arr[0]);
      setDiagGeneral(general);
      setDiagEspecifico(especifico);
      const lr = await fetchEvolucionRipsLines(id);
      setRipsLines(Array.isArray(lr) ? lr : []);
      setRipsForm({
        ...RIPS_INITIAL_FORM,
        docTipoRips: docEmpresa ?? '',
      });
    } catch (e) {
      setDetailRows(null);
      setRipsLines([]);
      setError(
        e.response?.data?.message ??
          e.response?.data?.error ??
          e.message ??
          'No se pudo cargar la evolución',
      );
    }
  }

  async function guardarNueva() {
    if (!documentoPaciente || !hasPaciente) return;
    setSaving(true);
    setError('');
    try {
      const body = buildCreatePayload({
        formFields: patientFormFields,
        evolucionSnapshot,
        documentoPaciente,
        documentoEmpresa: docEmpresa,
        diagnosticoGeneral: diagGeneral,
        diagnosticoEspecifico: diagEspecifico,
        nombreAcompanante,
        telefonoAcompanante,
      });
      const { idEvaluacion } = await createEvaluacion(body);
      await reloadLista();
      if (idEvaluacion != null) {
        await openDetalle(idEvaluacion);
      } else {
        startNueva();
      }
    } catch (e) {
      setError(
        e.response?.data?.message ??
          e.response?.data?.error ??
          e.message ??
          'Error al guardar',
      );
    } finally {
      setSaving(false);
    }
  }

  async function guardarNuevaConRips() {
    if (!documentoPaciente || !hasPaciente || !ripsCat) return;
    const validation = validateRipsForm(ripsForm);
    if (!validation.ok) {
      setError(`Complete: ${validation.labels.join(', ')}`);
      return;
    }
    setSaving(true);
    setError('');
    let idEvaluacion = null;
    try {
      const body = buildCreatePayload({
        formFields: patientFormFields,
        evolucionSnapshot,
        documentoPaciente,
        documentoEmpresa: docEmpresa,
        diagnosticoGeneral: diagGeneral,
        diagnosticoEspecifico: diagEspecifico,
        nombreAcompanante,
        telefonoAcompanante,
      });
      const created = await createEvaluacion(body);
      idEvaluacion = created?.idEvaluacion ?? null;
      if (idEvaluacion == null) {
        throw new Error('No se recibió id de evaluación');
      }
      await postEvolucionRips(idEvaluacion, buildRipsPayload(ripsForm));
      await reloadLista();
      await openDetalle(idEvaluacion);
    } catch (e) {
      const msg =
        e.response?.data?.message ??
        e.response?.data?.error ??
        e.message ??
        'Error al guardar';
      if (idEvaluacion != null) {
        setError(
          `Evolución #${idEvaluacion} guardada; RIPS no se registró: ${msg}`,
        );
        await reloadLista();
        try {
          await openDetalle(idEvaluacion);
        } catch {
          setSelectedId(idEvaluacion);
        }
      } else {
        setError(msg);
      }
    } finally {
      setSaving(false);
    }
  }

  async function guardarEdicion() {
    if (selectedId == null) return;
    setSaving(true);
    setError('');
    try {
      await patchEvolucionDiagnosticos(selectedId, {
        diagnosticoGeneral: diagGeneral,
        diagnosticoEspecifico: diagEspecifico,
      });
      await reloadLista();
    } catch (e) {
      setError(
        e.response?.data?.message ??
          e.response?.data?.error ??
          e.message ??
          'Error al guardar',
      );
    } finally {
      setSaving(false);
    }
  }

  async function cerrarHistoriaClinica() {
    if (selectedId == null) return;
    if (!window.confirm('Esta acción cerrará la HC y bloqueará nuevas ediciones.')) {
      return;
    }
    setSaving(true);
    setError('');
    try {
      await patchCerrarEvolucion(selectedId);
      await reloadLista();
    } catch (e) {
      setError(
        e.response?.data?.message ??
          e.response?.data?.error ??
          e.message ??
          'No se pudo cerrar la evolución',
      );
    } finally {
      setSaving(false);
    }
  }

  async function guardarRips() {
    if (selectedId == null || !ripsCat) return;
    const validation = validateRipsForm(ripsForm);
    if (!validation.ok) {
      setError(`Complete: ${validation.labels.join(', ')}`);
      return;
    }

    setSavingRips(true);
    setError('');
    try {
      await postEvolucionRips(selectedId, buildRipsPayload(ripsForm));
      const lr = await fetchEvolucionRipsLines(selectedId);
      setRipsLines(Array.isArray(lr) ? lr : []);
      setRipsForm({ ...RIPS_INITIAL_FORM, docTipoRips: docEmpresa ?? '' });
    } catch (e) {
      setError(
        e.response?.data?.message ??
          e.response?.data?.error ??
          e.message ??
          'Error al guardar RIPS',
      );
    } finally {
      setSavingRips(false);
    }
  }

  const tituloPaciente = useMemo(() => {
    if (!demografia) return documentoPaciente ?? '';
    return demografia.nombreCompleto ?? documentoPaciente;
  }, [demografia, documentoPaciente]);
  const selectedItem = useMemo(
    () => lista.find((x) => x.idEvolucion === selectedId) ?? null,
    [lista, selectedId],
  );
  const isSelectedClosed = selectedItem?.estado === 'Cerrado';
  const isSelectedOpen = selectedId != null && !isSelectedClosed;
  const canEditRips = ripsEnabled && (selectedId == null || !isSelectedClosed);
  const canPersistRips = selectedId != null && !isSelectedClosed;
  const draftFecha = useMemo(() => {
    if (!draftStartedAt) return '';
    const dt = new Date(draftStartedAt);
    const yyyy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }, [draftStartedAt]);
  const draftHora = useMemo(() => {
    if (!draftStartedAt) return '';
    return new Date(draftStartedAt).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  }, [draftStartedAt]);

  return (
    <div className="page evolucion-page">
      <p className="page-eyebrow">Historia clínica</p>
      <h1>Evolución clínica (HC)</h1>
      <p className="muted evolucion-intro">
        Módulos plegables: datos del paciente, nota de evolución y{' '}
        <strong>RIPS</strong> cuando la evolución esté guardada. El ancho se
        aprovecha para revisiones con mucha información.
      </p>

      {!documentoPaciente && (
        <p className="muted">
          Abrí un paciente desde{' '}
          <Link to="/principal/usuarios">Usuarios</Link> con «Evolucionar».
        </p>
      )}

      {documentoPaciente && (
        <HcAccordionSection
          title="Contexto de atención"
          subtitle="Paciente, prestador (empresa) y acciones"
          icon="⚕"
          defaultOpen
        >
          <div className="evolucion-toolbar">
            <div>
              <p className="muted" style={{ margin: 0 }}>
                Paciente
              </p>
              <p className="td-strong" style={{ margin: '0.25rem 0 0' }}>
                {tituloPaciente}
              </p>
              <p className="td-mono muted" style={{ margin: '0.25rem 0 0' }}>
                {documentoPaciente}
              </p>
            </div>
            <div className="evolucion-toolbar-actions">
              <label className="evolucion-inline-label">
                Empresa (RUT/NIT)
                <select
                  value={docEmpresa}
                  onChange={(e) => setDocEmpresa(e.target.value)}
                  disabled={!companies.length}
                >
                  {companies.map((c) => (
                    <option key={c.documentoEmpresa} value={c.documentoEmpresa}>
                      {c.nombreComercialEmpresa} · {c.documentoEmpresa}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" className="secondary" onClick={startNueva}>
                Nueva evolución
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => navigate('/principal/usuarios')}
              >
                Volver a usuarios
              </button>
            </div>
          </div>
        </HcAccordionSection>
      )}

      {documentoPaciente && loading && (
        <p className="muted">Cargando historia y listado…</p>
      )}

      {documentoPaciente && !loading && !hasPaciente && (
        <div className="alert alert-error">
          No se encontraron datos del paciente en la vista del Relacionador para
          este documento.
        </div>
      )}

      {documentoPaciente && !loading && hasPaciente && (
        <>
          <HcAccordionSection
            title="Datos del paciente"
            subtitle="Demografia Res. 1888 (misma fuente que Relacionador)"
            icon="◇"
            defaultOpen
          >
            <PatientDataPanel
              documentoPaciente={documentoPaciente}
              demografia={demografia}
              onSaved={() => void reloadPacienteDatos()}
              onFormChange={setPatientFormFields}
            />
          </HcAccordionSection>

          <div className="evolucion-workspace">
            <HcAccordionSection
              title="Evoluciones previas"
              subtitle={
                lista.length
                  ? `${lista.length} registro(s)`
                  : 'Aún sin evoluciones'
              }
              icon="▦"
              defaultOpen
            >
              {!lista.length && !draftStartedAt && (
                <p className="muted">
                  Sin registros. Creá la primera en «Nota clínica».
                </p>
              )}
              <ul className="list compact evolucion-fechas">
              {draftStartedAt && (
                <li key="draft-new-evolucion">
                  <button
                    type="button"
                    className={selectedId == null ? 'evolucion-fecha-btn active' : 'evolucion-fecha-btn'}
                    onClick={startNueva}
                  >
                    <span className="td-strong">{draftFecha}</span>
                    <span className="muted">{draftHora}</span>
                    <span className="evolucion-pill borrador">Sin guardar</span>
                  </button>
                </li>
              )}
              {lista.map((item) => (
                <li key={item.idEvolucion}>
                  <button
                    type="button"
                    className={
                      selectedId === item.idEvolucion
                        ? 'evolucion-fecha-btn active'
                        : 'evolucion-fecha-btn'
                    }
                    onClick={() => openDetalle(item.idEvolucion)}
                  >
                    <span className="td-strong">{item.fechaEvolucion}</span>
                    <span className="muted">{item.hora}</span>
                    <span
                      className={
                        item.estado === 'Cerrado'
                          ? 'evolucion-pill cerrado'
                          : 'evolucion-pill abierto'
                      }
                    >
                      {item.estado}
                    </span>
                  </button>
                </li>
              ))}
              </ul>
            </HcAccordionSection>

            <div className="evolucion-editor-stack">
              <HcAccordionSection
                title={
                  selectedId == null
                    ? 'Nota clínica — nueva evolución'
                    : `Nota clínica — evolución #${selectedId}`
                }
                subtitle="Diagnóstico, plan de manejo y acompañante"
                icon="✎"
                defaultOpen
              >
                {selectedId != null && detailRows?.[0] && (
                  <p className="muted evolucion-meta">
                    Profesional:{' '}
                    <strong>
                      {String(detailRows[0]['Nombre Profesional'] ?? '—')}
                    </strong>
                    {' · '}
                    Fecha:{' '}
                    <strong>
                      {detailRows[0]['Fecha Evaluación Entidad']
                        ? new Date(
                            detailRows[0]['Fecha Evaluación Entidad'],
                          ).toLocaleString()
                        : '—'}
                    </strong>
                  </p>
                )}
                {isSelectedClosed && (
                  <div className="alert alert-warn">
                    Esta HC está cerrada. Puedes consultarla, pero no editarla.
                  </div>
                )}

                {selectedId == null && (
                  <div className="form evolucion-acompanante">
                    <label>
                      Acompañante
                      <input
                        value={nombreAcompanante}
                        onChange={(e) => setNombreAcompanante(e.target.value)}
                      />
                    </label>
                    <label>
                      Tel. acompañante
                      <input
                        value={telefonoAcompanante}
                        onChange={(e) =>
                          setTelefonoAcompanante(e.target.value)
                        }
                      />
                    </label>
                  </div>
                )}

                <label>
                  Diagnóstico / evolución (nota general)
                  <textarea
                    className="evolucion-textarea"
                    rows={8}
                    value={diagGeneral}
                    onChange={(e) => setDiagGeneral(e.target.value)}
                    disabled={isSelectedClosed}
                  />
                </label>
                <label>
                  Diagnóstico específico / plan
                  <textarea
                    className="evolucion-textarea"
                    rows={6}
                    value={diagEspecifico}
                    onChange={(e) => setDiagEspecifico(e.target.value)}
                    disabled={isSelectedClosed}
                  />
                </label>

                <div className="evolucion-actions">
                  {selectedId == null && !ripsAccordionOpen ? (
                    <button
                      type="button"
                      disabled={saving || !hasPaciente}
                      onClick={() => void guardarNueva()}
                    >
                      {saving ? 'Guardando…' : 'Guardar evolución (sin RIPS)'}
                    </button>
                  ) : selectedId == null ? null : isSelectedOpen ? (
                    <>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void guardarEdicion()}
                    >
                      {saving ? 'Guardando…' : 'Actualizar textos clínicos'}
                    </button>
                      <button
                        type="button"
                        className="secondary"
                        disabled={saving}
                        onClick={() => void cerrarHistoriaClinica()}
                      >
                        {saving ? 'Cerrando…' : 'Cerrar HC'}
                      </button>
                    </>
                  ) : null}
                </div>
              </HcAccordionSection>

              <HcAccordionSection
                title="RIPS (MinSalud)"
                subtitle={
                  !ripsEnabled
                    ? 'Se habilita al elegir una evolución o tocar Nueva evolución'
                    : 'Prestación, CUPS y CIE (una línea por guardado)'
                }
                icon="📋"
                defaultOpen={false}
                onOpenChange={setRipsAccordionOpen}
              >
                <p className="muted rips-panel-hint" style={{ marginTop: 0 }}>
                  CUPS y CIE desde catálogo Relacionador (AC/AP). La evaluación
                  queda marcada con RIPS al insertar.
                </p>
                <fieldset className="rips-fieldset" disabled={!canEditRips}>
                <div className="rips-topline">
                  <div className="rips-topline-col">
                    <span className="rips-label">Tipo de RIPS a diligenciar</span>
                    <div className="rips-segmented">
                      <button
                        type="button"
                        className={ripsForm.acto === 1 ? 'rips-seg active' : 'rips-seg'}
                        onClick={() => setRipsForm((f) => ({ ...f, acto: 1 }))}
                      >
                        AC
                      </button>
                      <button
                        type="button"
                        className={ripsForm.acto === 2 ? 'rips-seg active' : 'rips-seg'}
                        onClick={() => setRipsForm((f) => ({ ...f, acto: 2 }))}
                      >
                        AP
                      </button>
                    </div>
                  </div>
                </div>
                {!ripsEnabled && (
                  <p className="muted">
                    Primero selecciona una evolución del panel izquierdo o pulsa
                    «Nueva evolución».
                  </p>
                )}
                {ripsEnabled && selectedId == null && ripsAccordionOpen && (
                  <p className="muted">
                    Complete todos los campos RIPS y use «Guardar evolución con
                    RIPS» para crear la nota y la línea en un solo paso.
                  </p>
                )}
                {ripsEnabled && !ripsCat && (
                  <p className="muted">Cargando catálogos RIPS…</p>
                )}
                {ripsEnabled && ripsCat && (
                  <>
                {ripsLines.length > 0 && (
                  <div className="rips-lines">
                    <p className="muted" style={{ margin: '0 0 0.5rem' }}>
                      Líneas guardadas: {ripsLines.length}
                    </p>
                    <div className="rips-lines-scroll">
                      <table className="rips-table">
                        <thead>
                          <tr>
                            <th>Id</th>
                            <th>CUPS</th>
                            <th>CIE</th>
                            <th>Acto</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ripsLines.map((r) => (
                            <tr key={String(r['Id Evaluación Entidad Rips'])}>
                              <td className="td-mono">
                                {String(r['Id Evaluación Entidad Rips'] ?? '')}
                              </td>
                              <td className="td-mono">
                                {String(r['Codigo Rips'] ?? '')}
                              </td>
                              <td className="td-mono">
                                {String(r['Diagnostico Rips'] ?? '')}
                              </td>
                              <td>
                                {String(r['Id Acto Quirúrgico'] ?? '')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="rips-form-grid">
                  <label>
                    Tipo RIPS
                    <select
                      value={ripsForm.idTipoRips}
                      onChange={(e) =>
                        setRipsForm((f) => ({
                          ...f,
                          idTipoRips: e.target.value,
                        }))
                      }
                    >
                      <option value="">—</option>
                      {ripsCat.tipoRips.map((t) => (
                        <option key={String(t.idTipoRips)} value={t.idTipoRips}>
                          {t.descripcionTipoRips}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Documento prestador (tipo RIPS)
                    <input
                      value={ripsForm.docTipoRips}
                      onChange={(e) =>
                        setRipsForm((f) => ({
                          ...f,
                          docTipoRips: e.target.value,
                        }))
                      }
                      placeholder="NIT / documento"
                    />
                  </label>
                  <label>
                    Modalidad
                    <select
                      value={ripsForm.idModalidad}
                      onChange={(e) =>
                        setRipsForm((f) => ({
                          ...f,
                          idModalidad: e.target.value,
                        }))
                      }
                    >
                      <option value="">—</option>
                      {ripsCat.modalidad.map((t) => (
                        <option
                          key={String(t.codigoModalidad)}
                          value={t.codigoModalidad}
                        >
                          {t.nombreModalidad}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Grupo servicios
                    <select
                      value={ripsForm.idGrupo}
                      onChange={(e) =>
                        setRipsForm((f) => ({ ...f, idGrupo: e.target.value }))
                      }
                    >
                      <option value="">—</option>
                      {ripsCat.grupoServicios.map((t) => (
                        <option
                          key={String(t.codigoServicios)}
                          value={t.codigoServicios}
                        >
                          {t.nombreServicios}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Servicio
                    <select
                      value={ripsForm.idServicio}
                      onChange={(e) =>
                        setRipsForm((f) => ({
                          ...f,
                          idServicio: e.target.value,
                        }))
                      }
                    >
                      <option value="">—</option>
                      {ripsCat.servicios.map((t) => (
                        <option
                          key={String(t.codigoServicios)}
                          value={t.codigoServicios}
                        >
                          {t.nombreServicios}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {isConsultaRips
                      ? 'Finalidad tecnología salud (consulta)'
                      : 'Finalidad tecnología salud (procedimiento)'}
                    <select
                      value={ripsForm.idFinalidad}
                      onChange={(e) =>
                        setRipsForm((f) => ({
                          ...f,
                          idFinalidad: e.target.value,
                        }))
                      }
                    >
                      <option value="">—</option>
                      {finalidadOptions.map((t) => (
                        <option
                          key={String(t.codigoFinalidad)}
                          value={t.codigoFinalidad}
                        >
                          {t.nombreFinalidad}
                        </option>
                      ))}
                    </select>
                  </label>
                  {isConsultaRips && (
                    <>
                      <label>
                        Causa / motivo de atención
                        <select
                          value={ripsForm.idCausa}
                          onChange={(e) =>
                            setRipsForm((f) => ({
                              ...f,
                              idCausa: e.target.value,
                            }))
                          }
                        >
                          <option value="">—</option>
                          {ripsCat.causaExterna.map((t) => (
                            <option
                              key={String(t.codigoCausa)}
                              value={t.codigoCausa}
                            >
                              {t.nombreCausa}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Tipo diagnóstico principal
                        <select
                          value={ripsForm.idTipoDx}
                          onChange={(e) =>
                            setRipsForm((f) => ({
                              ...f,
                              idTipoDx: e.target.value,
                            }))
                          }
                        >
                          <option value="">—</option>
                          {ripsCat.tipoDiagnostico.map((t) => (
                            <option
                              key={String(t.codigoObjeto)}
                              value={t.codigoObjeto}
                            >
                              {t.descripcionObjeto}
                            </option>
                          ))}
                        </select>
                      </label>
                    </>
                  )}
                  {!isConsultaRips && (
                    <label>
                      Vía ingreso usuario
                      <select
                        value={ripsForm.idVia}
                        onChange={(e) =>
                          setRipsForm((f) => ({
                            ...f,
                            idVia: e.target.value,
                          }))
                        }
                      >
                        <option value="">—</option>
                        {ripsCat.viaIngreso.map((t) => (
                          <option
                            key={String(t.codigoObjeto)}
                            value={t.codigoObjeto}
                          >
                            {t.descripcionObjeto}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>

                <div className="rips-code-grid">
                  <RipsCatalogSearch
                    key={`cups1-${ripsForm.acto}`}
                    label={
                      isConsultaRips
                        ? 'Consulta RIPS 1 (CUPS)'
                        : 'Procedimiento RIPS 1 (CUPS)'
                    }
                    value={ripsForm.cups1}
                    onSearch={searchCups}
                    disabled={!canEditRips}
                    onChange={(v) =>
                      setRipsForm((f) => ({ ...f, cups1: v }))
                    }
                  />
                  <RipsCatalogSearch
                    label={
                      isConsultaRips
                        ? 'Diagnóstico RIPS AC 1 (CIE)'
                        : 'Diagnóstico RIPS AP 1 (CIE)'
                    }
                    value={ripsForm.cie1}
                    onSearch={searchCie}
                    disabled={!canEditRips}
                    onChange={(v) =>
                      setRipsForm((f) => ({ ...f, cie1: v }))
                    }
                  />
                  <RipsCatalogSearch
                    key={`cups2-${ripsForm.acto}`}
                    label={
                      isConsultaRips
                        ? 'Consulta RIPS 2 (opc., CUPS)'
                        : 'Procedimiento RIPS 2 (opc., CUPS)'
                    }
                    value={ripsForm.cups2}
                    onSearch={searchCups}
                    optional
                    disabled={!canEditRips}
                    onChange={(v) =>
                      setRipsForm((f) => ({ ...f, cups2: v }))
                    }
                  />
                  <RipsCatalogSearch
                    label={
                      isConsultaRips
                        ? 'Diagnóstico RIPS AC 2 (opc., CIE)'
                        : 'Diagnóstico RIPS AP 2 (opc., CIE)'
                    }
                    value={ripsForm.cie2}
                    onSearch={searchCie}
                    optional
                    disabled={!canEditRips}
                    onChange={(v) =>
                      setRipsForm((f) => ({ ...f, cie2: v }))
                    }
                  />
                </div>

                <div className="evolucion-actions">
                  {selectedId == null && ripsAccordionOpen ? (
                    <button
                      type="button"
                      disabled={saving || !hasPaciente || !ripsCat}
                      onClick={() => void guardarNuevaConRips()}
                    >
                      {saving
                        ? 'Guardando…'
                        : 'Guardar evolución con RIPS'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={savingRips || !canPersistRips}
                      onClick={() => void guardarRips()}
                    >
                      {savingRips
                        ? 'Guardando RIPS…'
                        : canPersistRips
                          ? 'Guardar línea RIPS'
                          : 'Guarda/selecciona evolución para registrar'}
                    </button>
                  )}
                </div>
                  </>
                )}
                </fieldset>
                {isSelectedClosed && (
                  <p className="muted">
                    HC cerrada: no se permiten nuevas líneas RIPS.
                  </p>
                )}
              </HcAccordionSection>
            </div>
          </div>
        </>
      )}

      <p className="muted">
        <Link to="/principal/home">← Inicio</Link>
      </p>
    </div>
  );
}
