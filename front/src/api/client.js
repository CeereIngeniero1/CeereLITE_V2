import axios from 'axios';
import { API_V1, clearStoredEmpresa, clearStoredHcDocumento, clearStoredToken, getStoredToken } from '../config.js';

export const api = axios.create({
  baseURL: API_V1,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    const headers = config.headers;
    if (headers && typeof headers.delete === 'function') {
      headers.delete('Content-Type');
    } else if (headers) {
      delete headers['Content-Type'];
    }
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      clearStoredToken();
      clearStoredEmpresa();
      clearStoredHcDocumento();
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

export async function updateMe(body) {
  const { data } = await api.patch('/auth/me', body);
  return data;
}

/** @param {File} file */
export async function uploadMeFoto(file) {
  const body = new FormData();
  body.append('file', file);
  const { data } = await api.post('/auth/me/foto', body);
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
export async function fetchPacienteAnexos(documento) {
  const { data } = await api.get(
    `/evolucion/paciente/${encodeURIComponent(documento)}/anexos`,
  );
  return data;
}

/** @param {string} documento @param {File} file @param {string} nombre */
export async function createPacienteAnexo(documento, file, nombre) {
  const body = new FormData();
  body.append('file', file);
  if (nombre) body.append('nombre', nombre);
  const { data } = await api.post(
    `/evolucion/paciente/${encodeURIComponent(documento)}/anexos`,
    body,
  );
  return data;
}

/** @param {string} documento @param {number} id @param {File} file */
export async function uploadPacienteAnexoArchivo(documento, id, file) {
  const body = new FormData();
  body.append('file', file);
  const { data } = await api.post(
    `/evolucion/paciente/${encodeURIComponent(documento)}/anexos/${id}/archivo`,
    body,
  );
  return data;
}

function parseContentDispositionFileName(header) {
  if (!header) return '';
  const star = /filename\*=(?:UTF-8'')?([^;]+)/i.exec(header);
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1].trim().replace(/^"(.*)"$/, '$1'));
    } catch {
      /* ignore */
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain?.[1]?.trim() ?? '';
}

async function messageFromAxiosError(e, fallback) {
  const data = e.response?.data;
  if (typeof Blob !== 'undefined' && data instanceof Blob) {
    try {
      const parsed = JSON.parse(await data.text());
      const msg = parsed.message ?? parsed.error;
      return Array.isArray(msg) ? msg.join(', ') : msg || fallback;
    } catch {
      return fallback;
    }
  }
  const msg = data?.message ?? data?.error ?? e.message;
  return Array.isArray(msg) ? msg.join(', ') : msg || fallback;
}

/** @param {string} documento @param {number} id */
export async function fetchPacienteAnexoArchivo(documento, id) {
  const res = await api.get(
    `/evolucion/paciente/${encodeURIComponent(documento)}/anexos/${id}/archivo`,
    { responseType: 'blob' },
  );
  const blob = res.data;
  if (blob?.type && blob.type.includes('application/json')) {
    let msg = 'No se pudo abrir el documento';
    try {
      const parsed = JSON.parse(await blob.text());
      msg = parsed.message ?? parsed.error ?? msg;
      if (Array.isArray(msg)) msg = msg.join(', ');
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  const fileName = parseContentDispositionFileName(
    res.headers?.['content-disposition'],
  );
  return { blob, fileName };
}

export { messageFromAxiosError };

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

/** @param {string} documento @param {File} file */
export async function uploadPacienteFoto(documento, file) {
  const body = new FormData();
  body.append('file', file);
  const { data } = await api.post(
    `/evolucion/paciente/${encodeURIComponent(documento)}/foto`,
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

export async function fetchParentescoCatalog(q) {
  const { data } = await api.get('/evolucion/catalog/parentesco', {
    params: q ? { q } : {},
  });
  return data;
}

export async function fetchFormatosHc() {
  const { data } = await api.get('/evolucion/formatos');
  return data;
}

/** @param {string} fileName */
export async function fetchFormatoHcContenido(fileName) {
  const { data } = await api.get('/evolucion/formatos/contenido', {
    params: { file: fileName },
  });
  return data;
}

export async function fetchTiposEvaluacion() {
  const { data } = await api.get('/evolucion/tipos-evaluacion');
  return data;
}

/** @param {string} documento @param {string} desde @param {string} hasta */
export async function fetchHistorialHc(documento, desde, hasta) {
  const { data } = await api.get(
    `/evolucion/paciente/${encodeURIComponent(documento)}/historial`,
    { params: { desde, hasta } },
  );
  return data;
}

/** @param {string} documento */
export async function fetchPacienteObservaciones(documento) {
  const { data } = await api.get(
    `/evolucion/paciente/${encodeURIComponent(documento)}/observaciones`,
  );
  return data;
}

/** @param {string} documento @param {string} observacion */
export async function createPacienteObservacion(documento, observacion) {
  const { data } = await api.post(
    `/evolucion/paciente/${encodeURIComponent(documento)}/observaciones`,
    { observacion },
  );
  return data;
}

/** @param {string} documento @param {number} id @param {{ observacion: string, idEstado: number }} body */
export async function updatePacienteObservacion(documento, id, body) {
  const { data } = await api.patch(
    `/evolucion/paciente/${encodeURIComponent(documento)}/observaciones/${id}`,
    body,
  );
  return data;
}

/** @param {number} id */
export async function fetchEvolucionDetalle(id) {
  const { data } = await api.get(`/evolucion/${id}`);
  return data;
}

/** @param {number} id @param {string} documento */
export async function fetchNotaAclaratoria(id, documento) {
  const { data } = await api.get(`/evolucion/notas-aclaratorias/${id}`, {
    params: { documento },
  });
  return data;
}

/** @param {{ documentoPaciente: string, nota: string }} body */
export async function createNotaAclaratoria(body) {
  const { data } = await api.post('/evolucion/notas-aclaratorias', body);
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

/** @param {string} fecha YYYY-MM-DD @param {string} documentoEmpresa */
export async function fetchAgendaCitas(fecha, documentoEmpresa) {
  const { data } = await api.get('/agenda/citas', {
    params: { fecha, documentoEmpresa },
  });
  return data;
}

/** @param {string} documentoPaciente @param {string} documentoEmpresa */
export async function fetchAgendaCitasPaciente(
  documentoPaciente,
  documentoEmpresa,
) {
  const { data } = await api.get('/agenda/citas', {
    params: { documentoPaciente, documentoEmpresa },
  });
  return data;
}

/** @param {string} fecha YYYY-MM-DD @param {string} documentoEmpresa */
export async function fetchAgendaEspacios(fecha, documentoEmpresa) {
  const { data } = await api.get('/agenda/espacios', {
    params: { fecha, documentoEmpresa },
  });
  return data;
}

export async function fetchAgendaProfesionales() {
  const { data } = await api.get('/agenda/profesionales');
  return data;
}

export async function fetchAgendaTiposCompromiso() {
  const { data } = await api.get('/agenda/tipos-compromiso');
  return data;
}

export async function fetchAgendaEstadosCita() {
  const { data } = await api.get('/agenda/estados-cita');
  return data;
}

/** @param {string} [q] */
export async function fetchAgendaProcedimientos(q) {
  const { data } = await api.get('/agenda/procedimientos', {
    params: q ? { q } : {},
  });
  return data;
}

/** @param {string} [q] */
export async function fetchAgendaPacientes(q) {
  const { data } = await api.get('/agenda/pacientes', {
    params: q ? { q } : {},
  });
  return data;
}

/** @param {object} body */
export async function createAgendaCita(body) {
  const { data } = await api.post('/agenda/citas', body);
  return data;
}

/** @param {number} id @param {object} body */
export async function updateAgendaCita(id, body) {
  const { data } = await api.patch(`/agenda/citas/${encodeURIComponent(id)}`, body);
  return data;
}

/** @param {number} id @param {number} idEstado */
export async function updateAgendaCitaEstado(id, idEstado) {
  const { data } = await api.patch(
    `/agenda/citas/${encodeURIComponent(id)}/estado`,
    { idEstado },
  );
  return data;
}
