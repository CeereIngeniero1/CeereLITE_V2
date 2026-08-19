import axios from 'axios';
import { API_V1, clearStoredToken, getStoredToken } from '../config.js';

export const api = axios.create({
  baseURL: API_V1,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      clearStoredToken();
    }
    return Promise.reject(err);
  },
);

export async function login(username, password) {
  const { data } = await api.post('/auth/login', { username, password });
  return data;
}

export async function fetchMe() {
  const { data } = await api.get('/auth/me');
  return data;
}

export async function fetchCompanies() {
  const { data } = await api.get('/company');
  return data;
}

export async function fetchCompanyDetail(docEmpresa) {
  const { data } = await api.get(`/company/${encodeURIComponent(docEmpresa)}`);
  return data;
}

export async function fetchUsers() {
  const { data } = await api.get('/users');
  return data;
}

export async function fetchHealthDb() {
  const base = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ?? 'http://localhost:3001';
  const { data } = await axios.get(`${base}/health/db`);
  return data;
}

/** @param {string} documento */
export async function fetchEvolucionesPaciente(documento) {
  const { data } = await api.get(
    `/evolucion/paciente/${encodeURIComponent(documento)}/evoluciones`,
  );
  return data;
}

/** @param {string} documento */
export async function fetchPacienteHc(documento) {
  const { data } = await api.get(
    `/evolucion/paciente/${encodeURIComponent(documento)}/hc`,
  );
  return data;
}

/** @param {string} documento */
export async function fetchPacienteDatos(documento) {
  const { data } = await api.get(
    `/evolucion/paciente/${encodeURIComponent(documento)}/datos`,
  );
  return data;
}

/** @param {string} documento @param {Record<string, unknown>} body */
export async function updatePacienteDatos(documento, body) {
  const { data } = await api.post(
    `/evolucion/paciente/${encodeURIComponent(documento)}/datos`,
    body,
  );
  return data;
}

/** @param {string} segment @param {string} [q] */
export async function fetchPacienteCatalog(segment, q) {
  const { data } = await api.get(
    `/evolucion/catalog/paciente/${encodeURIComponent(segment)}`,
    { params: q ? { q } : {} },
  );
  return data;
}

export async function fetchTiposEvaluacion() {
  const { data } = await api.get('/evolucion/tipos-evaluacion');
  return data;
}

/** @param {number} id */
export async function fetchEvolucionDetalle(id) {
  const { data } = await api.get(`/evolucion/${id}`);
  return data;
}

/** @param {Record<string, unknown>} body */
export async function createEvaluacion(body) {
  const { data } = await api.post('/evolucion', body);
  return data;
}

/** @param {number} id @param {Record<string, unknown>} body */
export async function patchEvolucionDiagnosticos(id, body) {
  const { data } = await api.patch(`/evolucion/${id}/diagnosticos`, body);
  return data;
}

/** @param {number} id */
export async function patchCerrarEvolucion(id) {
  const { data } = await api.patch(`/evolucion/${id}/cerrar`);
  return data;
}

/** @param {string} segment last path of /evolucion/catalog/rips/… */
export async function fetchEvolucionRipsCatalog(segment) {
  const { data } = await api.get(`/evolucion/catalog/rips/${segment}`);
  return data;
}

/** @param {'AC'|'AP'} tipo @param {string} [q] */
export async function fetchRipsCups(tipo, q) {
  const { data } = await api.get(
    `/evolucion/catalog/rips/cups/${encodeURIComponent(tipo)}`,
    { params: q != null && q !== '' ? { q } : {} },
  );
  return data;
}

/** @param {string} [q] */
export async function fetchRipsCie(q) {
  const { data } = await api.get('/evolucion/catalog/rips/cie', {
    params: q != null && q !== '' ? { q } : {},
  });
  return data;
}

/** @param {number} evalId */
export async function fetchEvolucionRipsLines(evalId) {
  const { data } = await api.get(`/evolucion/${evalId}/rips`);
  return data;
}

/** @param {number} evalId @param {Record<string, unknown>} body */
export async function postEvolucionRips(evalId, body) {
  const { data } = await api.post(`/evolucion/${evalId}/rips`, body);
  return data;
}

/** @param {string} clave @param {string} [q] */
export async function fetchRdaCatalog1888(clave, q) {
  const { data } = await api.get(
    `/rda/catalog/1888/${encodeURIComponent(clave)}`,
    { params: q ? { q } : {} },
  );
  return data;
}

export async function fetchRdaOverview() {
  const { data } = await api.get('/rda');
  return data;
}

export async function fetchRdaClaves1888() {
  const { data } = await api.get('/rda/catalog/claves-1888');
  return data;
}

/** @param {'egreso-remision'|'factor-riesgo'|'tipo-tecnologia-salud'} segment @param {string} [q] */
export async function fetchRdaCatalogFixed(segment, q) {
  const { data } = await api.get(`/rda/catalog/${segment}`, {
    params: q ? { q } : {},
  });
  return data;
}
