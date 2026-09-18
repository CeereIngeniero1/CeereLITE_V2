import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { fetchAgendaPacientes } from '../api/client';
import { setStoredHcDocumento } from '../config';

export function PacienteHcModal({ onClose }) {
  const navigate = useNavigate();
  const [busqueda, setBusqueda] = useState('');
  const [pacientes, setPacientes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    const t = setTimeout(() => {
      (async () => {
        setLoading(true);
        try {
          const rows = await fetchAgendaPacientes(busqueda.trim());
          if (!cancel) setPacientes(Array.isArray(rows) ? rows : []);
        } catch {
          if (!cancel) setPacientes([]);
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

  function elegir(p) {
    const doc = String(p.id ?? '').trim();
    if (!doc) return;
    setStoredHcDocumento(doc);
    onClose();
    navigate('/principal/evolucion', { state: { documentoPaciente: doc } });
  }

  return createPortal(
    <div
      className="modal-backdrop paciente-hc-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="modal-dialog empresa-select-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="hc-paciente-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="hc-paciente-title">Buscar paciente</h2>
          <button type="button" className="btn-outline" onClick={onClose}>
            Cerrar
          </button>
        </div>
        <div className="modal-body">
          <p className="muted">
            Escriba nombre o documento y elija una fila para abrir la historia
            clínica.
          </p>
          <label className="hc-field">
            <span className="hc-field-label">Buscar paciente</span>
            <input
              className="hc-input"
              type="search"
              placeholder="Nombre o documento"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              autoFocus
            />
          </label>
          <div className="agenda-paciente-list" role="listbox" aria-label="Pacientes">
            {loading ? (
              <p className="muted">Cargando pacientes…</p>
            ) : (
              <>
                {pacientes.map((p) => (
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
                {!pacientes.length && (
                  <p className="muted">No hay pacientes para esa búsqueda.</p>
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
