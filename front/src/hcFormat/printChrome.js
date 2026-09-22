import { freezeHcFormatForPrint } from './hcFormat';

export const CEERE_PRINT_FOOTER_TEXT = 'Impreso por CeereSio';

export function printFooterCss() {
  return `
@page { margin: 0; }
.ceere-print-footer { display: none; }
@media print {
  html, body {
    margin: 0 !important;
    padding: 0 !important;
  }
  body {
    margin: 12mm 12mm 18mm !important;
  }
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

/** CSS para que los campos con scroll impriman todo el texto (espejo de textarea). */
export function printExpandCss() {
  return `
.print-mirror {
  display: none;
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow: visible !important;
  height: auto !important;
  max-height: none !important;
  box-sizing: border-box;
}
@media print {
  html, body {
    height: auto !important;
    overflow: visible !important;
    max-height: none !important;
  }
  textarea {
    display: none !important;
  }
  .print-mirror {
    display: block !important;
  }
  [data-print-expand] {
    overflow: visible !important;
    height: auto !important;
    max-height: none !important;
  }
}
`;
}

/** Congela valores, espejos y CSS de expansión; devuelve cleanup para el editor en vivo. */
export function prepareHcDocumentForPrint(doc) {
  if (!doc?.body) return () => {};
  freezeHcFormatForPrint(doc);
  const style = doc.createElement('style');
  style.setAttribute('data-hc-print-expand', '1');
  style.textContent = printExpandCss();
  (doc.head || doc.documentElement).appendChild(style);
  return () => {
    style.remove();
    for (const mirror of [...doc.querySelectorAll('.print-mirror')]) {
      mirror.remove();
    }
    for (const el of [...doc.querySelectorAll('[data-print-expand]')]) {
      el.removeAttribute('data-print-expand');
    }
  };
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
