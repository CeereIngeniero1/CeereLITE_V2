import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  createEvaluacion,
  createNotaAclaratoria,
  fetchCompanies,
  fetchEvolucionDetalle,
  fetchEvolucionesPaciente,
  fetchFormatoHcContenido,
  fetchFormatosHc,
  fetchNotaAclaratoria,
  fetchPacienteDatos,
  fetchParentescoCatalog,
  patchCerrarEvolucion,
  patchEvolucionDiagnosticos,
} from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { HcAccordionSection } from '../components/HcAccordionSection';
import { HcAnexosModal } from '../components/HcAnexosModal';
import { HcFormatEditor } from '../components/HcFormatEditor';
import { HcHistorialPrintModal } from '../components/HcHistorialPrintModal';
import { HcObservacionesModal } from '../components/HcObservacionesModal';
import { PatientDataPanel } from '../components/PatientDataPanel';
import { SavingOverlay } from '../components/SavingOverlay';
import {
  fechaHistoriaLarga,
  fechaHistoriaNumerica,
  formatFechaNacimiento,
  formatoRelativePath,
  horaHistoria,
  joinFileDir,
  parseFormatoFileName,
} from '../hcFormat/hcFormat';
import { printHtmlDocument } from '../hcFormat/printDocument';
import { printFooterCss, printFooterHtml } from '../hcFormat/printChrome';
import { API_ORIGIN } from '../config';

