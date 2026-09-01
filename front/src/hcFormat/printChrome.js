export const CEERE_PRINT_FOOTER_TEXT = 'Impreso por CeereSio';

export function printFooterCss() {
  return `
@page { margin: 12mm 12mm 18mm; }
.ceere-print-footer { display: none; }
@media print {
  .ceere-print-footer {
    display: block;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    text-align: center;
    font-size: 10px;
    color: #333;
    font-family: Segoe UI, Arial, sans-serif;
  }
}
`;
}

export function printFooterHtml() {
  return `<div class="ceere-print-footer">${CEERE_PRINT_FOOTER_TEXT}</div>`;
}

/** Inyecta pie de impresión; devuelve función para quitarlo (formatos abiertos). */
export function injectPrintFooter(doc) {
  if (!doc?.body) return () => {};
  const style = doc.createElement('style');
  style.setAttribute('data-ceere-print-footer', '1');
  style.textContent = printFooterCss();
  (doc.head || doc.documentElement).appendChild(style);
  const el = doc.createElement('div');
  el.className = 'ceere-print-footer';
  el.setAttribute('data-ceere-print-footer', '1');
  el.textContent = CEERE_PRINT_FOOTER_TEXT;
  doc.body.appendChild(el);
  return () => {
    style.remove();
    el.remove();
  };
}
