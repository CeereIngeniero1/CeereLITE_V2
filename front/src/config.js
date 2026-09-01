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
