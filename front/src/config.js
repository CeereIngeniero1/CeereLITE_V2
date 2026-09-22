const API_ORIGIN =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ?? 'http://localhost:3001';

export const API_V1 = `${API_ORIGIN}/api/v1`;
export { API_ORIGIN };

export function getStoredToken() {
  return localStorage.getItem('token');
}

export function setStoredToken(token) {
  localStorage.setItem('token', token);
}

export function clearStoredToken() {
  localStorage.removeItem('token');
}

const EMPRESA_KEY = 'ceere.empresa';

export function getStoredEmpresa() {
  try {
    const raw = localStorage.getItem(EMPRESA_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const documentoEmpresa = String(parsed?.documentoEmpresa ?? '').trim();
    if (!documentoEmpresa) return null;
    return {
      documentoEmpresa,
      nombreComercialEmpresa: String(
        parsed?.nombreComercialEmpresa ?? '',
      ).trim(),
    };
  } catch {
    return null;
  }
}

export function setStoredEmpresa(empresa) {
  localStorage.setItem(
    EMPRESA_KEY,
    JSON.stringify({
      documentoEmpresa: String(empresa?.documentoEmpresa ?? '').trim(),
      nombreComercialEmpresa: String(
        empresa?.nombreComercialEmpresa ?? '',
      ).trim(),
    }),
  );
}

export function clearStoredEmpresa() {
  localStorage.removeItem(EMPRESA_KEY);
}

const HC_DOC_KEY = 'ceerelite.hc.documentoPaciente';

export function getStoredHcDocumento() {
  return String(sessionStorage.getItem(HC_DOC_KEY) ?? '').trim();
}

export function setStoredHcDocumento(documento) {
  const doc = String(documento ?? '').trim();
  if (!doc) {
    sessionStorage.removeItem(HC_DOC_KEY);
    return;
  }
  sessionStorage.setItem(HC_DOC_KEY, doc);
}

export function clearStoredHcDocumento() {
  sessionStorage.removeItem(HC_DOC_KEY);
}

const AGENDA_FECHA_KEY = 'ceere.agendaFecha';

export function getStoredAgendaFecha() {
  const s = String(sessionStorage.getItem(AGENDA_FECHA_KEY) ?? '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}

export function setStoredAgendaFecha(fecha) {
  const s = String(fecha ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    sessionStorage.removeItem(AGENDA_FECHA_KEY);
    return;
  }
  sessionStorage.setItem(AGENDA_FECHA_KEY, s);
}
