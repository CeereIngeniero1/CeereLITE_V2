import { useEffect, useState } from 'react';
import { fetchPacienteDatos } from '../api/client';
import { PatientDataPanel } from './PatientDataPanel';

export function PatientEditModal({
  documentoPaciente,
  nombrePaciente,
  onClose,
  onSaved,
}) {
  const [demografia, setDemografia] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    setError('');
    setDemografia(null);
    (async () => {
      try {
        const data = await fetchPacienteDatos(documentoPaciente);
        if (!cancel) {
          setDemografia(data?.demografia ?? null);
        }
      } catch (e) {
        if (!cancel) {
          setError(
            e.response?.data?.message ??
              e.response?.data?.error ??
              e.message ??
              'No se pudieron cargar los datos del paciente',
          );
        }
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [documentoPaciente]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="patient-edit-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <div className="paciente-edit-header">
            {demografia?.fotoUrl ? (
              <img
                className="paciente-foto paciente-foto--modal"
                src={demografia.fotoUrl}
                alt=""
              />
            ) : null}
            <div>
            <p className="page-eyebrow">Ficha del paciente</p>
            <h2 id="patient-edit-title">Editar usuario</h2>
            <p className="muted" style={{ margin: '0.25rem 0 0' }}>
              {nombrePaciente}
              {documentoPaciente ? (
                <span className="td-mono"> · {documentoPaciente}</span>
              ) : null}
            </p>
            </div>
          </div>
          <button type="button" className="btn-outline" onClick={onClose}>
            Cerrar
          </button>
        </header>

        <div className="modal-body">
          {loading && <p className="muted">Cargando datos…</p>}
          {error && <div className="alert alert-error">{error}</div>}
          {!loading && !error && (
            <PatientDataPanel
              documentoPaciente={documentoPaciente}
              demografia={demografia}
              startEditing
              onSaved={async (opts) => {
                if (opts?.photoOnly) {
                  setDemografia((prev) =>
                    prev
                      ? {
                          ...prev,
                          fotoUrl: opts.fotoUrl ?? prev.fotoUrl,
                          fotoArchivo: opts.fotoArchivo ?? prev.fotoArchivo,
                        }
                      : prev,
                  );
                  onSaved?.(opts);
                  return;
                }
                try {
                  const data = await fetchPacienteDatos(documentoPaciente);
                  setDemografia(data?.demografia ?? null);
                } catch {
                  /* el listado se refresca igual */
                }
                onSaved?.(opts);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
