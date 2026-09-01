/** Serialización legado CeereSio: |||[logo]|Campo|valor|flag| */

export function parseFormatoFileName(diagGeneral) {
  const s = String(diagGeneral ?? '')
    .trim()
    .replace(/^["']+|["']+$/g, '')
    .replace(/%20/g, ' ');
  if (!s) return null;
  const firstLine = s.split(/\r?\n/)[0].trim();
  const fromPath = firstLine.match(
    /Formatos[\s\\/]+HC[\\/]+(.+\.(?:html|htm))/i,
  );
  const rawName = fromPath?.[1] ?? firstLine.match(
    /([^\\/:*?"<>|]+\.(?:html|htm))\s*$/i,
  )?.[1];
  if (!rawName) return null;
  const name = rawName.replace(/^.*[\\/]/, '').trim();
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
}

export function looksLikeHcPayload(value) {
  const s = String(value ?? '').trim();
  return s.startsWith('|||') || /\|T\d+\|/i.test(s);
}

export function formatoRelativePath(fileName) {
  return `\\Formatos HC\\${fileName}`;
}

function isLocalAssetToken(token) {
  const v = String(token ?? '').trim();
  if (!v) return false;
  if (/^(file:|https?:|\/\/)/i.test(v)) return true;
  if (/\.(jpg|jpeg|png|gif|bmp|svg|css)$/i.test(v)) return true;
  return false;
}

export function parseHcPayload(serialized) {
  const raw = String(serialized ?? '');
  let rest = raw.startsWith('|||') ? raw.slice(3) : raw.replace(/^\|/, '');
  const parts = rest.split('|');
  let i = 0;
  let logo = '';
  if (parts[0] && isLocalAssetToken(parts[0]) && !/^(T|TT|C|R|S)\d+/i.test(parts[0])) {
    logo = parts[0];
    i = 1;
  }
  const fields = [];
  while (i < parts.length) {
    if (parts[i] === '') {
      i += 1;
      continue;
    }
    const name = parts[i] ?? '';
    const value = parts[i + 1] ?? '';
    const flag = parts[i + 2] ?? '';
    i += 3;
    if (parts[i] === '') i += 1;
    if (/^Entidad\d+$/i.test(name)) {
      let src = value;
      if (!src && isLocalAssetToken(flag)) src = flag;
      if (!src && isLocalAssetToken(parts[i])) {
        src = parts[i] ?? '';
        i += 1;
        if (parts[i] === '') i += 1;
      }
      fields.push({ name, value: src, flag: '', kind: 'img' });
      continue;
    }
    if (name) fields.push({ name, value, flag, kind: 'field' });
  }
  return { logo, fields };
}

function elementsByName(doc, name) {
  if (!doc || !name) return [];
  try {
    return [...doc.querySelectorAll(`[name="${CSS.escape(name)}"]`)];
  } catch {
    return [...doc.getElementsByName(name)];
  }
}

function serializableNodes(doc) {
  return [...doc.querySelectorAll('input, textarea, select, img[name]')].filter(
    (el) => {
      if (el.tagName === 'IMG') return !!el.getAttribute('name');
      const type = String(el.type || '').toLowerCase();
      return !['button', 'submit', 'reset', 'image', 'file'].includes(type);
    },
  );
}

function formControls(doc) {
  return serializableNodes(doc).filter((el) => el.tagName !== 'IMG');
}

export function fileUrlToHttp(fileUrl, origin = '') {
  const raw = String(fileUrl ?? '').trim();
  if (!raw) return '';
  if (/^https?:/i.test(raw) || raw.startsWith('/')) return raw;
  if (!/^file:/i.test(raw)) return raw;
  const base = String(origin || '').replace(/\/$/, '');
  let pathname = raw.replace(/^file:\/\//i, '');
  try {
    pathname = decodeURIComponent(new URL(raw).pathname);
  } catch {
    /* keep pathname */
  }
  pathname = pathname.replace(/^\/+/, '');
  const fileName = pathname.split(/[\\/]/).pop() ?? '';
  if (!fileName) return raw;
  const encoded = encodeURIComponent(fileName);
  if (/Firma[\s%20]*Entidad/i.test(pathname) || /Firma[\s%20]*Entidad/i.test(raw)) {
    return `${base}/firma-entidad/${encoded}`;
  }
  if (/Foto[\s%20]*Entidad/i.test(pathname) || /Foto[\s%20]*Entidad/i.test(raw)) {
    return `${base}/static-images/${encoded}`;
  }
  return `${base}/formatos-hc/${encoded}`;
}

export function joinFileDir(dirUrl, fileName) {
  if (!dirUrl || !fileName) return '';
  const dir = String(dirUrl).endsWith('/') ? dirUrl : `${dirUrl}/`;
  return `${dir}${fileName}`;
}

export function serializeHcFormat(doc, options = {}) {
  const logoFileUrl = options.logoFileUrl || '';
  const entidadFileUrls = options.entidadFileUrls || {};
  const nodes = serializableNodes(doc);
  let out = `|||${logoFileUrl}`;
  for (const el of nodes) {
    if (el.tagName === 'IMG') {
      const name = el.getAttribute('name') || '';
      const fileUrl = entidadFileUrls[name] || '';
      out += `|${name}|||${fileUrl}|`;
      continue;
    }
    const name = el.name || '';
    const type = String(el.type || 'text').toLowerCase();
    if (type === 'checkbox') {
      out += `|${name}|ON|${el.checked ? 'True' : 'False'}|`;
    } else if (type === 'radio') {
      out += `|${name}|${el.value ?? ''}|${el.checked ? 'True' : 'False'}|`;
    } else if (el.tagName === 'TEXTAREA' || /^S\d+/i.test(name)) {
      out += `|${name}|${el.value ?? ''}||`;
    } else {
      out += `|${name}|${el.value ?? ''}|False|`;
    }
  }
  return out;
}

export function applyHcPayload(doc, serialized, options = {}) {
  const { fields } = parseHcPayload(serialized);
  const origin = options.origin || '';
  const used = new WeakSet();
  for (const { name, value, flag, kind } of fields) {
    const candidates = elementsByName(doc, name);
    const el = candidates.find((node) => {
      if (used.has(node)) return false;
      if (kind === 'img') return node.tagName === 'IMG';
      const type = String(node.type || '').toLowerCase();
      if (type === 'radio') return String(node.value) === String(value);
      return node.tagName !== 'IMG';
    });
    if (!el) continue;
    used.add(el);
    if (el.tagName === 'IMG') {
      const httpSrc = fileUrlToHttp(value, origin);
      if (httpSrc) el.setAttribute('src', httpSrc);
      continue;
    }
    const type = String(el.type || '').toLowerCase();
    if (type === 'checkbox' || type === 'radio') {
      el.checked = flag === 'True';
    } else {
      el.value = value;
    }
  }
}

export function applyEntidadImages(doc, httpUrls) {
  if (!httpUrls) return;
  for (const [name, url] of Object.entries(httpUrls)) {
    if (!url) continue;
    for (const el of elementsByName(doc, name)) {
      if (el.tagName === 'IMG') el.setAttribute('src', url);
    }
  }
}

export function applyHcAutofill(doc, values) {
  if (!values) return;
  for (const [name, raw] of Object.entries(values)) {
    if (raw == null || raw === '') continue;
      const els = elementsByName(doc, name);
    for (const el of els) {
      const type = String(el.type || '').toLowerCase();
      if (type === 'checkbox' || type === 'radio' || type === 'hidden') continue;
      if (el.value) continue;
      el.value = String(raw);
    }
  }
}

export function setHcFormatDisabled(doc, disabled) {
  for (const el of formControls(doc)) {
    el.disabled = !!disabled;
  }
}

/** Copia value/checked del DOM a atributos para que innerHTML conserve el relleno. */
export function persistHcFormValues(doc) {
  if (!doc) return;
  for (const el of doc.querySelectorAll('input, textarea, select')) {
    const type = String(el.type || '').toLowerCase();
    if (el.tagName === 'TEXTAREA') {
      el.textContent = el.value ?? '';
      continue;
    }
    if (el.tagName === 'SELECT') {
      for (const opt of el.options) {
        if (opt.selected) opt.setAttribute('selected', 'selected');
        else opt.removeAttribute('selected');
      }
      continue;
    }
    if (type === 'checkbox' || type === 'radio') {
      if (el.checked) el.setAttribute('checked', 'checked');
      else el.removeAttribute('checked');
      continue;
    }
    el.setAttribute('value', el.value ?? '');
  }
}

/** Deja el formato listo para extraer HTML impreso (valores + espejos de textarea). */
export function freezeHcFormatForPrint(doc) {
  persistHcFormValues(doc);
  if (!doc) return;
  for (const ta of doc.querySelectorAll('textarea')) {
    let mirror = ta.nextElementSibling;
    if (!mirror || !mirror.classList?.contains('print-mirror')) {
      mirror = doc.createElement('div');
      mirror.className = 'print-mirror';
      ta.insertAdjacentElement('afterend', mirror);
    }
    mirror.textContent = ta.value ?? '';
  }
}

export function fechaHistoriaLarga(date = new Date()) {
  return date.toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function horaHistoria(date = new Date()) {
  const h = date.getHours();
  const m = String(date.getMinutes()).padStart(2, '0');
  const h12 = h % 12 || 12;
  const suf = h < 12 ? 'a.m.' : 'p.m.';
  return `${String(h12).padStart(2, '0')}:${m} ${suf}`;
}

export function fechaHistoriaNumerica(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

export function formatFechaNacimiento(value) {
  if (!value) return '';
  const s = String(value);
  const day = s.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    const [y, m, d] = day.split('-');
    return `${d}/${m}/${y}`;
  }
  const dt = new Date(s);
  if (Number.isNaN(dt.getTime())) return s;
  return dt.toLocaleDateString('es-CO');
}
