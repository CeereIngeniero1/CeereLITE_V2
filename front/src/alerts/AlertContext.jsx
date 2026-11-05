import { useMemo } from 'react';
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';

function fire(icon, title, message) {
  const text = String(message ?? '').trim();
  if (!text) return Promise.resolve();
  return Swal.fire({
    icon,
    title,
    text,
    confirmButtonText: 'OK',
    heightAuto: false,
  });
}

export function notifyOk(message) {
  return fire('success', 'Guardado', message);
}

export function notifyError(message) {
  return fire('error', 'Error', message);
}

export function useAlerts() {
  return useMemo(() => ({ notifyOk, notifyError }), []);
}
