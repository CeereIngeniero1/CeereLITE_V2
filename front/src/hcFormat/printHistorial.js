import { fetchFormatoHcContenido } from '../api/client';
import { API_ORIGIN } from '../config';
import {
  applyEntidadImages,
  applyHcPayload,
  freezeHcFormatForPrint,
  looksLikeHcPayload,
  parseFormatoFileName,
  parseHcPayload,
  fileUrlToHttp,
} from './hcFormat';
import { printHtmlDocument } from './printDocument';
import { printFooterCss, printFooterHtml } from './printChrome';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatFecha(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

function isFormatoItem(item) {
  return (
    Number(item?.idTipoEvaluacion) === 4 ||
    !!parseFormatoFileName(item?.diagnosticoGeneral) ||
    looksLikeHcPayload(item?.diagnosticoEspecifico)
  );
}

function namedControlCount(doc) {
  if (!doc) return 0;
  return doc.querySelectorAll('input[name], textarea[name], select[name]')
    .length;
}

function entidadHttpFromPayload(serialized) {
  const { fields } = parseHcPayload(serialized);
  const urls = {};
  for (const field of fields) {
    if (field.kind === 'img' && field.value) {
      urls[field.name] = fileUrlToHttp(field.value, API_ORIGIN);
    }
  }
  return urls;
}

function waitForControls(doc) {
  return new Promise((resolve) => {
    let tries = 0;
    const tick = () => {
      if (namedControlCount(doc) > 0 || tries >= 40) {
        resolve(namedControlCount(doc) > 0);
        return;
      }
      tries += 1;
      window.setTimeout(tick, 50);
    };
    tick();
  });
}

function fillFormatoIframe(templateHtml, payload) {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('title', 'Relleno de formato');
    iframe.setAttribute('aria-hidden', 'true');
    Object.assign(iframe.style, {
      position: 'fixed',
      left: '-9999px',
      width: '830px',
      height: '1100px',
      border: '0',
      opacity: '0',
      pointerEvents: 'none',
    });
    let settled = false;
    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      iframe.remove();
      reject(new Error('timeout'));
    }, 20000);

    async function tryFill() {
      if (settled) return;
      const doc = iframe.contentDocument;
      if (!doc?.documentElement) return;
      if (namedControlCount(doc) === 0) {
        await waitForControls(doc);
      }
      if (namedControlCount(doc) === 0 && !doc.body?.innerHTML?.trim()) {
        return;
      }
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      try {
        const serialized = String(payload ?? '');
        if (serialized.trim()) {
          applyHcPayload(doc, serialized, { origin: API_ORIGIN });
          applyEntidadImages(doc, entidadHttpFromPayload(serialized));
        }
        await new Promise((r) => window.setTimeout(r, 80));
        resolve(iframe);
      } catch (err) {
        iframe.remove();
        reject(err);
      }
    }

    iframe.addEventListener('load', () => {
      void tryFill();
    });
    iframe.srcdoc = templateHtml;
    document.body.appendChild(iframe);
    window.setTimeout(() => {
      void tryFill();
    }, 200);
  });
}

function contentHeight(doc) {
  return Math.max(
    doc?.documentElement?.scrollHeight ?? 0,
    doc?.body?.scrollHeight ?? 0,
    720,
  );
}

function unlockAndExpand(iframe) {
  const doc = iframe.contentDocument;
  if (!doc) return;
  const style = doc.createElement('style');
  style.setAttribute('data-hc-unlock', '1');
  style.textContent =
    'html, body { height: auto !important; min-height: 0 !important; overflow: visible !important; }';
  (doc.head || doc.documentElement).appendChild(style);
  freezeHcFormatForPrint(doc);
  for (const script of [...doc.querySelectorAll('script')]) {
    script.remove();
  }
  for (let i = 0; i < 4; i += 1) {
    const h = contentHeight(doc);
    iframe.style.height = `${h + 24}px`;
  }
}

