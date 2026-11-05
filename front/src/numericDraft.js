export function parseNumericDraft(raw, { allowDecimal = false } = {}) {
  const src = String(raw ?? '');
  if (!allowDecimal) {
    const digits = src.replace(/[^\d]/g, '');
    if (!digits) return { text: '', number: 0 };
    const text = digits.replace(/^0+(?=\d)/, '');
    return { text, number: Number(text) || 0 };
  }
  let s = src.replace(/[^\d.]/g, '');
  const dot = s.indexOf('.');
  if (dot >= 0) {
    s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, '');
  }
  if (!s) return { text: '', number: 0 };
  if (s === '.') return { text: '0.', number: 0 };
  const parts = s.split('.');
  let intPart = parts[0].replace(/^0+(?=\d)/, '');
  if (intPart === '') intPart = '0';
  const text = parts.length > 1 ? `${intPart}.${parts[1]}` : intPart;
  return { text, number: Number(text) || 0 };
}

export function parseMoneyDraft(raw) {
  return parseNumericDraft(raw, { allowDecimal: false });
}
