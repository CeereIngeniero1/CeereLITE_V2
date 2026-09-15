import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import {
  applyEntidadImages,
  applyHcAutofill,
  applyHcPayload,
  serializeHcFormat,
  setHcFormatDisabled,
} from '../hcFormat/hcFormat';
import { API_ORIGIN } from '../config';
import { injectPrintFooter } from '../hcFormat/printChrome';

function namedControlCount(doc) {
  if (!doc) return 0;
  return doc.querySelectorAll(
    'input[name], textarea[name], select[name]',
  ).length;
}

export const HcFormatEditor = forwardRef(function HcFormatEditor(
  {
    html,
    logoFileUrl,
    autofill,
    payload,
    disabled,
    entidadFileUrls,
    entidadHttpUrls,
    applyKey,
  },
  ref,
) {
  const iframeRef = useRef(null);
  const payloadRef = useRef(payload);
  const autofillRef = useRef(autofill);
  const disabledRef = useRef(disabled);
  const logoRef = useRef(logoFileUrl);
  const entidadFileRef = useRef(entidadFileUrls);
  const entidadHttpRef = useRef(entidadHttpUrls);
  const appliedRef = useRef(false);
  payloadRef.current = payload;
  autofillRef.current = autofill;
  disabledRef.current = disabled;
  logoRef.current = logoFileUrl;
  entidadFileRef.current = entidadFileUrls;
  entidadHttpRef.current = entidadHttpUrls;

  function fill() {
    const iframe = iframeRef.current;
    const doc = iframe?.contentDocument;
    if (!doc?.documentElement) return false;
    const count = namedControlCount(doc);
    if (count === 0) return false;
    doc.addEventListener('submit', (e) => e.preventDefault());
    if (!appliedRef.current) {
      const currentPayload = payloadRef.current;
      if (currentPayload) {
        applyHcPayload(doc, currentPayload, { origin: API_ORIGIN });
      }
      applyHcAutofill(doc, autofillRef.current);
      applyEntidadImages(doc, entidadHttpRef.current);
      appliedRef.current = true;
    }
    setHcFormatDisabled(doc, disabledRef.current);
    const height = Math.max(
      doc.documentElement?.scrollHeight ?? 0,
      doc.body?.scrollHeight ?? 0,
      720,
    );
    iframe.style.height = `${height + 24}px`;
    return true;
  }

  useImperativeHandle(ref, () => ({
    serialize() {
      const doc = iframeRef.current?.contentDocument;
      if (!doc) return null;
      return serializeHcFormat(doc, {
        logoFileUrl: logoRef.current || '',
        entidadFileUrls: entidadFileRef.current || {},
      });
    },
    print() {
      const iframe = iframeRef.current;
      const win = iframe?.contentWindow;
      const doc = iframe?.contentDocument;
      if (!win || !doc) return false;
      const cleanup = injectPrintFooter(doc);
      const done = () => {
        win.removeEventListener('afterprint', done);
        cleanup();
      };
      win.addEventListener('afterprint', done);
      window.setTimeout(done, 120000);
      win.focus();
      win.print();
      return true;
    },
  }));

  useEffect(() => {
    appliedRef.current = false;
  }, [applyKey, html]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return undefined;
    let tries = 0;
    let timer;
    const tick = () => {
      if (fill() || tries >= 25) return;
      tries += 1;
      timer = window.setTimeout(tick, 50);
    };
    const onLoad = () => {
      tick();
    };
    iframe.addEventListener('load', onLoad);
    tick();
    return () => {
      iframe.removeEventListener('load', onLoad);
      window.clearTimeout(timer);
    };
  }, [html, applyKey]);

  useEffect(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc?.body) return;
    setHcFormatDisabled(doc, disabled);
  }, [disabled]);

  return (
    <div className="hc-formato-wrap">
      <iframe
        ref={iframeRef}
        title="Formato de historia clínica"
        className="hc-formato-frame"
        srcDoc={html || ''}
        onLoad={() => fill()}
      />
    </div>
  );
});