function scopeSelector(selector, scope) {
  return String(selector || '')
    .split(',')
    .map((part) => {
      const t = part.trim();
      if (!t) return t;
      if (/^(html|body|:root)$/i.test(t)) return scope;
      const rewritten = t
        .replace(/:root\b/gi, scope)
        .replace(/(^|[\s>+~,(])html\b/gi, `$1${scope}`)
        .replace(/(^|[\s>+~,(])body\b/gi, `$1${scope}`);
      if (rewritten.includes(scope)) return rewritten;
      return `${scope} ${rewritten}`;
    })
    .join(', ');
}

function serializeScopedRule(rule, scope) {
  if (rule.type === CSSRule.STYLE_RULE) {
    return `${scopeSelector(rule.selectorText, scope)} { ${rule.style.cssText} }\n`;
  }
  if (rule.type === CSSRule.MEDIA_RULE) {
    let inner = '';
    for (const child of rule.cssRules) {
      inner += serializeScopedRule(child, scope);
    }
    return `@media ${rule.media.mediaText} {\n${inner}}\n`;
  }
  if (rule.type === CSSRule.SUPPORTS_RULE) {
    let inner = '';
    for (const child of rule.cssRules) {
      inner += serializeScopedRule(child, scope);
    }
    return `@supports ${rule.conditionText} {\n${inner}}\n`;
  }
  return `${rule.cssText}\n`;
}

function scopeCssRegex(cssText, scope) {
  return String(cssText || '').replace(
    /(^|\{|})\s*([^@{}][^{}]*?)\s*\{/g,
    (match, pre, sel) => {
      if (!sel.trim()) return match;
      return `${pre} ${scopeSelector(sel, scope)} {`;
    },
  );
}

function scopeCss(cssText, scope) {
  const raw = String(cssText || '').trim();
  if (!raw) return '';
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(raw);
    let out = '';
    for (const rule of sheet.cssRules) {
      out += serializeScopedRule(rule, scope);
    }
    return out;
  } catch {
    return scopeCssRegex(raw, scope);
  }
}

function absolutizeCssUrls(cssText, baseHref) {
  if (!baseHref) return cssText;
  return String(cssText || '').replace(
    /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi,
    (match, quote, url) => {
      const value = String(url || '').trim();
      if (
        !value ||
        value.startsWith('#') ||
        /^(https?:|data:|blob:|file:)/i.test(value)
      ) {
        return match;
      }
      try {
        return `url(${quote}${new URL(value, baseHref).href}${quote})`;
      } catch {
        return match;
      }
    },
  );
}

async function collectScopedCss(doc, scope) {
  const chunks = [];
  const fallbackLinks = [];
  for (const link of doc.querySelectorAll('link[rel="stylesheet"]')) {
    const href = link.href || link.getAttribute('href') || '';
    if (!href) continue;
    try {
      const res = await fetch(href);
      if (!res.ok) throw new Error('css');
      const text = absolutizeCssUrls(await res.text(), href);
      chunks.push(scopeCss(text, scope));
    } catch {
      fallbackLinks.push(href);
    }
  }
  for (const style of doc.querySelectorAll('style')) {
    if (style.getAttribute('data-hc-unlock')) continue;
    chunks.push(scopeCss(style.textContent || '', scope));
  }
  return { css: chunks.filter(Boolean).join('\n'), fallbackLinks };
}

async function formatoToInlineSection(item, hostId) {
  const fileName = parseFormatoFileName(item.diagnosticoGeneral);
  if (!fileName) {
    return sectionFormatoError(item, 'No se encontró el archivo del formato.');
  }
  try {
    const data = await fetchFormatoHcContenido(fileName);
    const template = String(data?.html ?? '').trim();
    if (!template) {
      return sectionFormatoError(
        item,
        `No se encontró el formato «${fileName}».`,
      );
    }
    const iframe = await fillFormatoIframe(template, item.diagnosticoEspecifico);
    try {
      const doc = iframe.contentDocument;
      if (!doc?.body) {
        return sectionFormatoError(
          item,
          `No se pudo cargar el formato «${fileName}».`,
        );
      }
      unlockAndExpand(iframe);
      await new Promise((r) => window.setTimeout(r, 80));
      const scope = `#${hostId}`;
      const { css, fallbackLinks } = await collectScopedCss(doc, scope);
      const bodyHtml = doc.body.innerHTML;
      const bodyStyle = doc.body.getAttribute('style') || '';
      const linkTags = fallbackLinks
        .map((href) => `<link rel="stylesheet" href="${escapeHtml(href)}">`)
        .join('\n');
      return `
    <article class="hc-hist-item">
      <h2>Formato</h2>
      <p class="item-meta">
        Fecha: ${escapeHtml(formatFecha(item.fecha))}<br>
        Profesional: ${escapeHtml(item.nombreProfesional || '—')}
      </p>
      <section id="${escapeHtml(hostId)}" class="hc-formato-host"${
        bodyStyle ? ` style="${escapeHtml(bodyStyle)}"` : ''
      }>
        ${linkTags}
        <style>
          ${scope} {
            display: block;
            width: 100%;
            max-width: 830px;
            height: auto !important;
            overflow: visible !important;
            background: #fff;
            color: #111;
            position: relative;
          }
          ${css}
        </style>
        ${bodyHtml}
      </section>
    </article>`;
    } finally {
      iframe.remove();
    }
  } catch {
    return sectionFormatoError(
      item,
      `No se pudo cargar el formato «${fileName}».`,
    );
  }
}

function sectionTexto(item) {
  const general = escapeHtml(item.diagnosticoGeneral).replace(/\n/g, '<br>');
  const especifico = escapeHtml(item.diagnosticoEspecifico).replace(
    /\n/g,
    '<br>',
  );
  return `
    <article class="hc-hist-item">
    <h2>Evolución</h2>
    <p class="item-meta">
      Fecha: ${escapeHtml(formatFecha(item.fecha))}<br>
      Profesional: ${escapeHtml(item.nombreProfesional || '—')}
    </p>
    <h3>Diagnóstico / evolución</h3>
    <div class="block">${general || '—'}</div>
    <h3>Diagnóstico específico / plan</h3>
    <div class="block">${especifico || '—'}</div>
    </article>
  `;
}

function sectionFormatoError(item, message) {
  return `
    <article class="hc-hist-item">
    <h2>Formato</h2>
    <p class="item-meta">
      Fecha: ${escapeHtml(formatFecha(item.fecha))}<br>
      Profesional: ${escapeHtml(item.nombreProfesional || '—')}
    </p>
    <p>${escapeHtml(message)}</p>
    </article>
  `;
}

export async function printHistorialHc({
  tituloPaciente,
  documentoPaciente,
  desde,
  hasta,
  items,
}) {
  const list = items ?? [];
  if (!list.length) return false;

  const parts = [];
  let formatoIndex = 0;
  for (const item of list) {
    if (isFormatoItem(item)) {
      formatoIndex += 1;
      parts.push(await formatoToInlineSection(item, `hc-formato-host-${formatoIndex}`));
    } else {
      parts.push(sectionTexto(item));
    }
  }

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Historial historia clínica — Impreso por CeereSio</title>
  <style>
    html, body { background: #fff; color: #111; }
    body { font-family: Segoe UI, Arial, sans-html; margin: 24px; }
    h1 { font-size: 1.25rem; margin: 0 0 0.35rem; }
    h2 { font-size: 1.05rem; margin: 0 0 0.35rem; }
    h3 { font-size: 0.95rem; margin: 1rem 0 0.35rem; }
    .meta, .item-meta { color: #222; font-size: 0.92rem; margin-bottom: 1rem; }
    .block {
      white-space: pre-wrap;
      border: 1px solid #444;
      padding: 0.75rem;
      min-height: 3rem;
    }
    .hc-formato-host {
      display: block;
      width: 100%;
      max-width: 830px;
      height: auto !important;
      overflow: visible !important;
      background: #fff;
    }
    .hc-hist-item { page-break-after: always; }
    .hc-hist-item:last-child { page-break-after: auto; }
    ${printFooterCss()}
    @media print {
      html, body { background: #fff; color: #111; }
      body { margin: 12mm; }
      .hc-formato-host { overflow: visible !important; height: auto !important; }
    }
  </style>
</head>
<body>
  <h1>Historial de historia clínica</h1>
  <p class="meta">
    Paciente: <strong>${escapeHtml(tituloPaciente || documentoPaciente || '')}</strong><br>
    Documento: ${escapeHtml(documentoPaciente || '—')}<br>
    Rango: ${escapeHtml(desde)} — ${escapeHtml(hasta)}
  </p>
  ${parts.join('\n')}
  ${printFooterHtml()}
</body>
</html>`;

  return printHtmlDocument(html);
}
