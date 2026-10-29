import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { fetchAgendaPacientes } from '../api/client';

export function PersonaBuscarModal({
  title = 'Buscar',
  hint = 'Escriba nombre o documento y elija una fila.',
  onPick,
  onClose,
}) {
  const [busqueda, setBusqueda] = useState('');
  const [filas, setFilas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    const t = setTimeout(() => {
      (async () => {
        setLoading(true);
        try {
          const rows = await fetchAgendaPacientes(busqueda.trim());
          if (!cancel) setFilas(Array.isArray(rows) ? rows : []);
        } catch {
          if (!cancel) setFilas([]);
        } finally {
          if (!cancel) setLoading(false);
        }
      })();
    }, 250);
    return () => {
      cancel = true;
      clearTimeout(t);
    };
  }, [busqueda]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function elegir(p) {
    const doc = String(p.id ?? '').trim();
    if (!doc) return;
    onPick({
      documento: doc,
      nombre: String(p.name ?? '').trim() || doc,
    });
  }

  return createPortal(
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="modal-dialog empresa-select-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="persona-buscar-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="persona-buscar-title">{title}</h2>
          <button type="button" className="btn-outline" onClick={onClose}>
            Cerrar
          </button>
        </div>
        <div className="modal-body">
          <p className="muted">{hint}</p>
          <label className="hc-field">
            <span className="hc-field-label">Buscar</span>
            <input
              className="hc-input"
              type="search"
              placeholder="Nombre o documento"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              autoFocus
            />
          </label>
          <div className="agenda-paciente-list" role="listbox" aria-label="Resultados">
            {loading ? (
              <p className="muted">Cargando…</p>
            ) : (
              <>
                {filas.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="agenda-paciente-item"
                    onClick={() => elegir(p)}
                  >
                    <span>{p.name || p.id}</span>
                    <span className="muted td-mono">{p.id2 || p.id}</span>
                  </button>
                ))}
                {!filas.length && (
                  <p className="muted">No hay resultados para esa búsqueda.</p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
