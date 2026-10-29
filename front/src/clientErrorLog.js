import { reportClientError } from './api/client';

function onLoginPage() {
  if (typeof window === 'undefined') return true;
  return (window.location.pathname || '').startsWith('/login');
}

function report(message, stack) {
  if (onLoginPage()) return;
  const msg = String(message ?? '').trim().slice(0, 8000);
  if (!msg) return;
  void reportClientError({
    message: msg,
    stack: stack ? String(stack).slice(0, 4000) : undefined,
    href: String(window.location.pathname || '').slice(0, 500),
  });
}

export function installClientErrorLog() {
  if (typeof window === 'undefined') return;
  window.addEventListener('error', (ev) => {
    const err = ev.error;
    report(ev.message || err?.message || 'Error', err?.stack);
  });
  window.addEventListener('unhandledrejection', (ev) => {
    const reason = ev.reason;
    if (reason?.isAxiosError || reason?.response) return;
    report(
      reason?.message || reason || 'unhandledrejection',
      reason?.stack,
    );
  });
}
