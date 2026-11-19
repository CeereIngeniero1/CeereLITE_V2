import { useEffect, useRef, useState } from 'react';

/**
 * Pad de firma del paciente (mouse / stylus / touch).
 * Emite dataURL PNG vía onSave.
 */
export function FirmaPacientePad({
  existingUrl,
  disabled,
  saving,
  draftHint,
  onSave,
  onClear,
}) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const last = useRef(null);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const resize = () => {
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const rect = canvas.getBoundingClientRect();
      const prev = canvas.toDataURL('image/png');
      canvas.width = Math.max(1, Math.floor(rect.width * ratio));
      canvas.height = Math.max(1, Math.floor(rect.height * ratio));
      const ctx = canvas.getContext('2d');
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, rect.width, rect.height);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 2;
      if (dirty) {
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height);
        img.src = prev;
      }
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [dirty]);

  function pos(e) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const src = e.touches?.[0] ?? e;
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
  }

  function start(e) {
    if (disabled) return;
    e.preventDefault();
    drawing.current = true;
    last.current = pos(e);
  }

  function move(e) {
    if (!drawing.current || disabled) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    setDirty(true);
  }

  function end(e) {
    if (!drawing.current) return;
    e?.preventDefault?.();
    drawing.current = false;
    last.current = null;
  }

  function clearPad() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, rect.width, rect.height);
    setDirty(false);
    setError('');
  }

  function exportFirmaDataUrl() {
    const canvas = canvasRef.current;
    if (!canvas) return '';
    // Exportar JPEG reducido (máx. ~600px) para caber en varbinary Ceere.
    const maxW = 600;
    const srcW = canvas.width;
    const srcH = canvas.height;
    const scale = srcW > maxW ? maxW / srcW : 1;
    const outW = Math.max(1, Math.round(srcW * scale));
    const outH = Math.max(1, Math.round(srcH * scale));
    const out = document.createElement('canvas');
    out.width = outW;
    out.height = outH;
    const ctx = out.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, outW, outH);
    ctx.drawImage(canvas, 0, 0, outW, outH);
    return out.toDataURL('image/jpeg', 0.82);
  }

  async function save() {
    setError('');
    if (!dirty) {
      setError('Realice la firma antes de guardar.');
      return;
    }
    const dataUrl = exportFirmaDataUrl();
    try {
      await onSave?.(dataUrl);
      setDirty(false);
    } catch (err) {
      setError(err?.message || 'No se pudo guardar la firma');
    }
  }

  return (
    <div className="firma-paciente-panel">
      <div className="firma-paciente-head">
        <h3 className="agenda-section-title" style={{ margin: 0 }}>
          Firma del paciente
        </h3>
        <p className="muted" style={{ margin: 0 }}>
          {draftHint
            ? 'Puede firmar ahora: al guardar la firma también se guarda la evolución con lo escrito hasta aquí.'
            : 'Use el mouse, el dedo o un stylus. Se guarda en la evolución (compatible Ceere).'}
        </p>
      </div>

      {existingUrl ? (
        <div className="firma-paciente-preview">
          <img src={existingUrl} alt="Firma del paciente" />
        </div>
      ) : disabled ? (
        <p className="muted">
          La firma solo está disponible mientras la HC esté abierta (o aún sin
          guardar).
        </p>
      ) : (
        <p className="muted">Aún no hay firma guardada en esta evolución.</p>
      )}

      {!disabled && (
        <>
          <div className="firma-paciente-canvas-wrap">
            <canvas
              ref={canvasRef}
              className="firma-paciente-canvas"
              onMouseDown={start}
              onMouseMove={move}
              onMouseUp={end}
              onMouseLeave={end}
              onTouchStart={start}
              onTouchMove={move}
              onTouchEnd={end}
            />
          </div>
          {error ? <div className="alert alert-error">{error}</div> : null}
          <div className="firma-paciente-actions">
            <button
              type="button"
              className="btn-outline"
              disabled={saving}
              onClick={clearPad}
            >
              Borrar pad
            </button>
            {existingUrl ? (
              <button
                type="button"
                className="btn-outline"
                disabled={saving}
                onClick={() => void onClear?.()}
              >
                Quitar firma guardada
              </button>
            ) : null}
            <button type="button" disabled={saving || !dirty} onClick={() => void save()}>
              {saving ? 'Guardando…' : existingUrl ? 'Reemplazar firma' : 'Guardar firma'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
