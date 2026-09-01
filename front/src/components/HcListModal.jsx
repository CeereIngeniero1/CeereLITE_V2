import { useEffect } from 'react';

export function HcListModal({
  title,
  emptyMessage,
  documentoPaciente,
  nombrePaciente,
  items = [],
  onClose,
}) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-dialog hc-list-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="hc-list-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <div>
            <h2 id="hc-list-title">{title}</h2>
            <p className="muted" style={{ margin: '0.25rem 0 0' }}>
              {nombrePaciente}
              {documentoPaciente ? (
                <span className="td-mono"> · {documentoPaciente}</span>
              ) : null}
            </p>
          </div>
          <button type="button" className="btn-outline" onClick={onClose}>
            Cerrar
          </button>
        </header>
        <div className="modal-body">
          {items.length === 0 ? (
            <p className="muted hc-list-empty">{emptyMessage}</p>
          ) : (
            <ul className="hc-list">
              {items.map((item) => (
                <li key={item.id} className="hc-list-item">
                  <span className="td-strong">{item.title}</span>
                  {item.subtitle ? (
                    <span className="muted">{item.subtitle}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
