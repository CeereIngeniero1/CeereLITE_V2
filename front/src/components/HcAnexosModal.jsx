import { useEffect, useState } from 'react';
import {
  createPacienteAnexo,
  fetchPacienteAnexoArchivo,
  fetchPacienteAnexos,
  messageFromAxiosError,
  uploadPacienteAnexoArchivo,
} from '../api/client';

function formatFechaAnexo(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

export function HcAnexosModal({
  documentoPaciente,
  nombrePaciente,
  onClose,
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [okMessage, setOkMessage] = useState('');
  const [openingId, setOpeningId] = useState(null);
  const [replacingId, setReplacingId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [savingNew, setSavingNew] = useState(false);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function loadItems() {
    const rows = await fetchPacienteAnexos(documentoPaciente);
    setItems(Array.isArray(rows) ? rows : []);
  }

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    setError('');
    setOkMessage('');
    setItems([]);
    setCreating(false);
    (async () => {
      try {
        const rows = await fetchPacienteAnexos(documentoPaciente);
        if (!cancel) setItems(Array.isArray(rows) ? rows : []);
      } catch (e) {
        if (!cancel) {
          setError(
            await messageFromAxiosError(
              e,
              'No se pudieron cargar los documentos anexos',
            ),
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

  async function abrir(item) {
    setOpeningId(item.id);
    setError('');
    try {
      const { blob, fileName } = await fetchPacienteAnexoArchivo(
        documentoPaciente,
        item.id,
      );
      const name = fileName || 'documento';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      setError(await messageFromAxiosError(e, 'No se pudo abrir el documento'));
    } finally {
      setOpeningId(null);
    }
  }

  async function reemplazar(id, file, input) {
    if (!file) return;
    setReplacingId(id);
    setError('');
    setOkMessage('');
    try {
      await uploadPacienteAnexoArchivo(documentoPaciente, id, file);
      setOkMessage('Archivo reemplazado en Documentos.');
    } catch (e) {
      setError(
        await messageFromAxiosError(e, 'No se pudo reemplazar el archivo'),
      );
    } finally {
      setReplacingId(null);
      if (input) input.value = '';
    }
  }

  function startNuevo() {
    setError('');
    setOkMessage('');
    setNuevoNombre('');
    setCreating(true);
  }

  async function crear(file, input) {
    if (!file) return;
    const nombre = nuevoNombre.trim();
    if (!nombre) {
      setError('Escriba el nombre que aparecerá en el listado.');
      if (input) input.value = '';
      return;
    }
    setSavingNew(true);
    setError('');
    setOkMessage('');
    try {
      await createPacienteAnexo(documentoPaciente, file, nombre);
      await loadItems();
      setCreating(false);
      setNuevoNombre('');
      setOkMessage('Documento anexo creado.');
    } catch (e) {
      setError(await messageFromAxiosError(e, 'No se pudo crear el documento'));
    } finally {
      setSavingNew(false);
      if (input) input.value = '';
    }
  }

  const busy =
    openingId != null || replacingId != null || savingNew || loading;

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-dialog hc-list-dialog hc-anexos-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="hc-anexos-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <div>
            <h2 id="hc-anexos-title">Documentos anexos</h2>
            <p className="muted" style={{ margin: '0.25rem 0 0' }}>
              {nombrePaciente}
              {documentoPaciente ? (
                <span className="td-mono"> · {documentoPaciente}</span>
              ) : null}
            </p>
          </div>
          <div className="hc-anexos-header-actions">
            <button
              type="button"
              className="secondary hc-anexos-plus"
              disabled={busy || creating}
              aria-label="Nuevo documento anexo"
              onClick={startNuevo}
            >
              +
            </button>
            <button type="button" className="btn-outline" onClick={onClose}>
              Cerrar
            </button>
          </div>
        </header>
        <div className="modal-body">
          {loading && <p className="muted">Cargando documentos…</p>}
          {error && <div className="alert alert-error">{error}</div>}
          {okMessage && <div className="alert alert-ok">{okMessage}</div>}
          {creating && (
            <div className="hc-anexos-new">
              <label className="hc-anexos-new-name">
                Nombre
                <input
                  type="text"
                  value={nuevoNombre}
                  disabled={savingNew}
                  autoFocus
                  onChange={(e) => setNuevoNombre(e.target.value)}
                />
              </label>
              <label className="hc-anexos-file-label">
                {savingNew ? 'Guardando…' : 'Seleccionar archivo'}
                <input
                  type="file"
                  disabled={savingNew || !nuevoNombre.trim()}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    void crear(file, e.target);
                  }}
                />
              </label>
              <button
                type="button"
                className="btn-outline"
                disabled={savingNew}
                onClick={() => {
                  setCreating(false);
                  setNuevoNombre('');
                }}
              >
                Cancelar
              </button>
            </div>
          )}
          {!loading && !items.length && !error && !creating && (
            <p className="muted hc-list-empty">
              Este paciente aún no tiene documentos anexos.
            </p>
          )}
          {!loading && items.length > 0 && (
            <div className="table-wrap hc-anexos-table-wrap">
              <table className="usuarios-table hc-anexos-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Fecha</th>
                    <th>Seleccionar</th>
                    <th>Abrir</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td className="td-mono">{item.nombre}</td>
                      <td>{formatFechaAnexo(item.fecha)}</td>
                      <td>
                        <label className="hc-anexos-file-label">
                          {replacingId === item.id
                            ? 'Reemplazando…'
                            : 'Seleccionar'}
                          <input
                            type="file"
                            disabled={busy}
                            aria-label={`Seleccionar archivo para ${item.nombre}`}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              void reemplazar(item.id, file, e.target);
                            }}
                          />
                        </label>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="secondary"
                          disabled={busy}
                          onClick={() => void abrir(item)}
                        >
                          {openingId === item.id ? 'Abriendo…' : 'Abrir'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
