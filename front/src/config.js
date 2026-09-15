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
