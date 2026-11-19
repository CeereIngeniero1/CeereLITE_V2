import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  createEvaluacion,
  createNotaAclaratoria,
  deleteEvolucionFirmaPaciente,
  fetchEvolucionDetalle,
  fetchEvolucionFirmaPacienteObjectUrl,
  fetchEvolucionesPaciente,
  fetchFirmaArchivoProfesional,
  fetchFormatoHcContenido,
  fetchFormatosHc,
  fetchNotaAclaratoria,
  fetchPacienteDatos,
  fetchParentescoCatalog,
  messageFromAxiosError,
  patchCerrarEvolucion,
  patchEvolucionDiagnosticos,
  saveEvolucionFirmaPaciente,
} from '../api/client';
import { useAlerts } from '../alerts/AlertContext';
import { useAuth } from '../auth/AuthContext';
import { useCompany } from '../auth/CompanyContext';
import { FirmaPacientePad } from '../components/FirmaPacientePad';
import { FormatoHcSearchSelect } from '../components/FormatoHcSearchSelect';
import { HcAccordionSection } from '../components/HcAccordionSection';
import { HcAnexosModal } from '../components/HcAnexosModal';
import { HcFormatEditor } from '../components/HcFormatEditor';
import { HcHistorialPrintModal } from '../components/HcHistorialPrintModal';
import { HcObservacionesModal } from '../components/HcObservacionesModal';
import { PacienteHcModal } from '../components/PacienteHcModal';
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
import { API_ORIGIN, getStoredHcDocumento, setStoredHcDocumento } from '../config';

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
  firmaPacienteUrl,
}) {
  const bodyGeneral = escapeHtml(general).replace(/\n/g, '<br>');
  const bodyEspecifico = escapeHtml(especifico).replace(/\n/g, '<br>');
  const firmaBlock = firmaPacienteUrl
    ? `<h2>Firma del paciente</h2>
  <div class="firma-box">
    <img src="${escapeHtml(firmaPacienteUrl)}" alt="Firma del paciente" />
  </div>`
    : '';
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Impreso por CeereSio</title>
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
    .firma-box {
      border: 1px solid #444;
      padding: 0.75rem;
      display: inline-block;
      background: #fff;
      page-break-inside: avoid;
    }
    .firma-box img {
      display: block;
      width: 260px;
      height: 120px;
      object-fit: contain;
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
  ${firmaBlock}
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

function hcTextoOpcional(value, fallback) {
  const s = String(value ?? '').trim();
  return s || fallback;
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
  const { notifyOk, notifyError } = useAlerts();
  const { documentoEmpresa, nombreComercialEmpresa } = useCompany();
  const stateDoc = String(location.state?.documentoPaciente ?? '').trim();
  const documentoPaciente = stateDoc || getStoredHcDocumento();
  const formatRef = useRef(null);
  const firmaPadRef = useRef(null);

  const [pacienteDatos, setPacienteDatos] = useState(null);
  const [patientFormFields, setPatientFormFields] = useState(null);
  const [lista, setLista] = useState([]);

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
  const [formatoPrecargaLoading, setFormatoPrecargaLoading] = useState(false);
  const [firmaPacienteUrl, setFirmaPacienteUrl] = useState(null);
  const [firmaPacienteArchivo, setFirmaPacienteArchivo] = useState(null);
  const [firmaPacienteSaving, setFirmaPacienteSaving] = useState(false);
  const [firmaProfArchivo, setFirmaProfArchivo] = useState(null);
  const [firmaProfUrl, setFirmaProfUrl] = useState(null);

  const [draftStartedAt, setDraftStartedAt] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingLabel, setSavingLabel] = useState('Guardando…');
  const [error, setError] = useState('');
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(
    () =>
      Boolean(location.state?.buscarPaciente) ||
      !(
        String(location.state?.documentoPaciente ?? '').trim() ||
        getStoredHcDocumento()
      ),
  );
  const [moreOpen, setMoreOpen] = useState(false);
  const [listModal, setListModal] = useState(null);
  const [hcView, setHcView] = useState('evolucion');
  const moreRef = useRef(null);

  const demografia = pacienteDatos?.demografia ?? null;
  const evolucionSnapshot = pacienteDatos?.evolucionSnapshot ?? null;
  const hasPaciente = Boolean(
    demografia &&
      (String(demografia.nombreCompleto ?? '').trim() ||
        String(demografia.primerNombre ?? '').trim()),
  );

  useEffect(() => {
    if (stateDoc) setStoredHcDocumento(stateDoc);
  }, [stateDoc]);

  const reloadPacienteDatos = useCallback(async () => {
    if (!documentoPaciente) return;
    const data = await fetchPacienteDatos(documentoPaciente);
    setPacienteDatos(data);
  }, [documentoPaciente]);

  const reloadLista = useCallback(async () => {
    if (!documentoPaciente) return;
    try {
      const ev = await fetchEvolucionesPaciente(documentoPaciente);
      setLista(Array.isArray(ev) ? ev : []);
    } catch {
      setLista([]);
    }
  }, [documentoPaciente]);

  useEffect(() => {
    if (!documentoPaciente) {
      setPacienteDatos(null);
      setLista([]);
      setLoading(false);
      return;
    }
    let cancel = false;
    setLoading(true);
    setError('');
    (async () => {
      const [datosR, listaR] = await Promise.allSettled([
        fetchPacienteDatos(documentoPaciente),
        fetchEvolucionesPaciente(documentoPaciente),
      ]);
      if (cancel) return;
      const parts = [];
      if (datosR.status === 'fulfilled') {
        setPacienteDatos(datosR.value ?? null);
      } else {
        setPacienteDatos(null);
        parts.push(
          await messageFromAxiosError(
            datosR.reason,
            'No se pudieron cargar los datos del paciente',
          ),
        );
      }
      if (listaR.status === 'fulfilled') {
        setLista(Array.isArray(listaR.value) ? listaR.value : []);
      } else {
        setLista([]);
        parts.push(
          await messageFromAxiosError(
            listaR.reason,
            'No se pudieron cargar las evoluciones',
          ),
        );
      }
      setError(parts.join(' '));
      setLoading(false);
    })();
    return () => {
      cancel = true;
    };
  }, [documentoPaciente]);

  useEffect(() => {
    if (String(location.state?.documentoPaciente ?? '').trim()) {
      setPickerOpen(false);
      return;
    }
    if (location.state?.buscarPaciente) {
      setPickerOpen(true);
    }
  }, [location.key, location.state?.buscarPaciente, location.state?.documentoPaciente]);

  function closePacientePicker() {
    setPickerOpen(false);
  }

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
    setFormatoPrecargaLoading(false);
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
    revokeFirmaUrl(firmaPacienteUrl);
    setFirmaPacienteUrl(null);
    setFirmaPacienteArchivo(null);
    void loadFirmaProfesional(user?.documentoEntidad);
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

  function revokeFirmaUrl(url) {
    if (url && String(url).startsWith('blob:')) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        /* ignore */
      }
    }
  }

  function setFirmaPacienteFromArchivo(archivoRaw) {
    const base = String(archivoRaw ?? '')
      .trim()
      .replace(/^.*[\\/]/, '');
    revokeFirmaUrl(firmaPacienteUrl);
    if (!base) {
      setFirmaPacienteArchivo(null);
      setFirmaPacienteUrl(null);
      return;
    }
    setFirmaPacienteArchivo(base);
    setFirmaPacienteUrl(
      `${API_ORIGIN.replace(/\/$/, '')}/firma-entidad/${encodeURIComponent(base)}`,
    );
  }

  async function loadFirmaPaciente(id, archivoHint) {
    revokeFirmaUrl(firmaPacienteUrl);
    setFirmaPacienteUrl(null);
    setFirmaPacienteArchivo(null);
    if (id == null) return;
    const hint = String(archivoHint ?? '')
      .trim()
      .replace(/^.*[\\/]/, '');
    if (hint) {
      setFirmaPacienteFromArchivo(hint);
      return;
    }
    try {
      const data = await fetchEvolucionFirmaPacienteObjectUrl(id);
      if (!data?.url) {
        setFirmaPacienteUrl(null);
        return;
      }
      if (data.archivo) {
        // Preferir URL estática (iframe/impresión del formato Entidad2).
        revokeFirmaUrl(data.url);
        setFirmaPacienteFromArchivo(data.archivo);
      } else {
        setFirmaPacienteUrl(data.url);
      }
    } catch {
      setFirmaPacienteUrl(null);
    }
  }

  async function loadFirmaProfesional(documento) {
    const doc = String(documento ?? '').trim();
    setFirmaProfArchivo(null);
    setFirmaProfUrl(null);
    if (!doc) return;
    try {
      const data = await fetchFirmaArchivoProfesional(doc);
      setFirmaProfArchivo(data?.archivo || null);
      setFirmaProfUrl(data?.url || null);
    } catch {
      setFirmaProfArchivo(null);
      setFirmaProfUrl(null);
    }
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
      const row0 = arr[0];
      const { general, especifico } = pickDiagFromRow(row0);
      const profDoc =
        String(
          row0?.['Documento Profesional'] ??
            row0?.DocumentoProfesional ??
            user?.documentoEntidad ??
            '',
        ).trim() || String(user?.documentoEntidad ?? '').trim();
      const firmaArchivoRow = String(
        row0?.['Firma Archivo Profesional'] ?? '',
      ).trim();
      if (firmaArchivoRow) {
        const base = String(firmaArchivoRow).replace(/^.*[\\/]/, '');
        setFirmaProfArchivo(base);
        setFirmaProfUrl(
          `${API_ORIGIN.replace(/\/$/, '')}/firma-entidad/${encodeURIComponent(base)}`,
        );
      } else {
        void loadFirmaProfesional(profDoc);
      }
      const firmaPacienteRow = String(
        row0?.['Firma Archivo Paciente'] ??
          row0?.['Firma Evaluación Entidad'] ??
          '',
      ).trim();
      void loadFirmaPaciente(id, firmaPacienteRow);
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
      const msg = 'La nota aclaratoria no puede estar vacía.';
      setError(msg);
      notifyError(msg);
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
      notifyOk('Nota aclaratoria guardada.');
    } catch (e) {
      const msg =
        e.response?.data?.message ??
        e.response?.data?.error ??
        e.message ??
        'No se pudo guardar la nota aclaratoria';
      setError(msg);
      notifyError(msg);
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

  /**
   * Persiste la evolución actual (alta o actualización) y devuelve su id.
   * Usado por Guardar / Actualizar y por el flujo de firma del paciente.
   */
  async function persistEvolucionActual() {
    if (!documentoPaciente || !hasPaciente) {
      throw new Error('Seleccione un paciente antes de guardar.');
    }
    if (selectedOrigen !== 'evolucion') {
      throw new Error('Solo se puede firmar una evolución clínica.');
    }
    if (
      selectedId != null &&
      lista.some(
        (x) =>
          x.origen === 'evolucion' &&
          Number(x.id) === Number(selectedId) &&
          x.estado === 'Cerrado',
      )
    ) {
      throw new Error('Esta HC está cerrada; no se puede modificar ni firmar.');
    }

    const { diagnosticoGeneral, diagnosticoEspecifico } = collectDiagnosticos();

    if (selectedId != null) {
      await patchEvolucionDiagnosticos(selectedId, {
        diagnosticoGeneral,
        diagnosticoEspecifico,
      });
      setDiagGeneral(diagnosticoGeneral);
      setDiagEspecifico(diagnosticoEspecifico);
      await reloadLista();
      return Number(selectedId);
    }

    const body = buildCreatePayload({
      formFields: patientFormFields,
      evolucionSnapshot,
      documentoPaciente,
      documentoEmpresa,
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
    if (idEvaluacion == null) {
      throw new Error('No se obtuvo el id de la evolución al guardar.');
    }
    await reloadLista();
    await openDetalle(idEvaluacion);
    return Number(idEvaluacion);
  }

  async function guardarNueva() {
    if (!documentoPaciente || !hasPaciente) return;
    setSaving(true);
    setSavingLabel('Guardando evolución…');
    setError('');
    try {
      await persistEvolucionActual();
      notifyOk('Evolución guardada.');
    } catch (e) {
      const msg =
        e.response?.data?.message ??
        e.response?.data?.error ??
        e.message ??
        'Error al guardar';
      setError(msg);
      notifyError(msg);
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
      await persistEvolucionActual();
      notifyOk('Cambios de la evolución guardados.');
    } catch (e) {
      const msg =
        e.response?.data?.message ??
        e.response?.data?.error ??
        e.message ??
        'Error al guardar';
      setError(msg);
      notifyError(msg);
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
      // Formatos: solo Entidad3 (firma profesional) si el HTML la trae.
      const ok = formatRef.current?.print();
      if (!ok) {
        const msg = 'No se pudo imprimir el formato';
        setError(msg);
        notifyError(msg);
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
      firmaPacienteUrl,
    });
    if (!ok) {
      const msg = 'No se pudo preparar la impresión de esta historia clínica.';
      setError(msg);
      notifyError(msg);
    }
  }

  async function guardarFirmaPaciente(dataUrl) {
    if (selectedOrigen !== 'evolucion') {
      throw new Error('Solo se puede firmar una evolución clínica.');
    }
    if (isSelectedClosed) {
      throw new Error('Esta HC está cerrada; no se puede firmar.');
    }
    const eraBorrador = selectedId == null;
    setFirmaPacienteSaving(true);
    setSaving(true);
    setSavingLabel(
      eraBorrador
        ? 'Guardando evolución y firma…'
        : 'Guardando firma del paciente…',
    );
    setError('');
    try {
      // Si aún no hay id (borrador), guarda la HC hasta donde está y luego la firma.
      const id = await persistEvolucionActual();
      const saved = await saveEvolucionFirmaPaciente(id, dataUrl);
      setFirmaPacienteFromArchivo(saved?.archivo);
      if (!saved?.archivo) {
        await loadFirmaPaciente(id);
      }
      notifyOk(
        eraBorrador
          ? 'Evolución y firma del paciente guardadas.'
          : 'Firma del paciente guardada.',
      );
    } catch (e) {
      const msg = await messageFromAxiosError(
        e,
        'No se pudo guardar la firma del paciente',
      );
      setError(msg);
      notifyError(msg);
      throw new Error(msg);
    } finally {
      setFirmaPacienteSaving(false);
      setSaving(false);
    }
  }

  async function irAFirmarPaciente() {
    if (!canFirmarPaciente) return;
    setError('');
    try {
      // Al ir a firmar, persistir lo escrito hasta ahora (alta o update).
      setSaving(true);
      setSavingLabel(
        selectedId == null
          ? 'Guardando evolución para firmar…'
          : 'Actualizando evolución…',
      );
      const wasDraft = selectedId == null;
      await persistEvolucionActual();
      if (wasDraft) {
        notifyOk('Evolución guardada. Puede firmar el paciente.');
      }
    } catch (e) {
      const msg = await messageFromAxiosError(
        e,
        'No se pudo guardar la evolución para firmar',
      );
      setError(msg);
      notifyError(msg);
      return;
    } finally {
      setSaving(false);
    }
    requestAnimationFrame(() => {
      firmaPadRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    });
  }

  async function quitarFirmaPaciente() {
    if (selectedId == null) return;
    setFirmaPacienteSaving(true);
    try {
      await deleteEvolucionFirmaPaciente(selectedId);
      revokeFirmaUrl(firmaPacienteUrl);
      setFirmaPacienteUrl(null);
      setFirmaPacienteArchivo(null);
      notifyOk('Firma del paciente eliminada.');
    } catch (e) {
      const msg = await messageFromAxiosError(
        e,
        'No se pudo eliminar la firma',
      );
      notifyError(msg);
    } finally {
      setFirmaPacienteSaving(false);
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
      notifyOk('Historia clínica cerrada.');
    } catch (e) {
      const msg =
        e.response?.data?.message ??
        e.response?.data?.error ??
        e.message ??
        'No se pudo cerrar la evolución';
      setError(msg);
      notifyError(msg);
    } finally {
      setSaving(false);
    }
  }

  const tituloPaciente = useMemo(() => {
    if (!demografia) return documentoPaciente ?? '';
    return demografia.nombreCompleto ?? documentoPaciente;
  }, [demografia, documentoPaciente]);
  const nombreEmpresa = nombreComercialEmpresa;
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
  /** Borrador nuevo o HC abierta: puede firmar. Cerrada: no. */
  const canFirmarPaciente =
    hcView === 'evolucion' &&
    selectedOrigen === 'evolucion' &&
    hasPaciente &&
    !isSelectedClosed &&
    (selectedId == null || isSelectedOpen);
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
    formatoFile && String(diagEspecifico || '').trim()
      ? diagEspecifico
      : '';

  const entidadFileUrls = useMemo(() => {
    const dirs = formatoFileDirs ?? {};
    const pacienteDoc = String(documentoPaciente ?? '').trim();
    const fotoArchivo =
      demografia?.fotoArchivo || (pacienteDoc ? `${pacienteDoc}.jpg` : '');
    const firmaProf = String(firmaProfArchivo ?? '').trim();
    const firmaPac = String(firmaPacienteArchivo ?? '').trim();
    return {
      Entidad1: fotoArchivo
        ? joinFileDir(dirs.fotoEntidad, fotoArchivo)
        : '',
      // Formatos Ceere: Entidad2 = paciente / representante
      Entidad2:
        firmaPac && dirs.firmaEntidad
          ? joinFileDir(dirs.firmaEntidad, firmaPac)
          : '',
      // Entidad3 = profesional (Entidad.[Firma Entidad])
      Entidad3:
        firmaProf && dirs.firmaEntidad
          ? joinFileDir(dirs.firmaEntidad, firmaProf)
          : '',
    };
  }, [
    formatoFileDirs,
    documentoPaciente,
    demografia?.fotoArchivo,
    firmaProfArchivo,
    firmaPacienteArchivo,
  ]);

  const entidadHttpUrls = useMemo(() => {
    const origin = API_ORIGIN.replace(/\/$/, '');
    const pacienteDoc = String(documentoPaciente ?? '').trim();
    const fotoHttp =
      demografia?.fotoUrl ||
      (pacienteDoc
        ? `${origin}/static-images/${encodeURIComponent(`${pacienteDoc}.jpg`)}`
        : '');
    const firmaPacHttp = firmaPacienteArchivo
      ? `${origin}/firma-entidad/${encodeURIComponent(firmaPacienteArchivo)}`
      : firmaPacienteUrl || '';
    return {
      Entidad1: fotoHttp,
      Entidad2: firmaPacHttp,
      Entidad3: firmaProfUrl || '',
    };
  }, [
    documentoPaciente,
    demografia?.fotoUrl,
    firmaProfUrl,
    firmaPacienteArchivo,
    firmaPacienteUrl,
  ]);

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
      T15: hcTextoOpcional(acompananteNombre, 'Sin asignar'),
      T16: hcTextoOpcional(acompananteParentesco, 'Sin asignar'),
      T17: hcTextoOpcional(acompananteTel, '000-00-00'),
      T18: hcTextoOpcional(responsable, 'Sin asignar'),
      T19: hcTextoOpcional(responsableParentesco, 'Sin asignar'),
      T20: hcTextoOpcional(responsableTel, '000-00-00'),
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

  async function findLastFormatoPayload(fileName) {
    const target = String(fileName ?? '').trim().toLowerCase();
    if (!target) return '';
    const candidatos = lista.filter(
      (x) => x.origen === 'evolucion' && Number(x.idTipoEvaluacion) === 4,
    );
    for (const item of candidatos) {
      try {
        const rows = await fetchEvolucionDetalle(item.id);
        const arr = Array.isArray(rows) ? rows : [];
        const { general, especifico } = pickDiagFromRow(arr[0]);
        const name = parseFormatoFileName(general);
        if (name && name.toLowerCase() === target) {
          return String(especifico || '').trim();
        }
      } catch {
        /* siguiente candidato */
      }
    }
    return '';
  }

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
    if (selectedId == null) {
      setDiagEspecifico('');
      setFormatoPrecargaLoading(true);
    }
    const ok = await loadFormato(fileName);
    if (!ok) {
      setFormatoPrecargaLoading(false);
      clearFormato();
      return;
    }
    if (selectedId != null) return;
    try {
      const payload = await findLastFormatoPayload(fileName);
      setDiagEspecifico(payload);
    } finally {
      setFormatoPrecargaLoading(false);
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
        <div className="evolucion-empty-picker">
          <p className="muted">
            Busque un paciente para abrir la historia clínica, o ábralo desde{' '}
            <Link to="/principal/usuarios">Usuarios</Link> o Agenda.
          </p>
          {!pickerOpen ? (
            <button
              type="button"
              className="secondary"
              onClick={() => setPickerOpen(true)}
            >
              Buscar paciente
            </button>
          ) : null}
        </div>
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
                  onClick={() => setPickerOpen(true)}
                >
                  Buscar paciente
                </button>
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
          </div>
        </HcAccordionSection>
      )}

      {documentoPaciente && loading && (
        <p className="muted">Cargando historia y listado…</p>
      )}

      {documentoPaciente && !loading && !hasPaciente && (
        <div className="alert alert-error">
          No se encontraron datos demográficos de este paciente. Puede continuar
          con el listado y una nueva evolución.
        </div>
      )}

      {documentoPaciente && !loading && (
        <>
          {hasPaciente ? (
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
          ) : null}

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
                {canFirmarPaciente ? (
                  <div className="evolucion-firma-bar">
                    <button
                      type="button"
                      className="secondary"
                      disabled={saving || firmaPacienteSaving || formatoLoading}
                      onClick={() => void irAFirmarPaciente()}
                    >
                      Firmar paciente
                    </button>
                    <p className="muted evolucion-firma-bar-hint">
                      {selectedId == null
                        ? 'Al firmar se guarda la evolución con lo escrito hasta ahora. Después de cerrar la HC ya no se podrá firmar.'
                        : 'HC abierta: puede firmar o actualizar la firma. Al cerrar la HC la firma queda bloqueada.'}
                    </p>
                  </div>
                ) : null}
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
                    Esta HC está cerrada. Puedes consultarla, pero no editarla ni
                    firmarla.
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
                    <FormatoHcSearchSelect
                      formatos={formatos}
                      value={formatoFile}
                      disabled={
                        selectedId != null ||
                        isSelectedClosed ||
                        formatoPrecargaLoading
                      }
                      onChange={(fileName) => void onFormatoChange(fileName)}
                    />
                  </label>
                )}

                {formatoUnavailable ? (
                  <div className="alert alert-error">
                    No se encontró el archivo del formato en el servidor. Esta
                    historia clínica no se puede mostrar.
                  </div>
                ) : (
                  <>

                    {(formatoLoading || formatoPrecargaLoading) && (
                      <p className="muted">Cargando formato…</p>
                    )}

                    {formatoFile && formatoHtml && !formatoPrecargaLoading ? (
                      <HcFormatEditor
                        key={`${formatoFile}-${selectedId ?? 'nueva'}-${String(diagEspecifico || '').length}`}
                        ref={formatRef}
                        applyKey={`${selectedId ?? 'nueva'}-${formatoFile}`}
                        html={formatoHtml}
                        logoFileUrl={formatoLogoFileUrl}
                        entidadFileUrls={entidadFileUrls}
                        entidadHttpUrls={entidadHttpUrls}
                        autofill={formatoAutofill}
                        payload={formatoPayload}
                        disabled={isSelectedClosed}
                      />
                    ) : formatoLoading || formatoPrecargaLoading ? null : (
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

                    {selectedOrigen === 'evolucion' ? (
                      <div ref={firmaPadRef}>
                        <FirmaPacientePad
                          existingUrl={firmaPacienteUrl}
                          disabled={!canFirmarPaciente}
                          saving={firmaPacienteSaving || saving}
                          draftHint={selectedId == null}
                          onSave={guardarFirmaPaciente}
                          onClear={
                            selectedId != null ? quitarFirmaPaciente : undefined
                          }
                        />
                      </div>
                    ) : null}

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

      {pickerOpen ? (
        <PacienteHcModal onClose={closePacientePicker} />
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
