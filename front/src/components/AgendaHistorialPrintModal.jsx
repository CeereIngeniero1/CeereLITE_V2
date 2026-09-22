import { useEffect, useState } from 'react';
import { useCompany } from '../auth/CompanyContext';
import {
  citasEnRango,
  printHistorialCitas,
  rangoDefaultHistorial,
} from '../agenda/printHistorialCitas';

export function AgendaHistorialPrintModal({
  citas,
  documentoPaciente,
  nombrePaciente,
  onClose,
}) {
  const { nombreComercialEmpresa } = useCompany();
  const defaults = rangoDefaultHistorial(citas);
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
    const rows = citasEnRango(citas, desde, hasta);
    if (!rows.length) {
      setError('No hay citas en ese rango de fechas.');
      return;
    }
    setPrinting(true);
    setError('');
    try {
      const ok = await printHistorialCitas({
        empresa: nombreComercialEmpresa,
        nombrePaciente,
        documentoPaciente,
        desde,
        hasta,
        citas: rows,
      });
      if (!ok) {
        setError('No se pudo preparar la impresión del historial.');
        return;
      }
      onClose();
    } catch {
      setError('No se pudo preparar la impresión del historial.');
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
        aria-labelledby="agenda-hist-print-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <div>
            <h2 id="agenda-hist-print-title">Imprimir historial de citas</h2>
            <p className="muted" style={{ margin: '0.25rem 0 0' }}>
              Elija el rango de fechas del reporte
            </p>
          </div>
          <button type="button" className="btn-outline" onClick={onClose}>
            Cerrar
          </button>
        </header>
        <div className="modal-body">
          {error ? <div className="alert alert-error">{error}</div> : null}
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