function pickDiagFromRow(row) {
  if (!row) return { general: '', especifico: '' };
  const general = String(
    row['Diagnostico General'] ??
      row['Diagnóstico General Evaluación Entidad'] ??
      '',
  );
  const especifico = String(
    row['Diagnostico especifico'] ??
      row['Diagnostico Específico'] ??
      row['Diagnóstico Específico Evaluación Entidad'] ??
      '',
  );
  return { general, especifico };
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function printHistoriaTexto({
  tituloPaciente,
  documentoPaciente,
  profesional,
  fecha,
  general,
  especifico,
}) {
  const bodyGeneral = escapeHtml(general).replace(/\n/g, '<br>');
  const bodyEspecifico = escapeHtml(especifico).replace(/\n/g, '<br>');
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Historia clínica — Impreso por CeereSio</title>
  <style>
    html, body {
      background: #fff;
      color: #111;
    }
    body { font-family: Segoe UI, Arial, sans-serif; margin: 24px; }
    h1 { font-size: 1.25rem; margin: 0 0 0.35rem; }
    .meta { color: #222; font-size: 0.92rem; margin-bottom: 1.25rem; }
    h2 { font-size: 1rem; margin: 1.1rem 0 0.4rem; }
    .block {
      white-space: pre-wrap;
      border: 1px solid #444;
      padding: 0.75rem;
      min-height: 4rem;
      color: #111;
      background: #fff;
    }
    ${printFooterCss()}
    @media print {
      html, body { background: #fff; color: #111; }
      body { margin: 12mm; }
    }
  </style>
</head>
<body>
  <h1>Historia clínica</h1>
  <p class="meta">
    Paciente: <strong>${escapeHtml(tituloPaciente || documentoPaciente || '')}</strong><br>
    Documento: ${escapeHtml(documentoPaciente || '—')}<br>
    Profesional: ${escapeHtml(profesional || '—')}<br>
    Fecha: ${escapeHtml(fecha || '—')}
  </p>
  <h2>Diagnóstico / evolución</h2>
  <div class="block">${bodyGeneral || '—'}</div>
  <h2>Diagnóstico específico / plan</h2>
  <div class="block">${bodyEspecifico || '—'}</div>
  ${printFooterHtml()}
</body>
</html>`;
  return printHtmlDocument(html);
}

function ConfirmCloseDialog({ open, isFormato, onCancel, onConfirm }) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className="modal-dialog confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="cerrar-hc-title"
      >
        <header className="modal-header">
          <h2 id="cerrar-hc-title">Cerrar historia clínica</h2>
        </header>
        <div className="modal-body">
          <p>
            ¿Está seguro que desea cerrar{' '}
            {isFormato ? 'este formato' : 'esta evolución'}?
          </p>
          <p className="muted">
            Después de cerrarla no podrá volver a modificarla.
          </p>
          <div className="confirm-actions">
            <button type="button" className="secondary" onClick={onCancel}>
              Cancelar
            </button>
            <button type="button" onClick={onConfirm}>
              Sí, cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function parentescoLabel(parentescos, id) {
  if (id == null || id === '') return '';
  const row = parentescos.find((p) => String(p.id) === String(id));
  return row?.label ?? '';
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
  idTipoEvaluacion,
  nombreAcompanante,
  idParentescoAcompanante,
  telefonoAcompanante,
  responsableNombre,
  idParentescoResponsable,
  telefonoResponsable,
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
    idTipoEvaluacion: idTipoEvaluacion ?? 1,
    edadPaciente: form.edadPaciente ?? 0,
    nombreAcompanante: nombreAcompanante ?? '',
    idParentescoAcompanante: optionalFkInt(idParentescoAcompanante),
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
    documentoAseguradora:
      snap.nombreAseguradora || snap.documentoAseguradora || '',
    idTipoAfiliado: optionalFkInt(snap.idTipoAfiliado),
    responsableNombre: responsableNombre ?? '',
    idParentescoResponsable: optionalFkInt(idParentescoResponsable),
    telefonoResponsable: telefonoResponsable ?? '',
  };
}

export default function EvolucionPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const documentoPaciente = location.state?.documentoPaciente;
  const formatRef = useRef(null);

  const [pacienteDatos, setPacienteDatos] = useState(null);
  const [patientFormFields, setPatientFormFields] = useState(null);
  const [lista, setLista] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [docEmpresa, setDocEmpresa] = useState('');

  const [selectedId, setSelectedId] = useState(null);
  const [selectedOrigen, setSelectedOrigen] = useState('evolucion');
  const [notaTexto, setNotaTexto] = useState('');
  const [notaProfesional, setNotaProfesional] = useState('');
  const [notaFecha, setNotaFecha] = useState('');
  const [draftNotaAt, setDraftNotaAt] = useState(null);
  const [detailRows, setDetailRows] = useState(null);
  const [diagGeneral, setDiagGeneral] = useState('');
  const [diagEspecifico, setDiagEspecifico] = useState('');
  const [nombreAcompanante, setNombreAcompanante] = useState('');
  const [idParentescoAcompanante, setIdParentescoAcompanante] = useState('');
  const [telefonoAcompanante, setTelefonoAcompanante] = useState('');
  const [responsableNombre, setResponsableNombre] = useState('');
  const [idParentescoResponsable, setIdParentescoResponsable] = useState('');
  const [telefonoResponsable, setTelefonoResponsable] = useState('');
  const [parentescos, setParentescos] = useState([]);
  const [formatos, setFormatos] = useState([]);
  const [formatoFile, setFormatoFile] = useState('');
  const [formatoHtml, setFormatoHtml] = useState('');
  const [formatoLogoFileUrl, setFormatoLogoFileUrl] = useState('');
  const [formatoFileDirs, setFormatoFileDirs] = useState(null);
  const [formatoLoading, setFormatoLoading] = useState(false);
  const [formatoUnavailable, setFormatoUnavailable] = useState(false);

  const [draftStartedAt, setDraftStartedAt] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingLabel, setSavingLabel] = useState('Guardando…');
  const [error, setError] = useState('');
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [listModal, setListModal] = useState(null);
  const [hcView, setHcView] = useState('evolucion');
  const moreRef = useRef(null);

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
    if (!moreOpen) return;
    function onPointerDown(e) {
      if (!moreRef.current?.contains(e.target)) {
        setMoreOpen(false);
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [moreOpen]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const rows = await fetchParentescoCatalog();
        if (!cancel) setParentescos(Array.isArray(rows) ? rows : []);
      } catch {
        if (!cancel) setParentescos([]);
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const rows = await fetchFormatosHc();
        if (!cancel) setFormatos(Array.isArray(rows) ? rows : []);
      } catch {
        if (!cancel) setFormatos([]);
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  const clearFormato = useCallback(() => {
    setFormatoFile('');
    setFormatoHtml('');
    setFormatoLogoFileUrl('');
    setFormatoFileDirs(null);
    setFormatoLoading(false);
    setFormatoUnavailable(false);
  }, []);

  const loadFormato = useCallback(
    async (fileName, { silent } = {}) => {
      if (!fileName) {
        clearFormato();
        return false;
      }
      setFormatoFile(fileName);
      setFormatoLoading(true);
      try {
        const data = await fetchFormatoHcContenido(fileName);
        const html = String(data?.html ?? '').trim();
        if (!html) {
          setFormatoHtml('');
          setFormatoLogoFileUrl('');
          setFormatoFileDirs(null);
          if (!silent) {
            setError(`No se encontró el formato ${fileName}`);
          }
          return false;
        }
        setFormatoHtml(html);
        setFormatoLogoFileUrl(data?.logoFileUrl ?? '');
        setFormatoFileDirs(data?.fileDirs ?? null);
        setFormatoUnavailable(false);
        return true;
      } catch (e) {
        setFormatoHtml('');
        setFormatoLogoFileUrl('');
        setFormatoFileDirs(null);
        if (!silent) {
          setError(
            e.response?.data?.message ??
              e.response?.data?.error ??
              e.message ??
              `No se pudo cargar el formato ${fileName}`,
          );
        }
        return false;
      } finally {
        setFormatoLoading(false);
      }
    },
    [clearFormato],
  );

  useEffect(() => {
    if (selectedId != null) return;
    setResponsableNombre(evolucionSnapshot?.nombreResponsable ?? '');
    setIdParentescoResponsable(
      evolucionSnapshot?.idParentescoResponsable != null
        ? String(evolucionSnapshot.idParentescoResponsable)
        : '',
    );
    setTelefonoResponsable(evolucionSnapshot?.telefonoResponsable ?? '');
  }, [evolucionSnapshot, selectedId]);

  function startNueva() {
    setHcView('evolucion');
    setMoreOpen(false);
    setDraftStartedAt(new Date());
    setDraftNotaAt(null);
    setSelectedId(null);
    setSelectedOrigen('evolucion');
    setNotaTexto('');
    setNotaProfesional('');
    setNotaFecha('');
    setDetailRows(null);
    setDiagGeneral('');
    setDiagEspecifico('');
    setFormatoUnavailable(false);
    clearFormato();
    setNombreAcompanante('');
    setIdParentescoAcompanante('');
    setTelefonoAcompanante('');
    setResponsableNombre(evolucionSnapshot?.nombreResponsable ?? '');
    setIdParentescoResponsable(
      evolucionSnapshot?.idParentescoResponsable != null
        ? String(evolucionSnapshot.idParentescoResponsable)
        : '',
    );
    setTelefonoResponsable(evolucionSnapshot?.telefonoResponsable ?? '');
  }

  function startNuevaNota() {
    setHcView('notas');
    setMoreOpen(false);
    setDraftNotaAt(new Date());
    setDraftStartedAt(null);
    setSelectedId(null);
    setSelectedOrigen('nota');
    setNotaTexto('');
    setNotaProfesional('');
    setNotaFecha('');
    setError('');
  }

  async function openDetalle(id) {
    setHcView('evolucion');
    setDraftStartedAt(null);
    setDraftNotaAt(null);
    setError('');
    setSelectedId(id);
    setSelectedOrigen('evolucion');
    setDetailRows(null);
    setDiagGeneral('');
    setDiagEspecifico('');
    setFormatoUnavailable(false);
    clearFormato();
    try {
      const rows = await fetchEvolucionDetalle(id);
      const arr = Array.isArray(rows) ? rows : [];
      const { general, especifico } = pickDiagFromRow(arr[0]);
      const fileName = parseFormatoFileName(general);
      const listItem = lista.find(
        (x) => x.origen === 'evolucion' && Number(x.id) === Number(id),
      );
      const isFormato =
        Number(listItem?.idTipoEvaluacion) === 4 || !!fileName;

      if (isFormato) {
        const name = fileName || 'desconocido';
        const ok = await loadFormato(name, { silent: true });
        if (!ok) {
          setFormatoFile(name === 'desconocido' ? '' : name);
          setFormatoUnavailable(true);
          setError(
            `No se encontró el formato «${name}». No se puede mostrar esta historia clínica.`,
          );
          return;
        }
      }

      setDetailRows(arr);
      setDiagGeneral(general);
      setDiagEspecifico(especifico);
    } catch (e) {
      setDetailRows(null);
      setDiagGeneral('');
      setDiagEspecifico('');
      clearFormato();
      setError(
        e.response?.data?.message ??
          e.response?.data?.error ??
          e.message ??
          'No se pudo cargar la evolución',
      );
    }
  }

  async function openNota(id) {
    setHcView('notas');
    setMoreOpen(false);
    setDraftStartedAt(null);
    setDraftNotaAt(null);
    setSelectedOrigen('nota');
    setSelectedId(id);
    setError('');
    try {
      const data = await fetchNotaAclaratoria(id, documentoPaciente);
      setNotaTexto(String(data?.nota ?? ''));
      setNotaProfesional(String(data?.nombreProfesional ?? '').trim());
      setNotaFecha(data?.fecha ? String(data.fecha) : '');
    } catch (e) {
      setNotaTexto('');
      setNotaProfesional('');
      setNotaFecha('');
      setError(
        e.response?.data?.message ??
          e.response?.data?.error ??
          e.message ??
          'No se pudo cargar la nota aclaratoria',
      );
    }
  }

  async function guardarNota() {
    const texto = String(notaTexto || '').trim();
    if (!documentoPaciente || !texto) {
      setError('La nota aclaratoria no puede estar vacía.');
      return;
    }
    setSaving(true);
    setSavingLabel('Guardando nota aclaratoria…');
    setError('');
    try {
      const created = await createNotaAclaratoria({
        documentoPaciente,
        nota: texto,
      });
      await reloadLista();
      if (created?.id != null) {
        await openNota(created.id);
      }
    } catch (e) {
      setError(
        e.response?.data?.message ??
          e.response?.data?.error ??
          e.message ??
          'No se pudo guardar la nota aclaratoria',
      );
    } finally {
      setSaving(false);
    }
  }

  function collectDiagnosticos() {
    if (!formatoFile || !formatoHtml) {
      return {
        diagnosticoGeneral: diagGeneral,
        diagnosticoEspecifico: diagEspecifico,
      };
    }
    const serialized = formatRef.current?.serialize();
    if (serialized == null) {
      throw new Error('El formato aún no está listo para guardar');
    }
    return {
      diagnosticoGeneral: formatoRelativePath(formatoFile),
      diagnosticoEspecifico: serialized,
    };
  }

  async function guardarNueva() {
    if (!documentoPaciente || !hasPaciente) return;
    setSaving(true);
    setSavingLabel('Guardando evolución…');
    setError('');
    try {
      const { diagnosticoGeneral, diagnosticoEspecifico } = collectDiagnosticos();
      const body = buildCreatePayload({
        formFields: patientFormFields,
        evolucionSnapshot,
        documentoPaciente,
        documentoEmpresa: docEmpresa,
        diagnosticoGeneral,
        diagnosticoEspecifico,
        idTipoEvaluacion: formatoFile ? 4 : 1,
        nombreAcompanante,
        idParentescoAcompanante,
        telefonoAcompanante,
        responsableNombre,
        idParentescoResponsable,
        telefonoResponsable,
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

  async function guardarEdicion() {
    if (selectedId == null) return;
    setSaving(true);
    setSavingLabel('Guardando cambios…');
    setError('');
    try {
      const { diagnosticoGeneral, diagnosticoEspecifico } = collectDiagnosticos();
      await patchEvolucionDiagnosticos(selectedId, {
        diagnosticoGeneral,
        diagnosticoEspecifico,
      });
      setDiagGeneral(diagnosticoGeneral);
      setDiagEspecifico(diagnosticoEspecifico);
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

  function pedirCerrarHistoriaClinica() {
    if (selectedId == null) return;
    setCloseConfirmOpen(true);
  }

  async function imprimirHistoria() {
    if (formatoUnavailable || formatoLoading) return;
    setError('');
    if (formatoFile && formatoHtml) {
      const ok = formatRef.current?.print();
      if (!ok) {
        setError('No se pudo imprimir el formato');
      }
      return;
    }
    const row = detailRows?.[0];
    const fecha =
      row?.['Fecha Evaluación Entidad']
        ? new Date(row['Fecha Evaluación Entidad']).toLocaleString()
        : selectedId == null
          ? `${draftFecha} ${draftHora}`.trim()
          : '';
    const ok = await printHistoriaTexto({
      tituloPaciente,
      documentoPaciente,
      profesional: row
        ? String(row['Nombre Profesional'] ?? '')
        : user?.nombreUsuario,
      fecha,
      general: diagGeneral,
      especifico: diagEspecifico,
    });
    if (!ok) {
      setError('No se pudo preparar la impresión de esta historia clínica.');
    }
  }

  async function confirmarCerrarHistoriaClinica() {
    if (selectedId == null) return;
    setCloseConfirmOpen(false);
    setSaving(true);
    setSavingLabel('Cerrando historia clínica…');
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

  const tituloPaciente = useMemo(() => {
    if (!demografia) return documentoPaciente ?? '';
    return demografia.nombreCompleto ?? documentoPaciente;
  }, [demografia, documentoPaciente]);
  const nombreEmpresa = useMemo(() => {
    const selected = companies.find((c) => c.documentoEmpresa === docEmpresa);
    return String(
      selected?.nombreComercialEmpresa ?? companies[0]?.nombreComercialEmpresa ?? '',
    ).trim();
  }, [companies, docEmpresa]);
  const selectedItem = useMemo(
    () =>
      lista.find(
        (x) =>
          x.origen === 'evolucion' &&
          selectedOrigen === 'evolucion' &&
          Number(x.id) === Number(selectedId),
      ) ?? null,
    [lista, selectedId, selectedOrigen],
  );
  const isSelectedClosed =
    selectedOrigen === 'evolucion' && selectedItem?.estado === 'Cerrado';
  const isSelectedOpen =
    selectedOrigen === 'evolucion' && selectedId != null && !isSelectedClosed;
  const isSavedFormato =
    selectedOrigen === 'evolucion' &&
    selectedId != null &&
    (Number(selectedItem?.idTipoEvaluacion) === 4 ||
      !!formatoFile ||
      formatoUnavailable);
  const showFormatoSelector =
    selectedOrigen !== 'evolucion' || selectedId == null || isSavedFormato;
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
  const draftNotaFecha = useMemo(() => {
    if (!draftNotaAt) return '';
    const dt = new Date(draftNotaAt);
    const yyyy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }, [draftNotaAt]);
  const draftNotaHora = useMemo(() => {
    if (!draftNotaAt) return '';
    return new Date(draftNotaAt).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  }, [draftNotaAt]);

  const savedFormatoFile = useMemo(
    () => parseFormatoFileName(diagGeneral),
    [diagGeneral],
  );

  const formatoPayload =
    selectedId != null && formatoFile && String(diagEspecifico || '').trim()
      ? diagEspecifico
      : '';

  const entidadFileUrls = useMemo(() => {
    const dirs = formatoFileDirs ?? {};
    const pacienteDoc = String(documentoPaciente ?? '').trim();
    const profesionalDoc = String(user?.documentoEntidad ?? '').trim();
    const fotoArchivo =
      demografia?.fotoArchivo || (pacienteDoc ? `${pacienteDoc}.jpg` : '');
    return {
      Entidad1: fotoArchivo
        ? joinFileDir(dirs.fotoEntidad, fotoArchivo)
        : '',
      Entidad3: profesionalDoc
        ? joinFileDir(dirs.firmaEntidad, `${profesionalDoc}.jpg`)
        : '',
    };
  }, [formatoFileDirs, documentoPaciente, user, demografia?.fotoArchivo]);

  const entidadHttpUrls = useMemo(() => {
    const origin = API_ORIGIN.replace(/\/$/, '');
    const pacienteDoc = String(documentoPaciente ?? '').trim();
    const profesionalDoc = String(user?.documentoEntidad ?? '').trim();
    const fotoHttp =
      demografia?.fotoUrl ||
      (pacienteDoc
        ? `${origin}/static-images/${encodeURIComponent(`${pacienteDoc}.jpg`)}`
        : '');
    return {
      Entidad1: fotoHttp,
      Entidad3: profesionalDoc
        ? `${origin}/firma-entidad/${encodeURIComponent(`${profesionalDoc}.jpg`)}`
        : '',
    };
  }, [documentoPaciente, user, demografia?.fotoUrl]);

  const formatoAutofill = useMemo(() => {
    const row = detailRows?.[0];
    const fechaBase =
      selectedId != null && row?.['Fecha Evaluación Entidad']
        ? new Date(row['Fecha Evaluación Entidad'])
        : draftStartedAt ?? new Date();
    const edadNum = patientFormFields?.edadPaciente ?? demografia?.edad;
    const ciudad =
      (row && String(row.Ciudad ?? '')) ||
      demografia?.nombreMunicipioResidencia ||
      '';
    const nombre =
      (row && String(row['Nombre Paciente'] ?? '')) ||
      demografia?.nombreCompleto ||
      '';
    const doc =
      (row && String(row['Documento Paciente'] ?? '')) ||
      documentoPaciente ||
      '';
    const ocupacion =
      (row && String(row['Ocupación'] ?? '')) ||
      demografia?.descripcionOcupacion ||
      '';
    const sexo =
      (row && String(row['Descripción Sexo'] ?? '')) ||
      demografia?.sexo ||
      '';
    const estadoCivil = (row && String(row['Estado Civil'] ?? '')) || '';
    const tipoDoc = (demografia?.tipoDocumentoBase || '').trim();
    const identificacion =
      tipoDoc && doc
        ? ` ${tipoDoc} ${String(doc).trim()}`
        : doc
          ? ` ${String(doc).trim()}`
          : '';
    const eps =
      (row && String(row['Nombre Aseguradora'] ?? '')) ||
      evolucionSnapshot?.nombreAseguradora ||
      '';
    const acompananteNombre =
      selectedId != null
        ? String(row?.Acompanante ?? '')
        : nombreAcompanante;
    const acompananteTel =
      selectedId != null
        ? String(row?.['Teléfono Acompañante'] ?? '')
        : telefonoAcompanante;
    const acompananteParentesco =
      selectedId != null
        ? String(row?.['Parentesco Acompanante'] ?? '')
        : parentescoLabel(parentescos, idParentescoAcompanante);
    const responsable =
      selectedId != null
        ? String(row?.Responsable ?? '')
        : responsableNombre;
    const responsableTel =
      selectedId != null
        ? String(row?.['Teléfono Responsable'] ?? '')
        : telefonoResponsable;
    const responsableParentesco =
      selectedId != null
        ? String(row?.['Parentesco Responsable'] ?? '')
        : parentescoLabel(parentescos, idParentescoResponsable);

    const edadStr =
      edadNum != null && edadNum !== '' ? `${edadNum} Años` : '';
    const fechaLarga = fechaHistoriaLarga(fechaBase);
    const hora = horaHistoria(fechaBase);
    const dir =
      patientFormFields?.direccionPaciente ||
      demografia?.direccion ||
      String(row?.['Dirección Domicilio'] ?? '') ||
      '';
    const tel =
      patientFormFields?.celularPaciente ||
      demografia?.telefono ||
      String(row?.['Teléfono Domicilio'] ?? '') ||
      '';
    const fnac = formatFechaNacimiento(
      patientFormFields?.nacimientoPaciente ||
        demografia?.fechaNacimiento ||
        row?.['Fecha Nacimiento'],
    );

    return {
      T1: nombre,
      T2: doc,
      T3: edadStr,
      T4: fechaLarga,
      T5: identificacion,
      T6: dir,
      T7: ciudad,
      T8: tel,
      T9: fnac,
      T10: sexo,
      T11: estadoCivil,
      T12: ocupacion,
      T13: eps,
      T15: acompananteNombre,
      T16: acompananteParentesco,
      T17: acompananteTel,
      T18: responsable,
      T19: responsableParentesco,
      T20: responsableTel,
      T21: user?.nombreUsuario ?? '',
      T22: hora,
      T26: tel,
      T27: tipoDoc,
      T30: fechaHistoriaNumerica(fechaBase),
    };
  }, [
    detailRows,
    selectedId,
    draftStartedAt,
    patientFormFields,
    demografia,
    documentoPaciente,
    evolucionSnapshot,
    nombreAcompanante,
    telefonoAcompanante,
    idParentescoAcompanante,
    responsableNombre,
    telefonoResponsable,
    idParentescoResponsable,
    parentescos,
    user,
  ]);

  async function onFormatoChange(fileName) {
    setError('');
    setFormatoUnavailable(false);
    if (!fileName) {
      if (savedFormatoFile) {
        setDiagGeneral('');
        setDiagEspecifico('');
      }
      clearFormato();
      return;
    }
    const ok = await loadFormato(fileName);
    if (!ok) {
      clearFormato();
    }
  }

  function setHcPanel(view) {
    if (view === 'notas') {
      startNuevaNota();
      return;
    }
    setMoreOpen(false);
    setHcView(view);
  }

  function openListModal(kind) {
    setMoreOpen(false);
    setListModal(kind);
  }

  return (
    <div className="page evolucion-page">
      <p className="page-eyebrow">Historia clínica</p>
      <h1>Evolución clínica (HC)</h1>
      <div className="evolucion-page-lead">
        <p className="muted evolucion-intro">
          Datos del paciente, nota de evolución y listado de atenciones previas.
        </p>
        {nombreEmpresa ? (
          <p className="evolucion-empresa-nombre">{nombreEmpresa}</p>
        ) : null}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <SavingOverlay show={saving} label={savingLabel} />

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
          className="hc-module--menu-overlay"
          defaultOpen
        >
          <div className="evolucion-toolbar">
            <div className="evolucion-toolbar-patient">
              {demografia?.fotoUrl ? (
                <img
                  className="paciente-foto paciente-foto--toolbar"
                  src={demografia.fotoUrl}
                  alt=""
                />
              ) : (
                <div
                  className="paciente-foto paciente-foto--toolbar paciente-foto--empty"
                  aria-hidden
                >
                  Sin foto
                </div>
              )}
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
            </div>
            <div className="evolucion-toolbar-actions">
              <div className="evolucion-toolbar-buttons">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => openListModal('anexos')}
                >
                  Documentos anexos
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => openListModal('observaciones')}
                >
                  Observaciones
                </button>
                <button
                  type="button"
                  className="secondary"
                  disabled={!hasPaciente}
                  onClick={() => openListModal('historial')}
                >
                  Imprimir historial
                </button>
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
              <div className="evolucion-more" ref={moreRef}>
                <button
                  type="button"
                  className="secondary evolucion-more-toggle"
                  aria-expanded={moreOpen}
                  aria-haspopup="menu"
                  onClick={() => setMoreOpen((v) => !v)}
                >
                  Otras opciones {moreOpen ? '▴' : '▾'}
                </button>
                {moreOpen ? (
                  <div className="evolucion-more-menu" role="menu">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => setHcPanel('odontograma')}
                    >
                      Odontograma
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => setHcPanel('notas')}
                    >
                      Notas aclaratorias
                    </button>
                  </div>
                ) : null}
              </div>
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
              onSaved={(opts) => {
                if (opts?.photoOnly) {
                  setPacienteDatos((prev) =>
                    prev?.demografia
                      ? {
                          ...prev,
                          demografia: {
                            ...prev.demografia,
                            fotoUrl: opts.fotoUrl ?? prev.demografia.fotoUrl,
                            fotoArchivo:
                              opts.fotoArchivo ?? prev.demografia.fotoArchivo,
                          },
                        }
                      : prev,
                  );
                  return;
                }
                void reloadPacienteDatos();
              }}
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
              {!lista.length && !draftStartedAt && !draftNotaAt && (
                <p className="muted">
                  Sin registros. Creá la primera en «Nota clínica».
                </p>
              )}
              <ul className="list compact evolucion-fechas">
              {draftStartedAt && (
                <li key="draft-new-evolucion">
                  <button
                    type="button"
                    className={
                      hcView === 'evolucion' &&
                      selectedOrigen === 'evolucion' &&
                      selectedId == null
                        ? 'evolucion-fecha-btn active'
                        : 'evolucion-fecha-btn'
                    }
                    onClick={startNueva}
                  >
                    <span className="td-strong">{draftFecha}</span>
                    <span className="muted">{draftHora}</span>
                    <span className="evolucion-pill borrador">Sin guardar</span>
                  </button>
                </li>
              )}
              {draftNotaAt && (
                <li key="draft-new-nota">
                  <button
                    type="button"
                    className={
                      hcView === 'notas' &&
                      selectedOrigen === 'nota' &&
                      selectedId == null
                        ? 'evolucion-fecha-btn active'
                        : 'evolucion-fecha-btn'
                    }
                    onClick={startNuevaNota}
                  >
                    <span className="td-strong">{draftNotaFecha}</span>
                    <span className="muted">{draftNotaHora}</span>
                    <span className="evolucion-pill borrador">Nota · sin guardar</span>
                  </button>
                </li>
              )}
              {lista.map((item) => (
                <li key={`${item.origen}-${item.id}`}>
                  <button
                    type="button"
                    className={
                      selectedOrigen === item.origen &&
                      Number(selectedId) === Number(item.id)
                        ? 'evolucion-fecha-btn active'
                        : 'evolucion-fecha-btn'
                    }
                    onClick={() =>
                      item.origen === 'nota'
                        ? void openNota(item.id)
                        : void openDetalle(item.id)
                    }
                  >
                    <span className="td-strong">{item.fechaEvolucion}</span>
                    <span className="muted">{item.hora}</span>
                    <span className="evolucion-pill abierto">
                      {item.origen === 'nota'
                        ? 'Nota aclaratoria'
                        : Number(item.idTipoEvaluacion) === 4
                          ? 'Formato'
                          : 'Evolución'}
                    </span>
                    <span
                      className={
                        item.origen === 'nota' || item.estado === 'Cerrado'
                          ? 'evolucion-pill cerrado'
                          : 'evolucion-pill abierto'
                      }
                    >
                      {item.origen === 'nota' ? 'Cerrado' : item.estado}
                    </span>
                  </button>
                </li>
              ))}
              </ul>
            </HcAccordionSection>

            <div className="evolucion-editor-stack">
              {hcView === 'odontograma' ? (
                <HcAccordionSection
                  title="Odontograma"
                  subtitle="Odontograma del paciente"
                  icon="◉"
                  defaultOpen
                >
                  <p className="muted">
                    Aquí irá el odontograma de la historia clínica.
                  </p>
                </HcAccordionSection>
              ) : hcView === 'notas' ? (
                <HcAccordionSection
                  title={
                    selectedOrigen === 'nota' && selectedId != null
                      ? `Notas aclaratorias — #${selectedId}`
                      : 'Notas aclaratorias — nueva'
                  }
                  subtitle={
                    selectedOrigen === 'nota' && selectedId != null
                      ? 'Consulta (esta nota ya no se puede editar)'
                      : 'Redactá la nota y guardala. Después solo se podrá consultar.'
                  }
                  icon="✎"
                  defaultOpen
                >
                  {selectedOrigen === 'nota' && selectedId != null ? (
                    <p className="muted evolucion-meta">
                      Profesional:{' '}
                      <strong>{notaProfesional || '—'}</strong>
                      {' · '}
                      Fecha:{' '}
                      <strong>
                        {notaFecha
                          ? new Date(notaFecha).toLocaleString()
                          : '—'}
                      </strong>
                    </p>
                  ) : null}
                  <label>
                    Nota aclaratoria
                    <textarea
                      className="evolucion-textarea"
                      rows={14}
                      value={notaTexto}
                      onChange={(e) => setNotaTexto(e.target.value)}
                      disabled={selectedOrigen === 'nota' && selectedId != null}
                    />
                  </label>
                  {!(selectedOrigen === 'nota' && selectedId != null) ? (
                    <div className="evolucion-actions">
                      <button
                        type="button"
                        disabled={saving || !String(notaTexto || '').trim()}
                        onClick={() => void guardarNota()}
                      >
                        {saving ? 'Guardando…' : 'Guardar nota'}
                      </button>
                    </div>
                  ) : (
                    <p className="muted">
                      Esta nota quedó cerrada al guardarse. Solo consulta.
                    </p>
                  )}
                </HcAccordionSection>
              ) : (
              <HcAccordionSection
                title={
                  selectedId == null
                    ? 'Nota clínica — nueva evolución'
                    : `Nota clínica — evolución #${selectedId}`
                }
                    subtitle="Formato HTML, diagnóstico y plan de manejo"
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
                {isSelectedClosed && !formatoUnavailable && (
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
                      Parentesco
                      <select
                        value={idParentescoAcompanante}
                        onChange={(e) =>
                          setIdParentescoAcompanante(e.target.value)
                        }
                      >
                        <option value="">— Selecciona —</option>
                        {parentescos.map((p) => (
                          <option key={String(p.id)} value={String(p.id)}>
                            {p.label}
                          </option>
                        ))}
                      </select>
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
                    <label>
                      Responsable
                      <input
                        value={responsableNombre}
                        onChange={(e) => setResponsableNombre(e.target.value)}
                      />
                    </label>
                    <label>
                      Parentesco responsable
                      <select
                        value={idParentescoResponsable}
                        onChange={(e) =>
                          setIdParentescoResponsable(e.target.value)
                        }
                      >
                        <option value="">— Selecciona —</option>
                        {parentescos.map((p) => (
                          <option key={`r-${String(p.id)}`} value={String(p.id)}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Tel. responsable
                      <input
                        value={telefonoResponsable}
                        onChange={(e) =>
                          setTelefonoResponsable(e.target.value)
                        }
                      />
                    </label>
                  </div>
                )}

                {showFormatoSelector && (
                  <label className="evolucion-formato-label">
                    Formato de historia clínica
                    <select
                      value={formatoFile}
                      disabled={selectedId != null || isSelectedClosed}
                      onChange={(e) => void onFormatoChange(e.target.value)}
                    >
                      {selectedId == null ? (
                        <>
                          <option value="">
                            — Texto libre (sin formato) —
                          </option>
                          {formatos.map((f) => (
                            <option key={f.fileName} value={f.fileName}>
                              {f.fileName}
                            </option>
                          ))}
                        </>
                      ) : (
                        <option value={formatoFile}>
                          {formatoFile || 'Formato'}
                        </option>
                      )}
                    </select>
                  </label>
                )}

                {formatoUnavailable ? (
                  <div className="alert alert-error">
                    No se encontró el archivo del formato en el servidor. Esta
                    historia clínica no se puede mostrar.
                  </div>
                ) : (
                  <>

                    {formatoLoading && (
                      <p className="muted">Cargando formato…</p>
                    )}

                    {formatoFile && formatoHtml ? (
                      <HcFormatEditor
                        key={`${formatoFile}-${selectedId ?? 'nueva'}`}
                        ref={formatRef}
                        applyKey={`${selectedId ?? 'nueva'}-${formatoFile}`}
                        html={formatoHtml}
                        logoFileUrl={formatoLogoFileUrl}
                        entidadFileUrls={entidadFileUrls}
                        entidadHttpUrls={entidadHttpUrls}
                        autofill={formatoPayload ? undefined : formatoAutofill}
                        payload={formatoPayload}
                        disabled={isSelectedClosed}
                      />
                    ) : formatoLoading ? null : (
                      <>
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
                      </>
                    )}

                    <div className="evolucion-actions">
                      {(formatoHtml ||
                        selectedId != null ||
                        String(diagGeneral || '').trim() ||
                        String(diagEspecifico || '').trim()) && (
                        <button
                          type="button"
                          className="secondary"
                          disabled={saving || formatoLoading}
                          onClick={() => void imprimirHistoria()}
                        >
                          Imprimir
                        </button>
                      )}
                      {selectedId == null ? (
                        <button
                          type="button"
                          disabled={saving || !hasPaciente}
                          onClick={() => void guardarNueva()}
                        >
                          {saving ? 'Guardando…' : 'Guardar evolución'}
                        </button>
                      ) : isSelectedOpen ? (
                        <>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => void guardarEdicion()}
                          >
                            {saving ? 'Guardando…' : 'Actualizar evolución'}
                          </button>
                          <button
                            type="button"
                            className="secondary"
                            disabled={saving}
                            onClick={() => pedirCerrarHistoriaClinica()}
                          >
                            {saving ? 'Cerrando…' : 'Cerrar HC'}
                          </button>
                        </>
                      ) : null}
                    </div>
                  </>
                )}
              </HcAccordionSection>
              )}
            </div>
          </div>
        </>
      )}

      {listModal === 'anexos' ? (
        <HcAnexosModal
          documentoPaciente={documentoPaciente}
          nombrePaciente={tituloPaciente}
          onClose={() => setListModal(null)}
        />
      ) : null}
      {listModal === 'observaciones' ? (
        <HcObservacionesModal
          documentoPaciente={documentoPaciente}
          nombrePaciente={tituloPaciente}
          onClose={() => setListModal(null)}
        />
      ) : null}
      {listModal === 'historial' ? (
        <HcHistorialPrintModal
          documentoPaciente={documentoPaciente}
          nombrePaciente={tituloPaciente}
          onClose={() => setListModal(null)}
        />
      ) : null}

      <ConfirmCloseDialog
        open={closeConfirmOpen}
        isFormato={Number(selectedItem?.idTipoEvaluacion) === 4}
        onCancel={() => setCloseConfirmOpen(false)}
        onConfirm={() => void confirmarCerrarHistoriaClinica()}
      />

      <p className="muted">
        <Link to="/principal/home">← Inicio</Link>
      </p>
    </div>
  );
}
