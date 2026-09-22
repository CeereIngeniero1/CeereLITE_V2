import { printHtmlDocument } from '../hcFormat/printDocument';
import { printFooterCss, printFooterHtml } from '../hcFormat/printChrome';

const ESTADOS_CANCELADOS = new Set([60, 61, 62, 63, 64, 71]);
const ID_ESTADO_ASISTIO = 59;

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

export function ymdLocal(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function fechaYmd(cita) {
  return String(cita?.fecha ?? '').slice(0, 10);
}

function formatFechaCorta(iso) {
  const s = String(iso ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return iso || '—';
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
}

function hmToMinutes(hm) {
  const m = String(hm ?? '')
    .trim()
    .match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function formatHora12(hm) {
  const min = hmToMinutes(hm);
  if (min == null) return hm || '—';
  const h24 = Math.floor(min / 60);
  const mm = String(min % 60).padStart(2, '0');
  const suf = h24 >= 12 ? 'p. m.' : 'a. m.';
  const h12 = h24 % 12 || 12;
  return `${h12}:${mm} ${suf}`;
}

function rowClass(idEstado) {
  const id = Number(idEstado);
  if (ESTADOS_CANCELADOS.has(id)) return 'cancelada';
  if (id === ID_ESTADO_ASISTIO) return 'asistio';
  return '';
}

export function rangoDefaultHistorial(citas) {
  const hasta = ymdLocal(new Date());
  const fechas = (citas ?? [])
    .map(fechaYmd)
    .filter((f) => /^\d{4}-\d{2}-\d{2}$/.test(f))
    .sort();
  if (fechas.length) {
    return { desde: fechas[0], hasta };
  }
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return { desde: ymdLocal(d), hasta };
}

export function citasEnRango(citas, desde, hasta) {
  return (citas ?? []).filter((c) => {
    const f = fechaYmd(c);
    return f && f >= desde && f <= hasta;
  });
}

export function printHistorialCitas({
  empresa,
  nombrePaciente,
  documentoPaciente,
  desde,
  hasta,
  citas,
}) {
  const rows = citasEnRango(citas, desde, hasta);
  if (!rows.length) return Promise.resolve(false);

  const filas = rows
    .map((cita) => {
      const cls = rowClass(cita.idEstado);
      return `<tr${cls ? ` class="${cls}"` : ''}>
        <td>${escapeHtml(formatFechaCorta(cita.fecha))}</td>
        <td>${escapeHtml(formatHora12(cita.hora))}</td>
        <td>${escapeHtml(formatHora12(cita.horaFin))}</td>
        <td>${escapeHtml(cita.tipoCompromiso || '—')}</td>
        <td>${escapeHtml(cita.nombreProfesional || '—')}</td>
        <td>${escapeHtml(cita.estado || '—')}</td>
      </tr>`;
    })
    .join('\n');

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Impreso por CeereSio</title>
  <style>
    html, body { background: #fff; color: #111; }
    body { font-family: Segoe UI, Arial, sans-serif; margin: 24px; }
    h1 { font-size: 1.25rem; margin: 0 0 0.35rem; }
    .meta { color: #222; font-size: 0.92rem; margin-bottom: 1rem; }
    table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    th, td { border: 1px solid #444; padding: 0.35rem 0.45rem; text-align: left; }
    th { background: #eee; }
    tr.asistio td { background: #b7dcc8; }
    tr.cancelada td { background: #e8b4ad; }
    ${printFooterCss()}
    @media print {
      html, body { background: #fff; color: #111; }
      body { margin: 12mm; }
    }
  </style>
</head>
<body>
  <h1>Historial de citas</h1>
  <p class="meta">
    Empresa: <strong>${escapeHtml(empresa || '—')}</strong><br>
    Paciente: <strong>${escapeHtml(nombrePaciente || documentoPaciente || '')}</strong><br>
    Documento: ${escapeHtml(documentoPaciente || '—')}<br>
    Rango: ${escapeHtml(formatFechaCorta(desde))} — ${escapeHtml(formatFechaCorta(hasta))}
  </p>
  <table>
    <thead>
      <tr>
        <th>Fecha</th>
        <th>Hora inicio</th>
        <th>Hora fin</th>
        <th>Tipo</th>
        <th>Responsable</th>
        <th>Estado</th>
      </tr>
    </thead>
    <tbody>
      ${filas}
    </tbody>
  </table>
  ${printFooterHtml()}
</body>
</html>`;

  return printHtmlDocument(html);
}
