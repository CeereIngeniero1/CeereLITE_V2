import { useEffect, useState } from 'react';
import {
  fetchHistorialHc,
  messageFromAxiosError,
} from '../api/client';
import { printHistorialHc } from '../hcFormat/printHistorial';

function ymdLocal(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function defaultRango() {
  const hasta = new Date();
  const desde = new Date();
  desde.setDate(desde.getDate() - 30);
  return { desde: ymdLocal(desde), hasta: ymdLocal(hasta) };
}

export function HcHistorialPrintModal({
  documentoPaciente,
  nombrePaciente,
  onClose,
}) {
  const defaults = defaultRango();
  const [desde, setDesde] = useState(defaults.desde);
  const [hasta, setHasta] = useState(defaults.hasta);
  const [error, setError] = useState('');
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function imprimir() {
    if (!desde || !hasta) {
      setError('Indique el rango de fechas.');
      return;
    }
    if (desde > hasta) {
      setError('La fecha inicial no puede ser posterior a la final.');
      return;
    }
    setPrinting(true);
    setError('');
    try {
      const rows = await fetchHistorialHc(documentoPaciente, desde, hasta);
      const items = Array.isArray(rows) ? rows : [];
      if (!items.length) {
        setError(
          'No hay evoluciones ni formatos en ese rango de fechas.',
        );
        return;
      }
      const ok = await printHistorialHc({
        tituloPaciente: nombrePaciente,
        documentoPaciente,
        desde,
        hasta,
        items,
      });
      if (!ok) {
        setError('No se pudo preparar la impresión del historial.');
        return;
      }
      onClose();
    } catch (e) {
      setError(
        await messageFromAxiosError(e, 'No se pudo cargar el historial'),
      );
    } finally {
      setPrinting(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-dialog confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="hc-hist-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <div>
            <h2 id="hc-hist-title">Imprimir historial</h2>
            <p className="muted" style={{ margin: '0.25rem 0 0' }}>
              Solo evoluciones y formatos
            </p>
          </div>
          <button type="button" className="btn-outline" onClick={onClose}>
            Cerrar
          </button>
        </header>
        <div className="modal-body">
          {error && <div className="alert alert-error">{error}</div>}
          <div className="hc-hist-dates">
            <label>
              Desde
              <input
                type="date"
                value={desde}
                disabled={printing}
                onChange={(e) => setDesde(e.target.value)}
              />
            </label>
            <label>
              Hasta
              <input
                type="date"
                value={hasta}
                disabled={printing}
                onChange={(e) => setHasta(e.target.value)}
              />
            </label>
          </div>
          <div className="confirm-actions">
            <button
              type="button"
              className="btn-outline"
              disabled={printing}
              onClick={onClose}
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={printing || !documentoPaciente}
              onClick={() => void imprimir()}
            >
              {printing ? 'Preparando…' : 'Imprimir'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
