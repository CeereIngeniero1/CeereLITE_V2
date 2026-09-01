import { useEffect, useState } from 'react';
import {
  createPacienteObservacion,
  fetchPacienteObservaciones,
  messageFromAxiosError,
  updatePacienteObservacion,
} from '../api/client';

function formatFechaObs(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

function previewObs(value) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text || '—';
}

function estadoLabel(idEstado) {
  return Number(idEstado) === 8 ? 'Desactivado' : 'Activado';
}

export function HcObservacionesModal({
  documentoPaciente,
  nombrePaciente,
  onClose,
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [okMessage, setOkMessage] = useState('');
  const [detail, setDetail] = useState(null);
  const [detailText, setDetailText] = useState('');
  const [detailEstado, setDetailEstado] = useState(7);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    function onKey(e) {
      if (e.key !== 'Escape') return;
      if (detail) {
        e.stopPropagation();
        closeDetail();
        return;
      }
      onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, detail]);

  async function loadItems() {
    const rows = await fetchPacienteObservaciones(documentoPaciente);
    const list = Array.isArray(rows) ? rows : [];
    setItems(list);
    return list;
  }

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    setError('');
    setOkMessage('');
    setItems([]);
    setDetail(null);
    (async () => {
      try {
        const rows = await fetchPacienteObservaciones(documentoPaciente);
        if (!cancel) setItems(Array.isArray(rows) ? rows : []);
      } catch (e) {
        if (!cancel) {
          setError(
            await messageFromAxiosError(
              e,
              'No se pudieron cargar las observaciones',
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

  function closeDetail() {
    if (saving) return;
    setDetail(null);
    setDetailText('');
    setDetailEstado(7);
  }

  function openNew() {
    setError('');
    setOkMessage('');
    setDetail({ mode: 'new' });
    setDetailText('');
    setDetailEstado(7);
  }

  function openEdit(item) {
    setError('');
    setOkMessage('');
    setDetail({ mode: 'edit', item });
    setDetailText(item.observacion ?? '');
    setDetailEstado(Number(item.idEstado) === 8 ? 8 : 7);
  }

  async function guardarDetalle() {
    const texto = detailText.trim();
    if (!texto) {
      setError('La observación no puede estar vacía.');
      return;
    }
    setSaving(true);
    setError('');
    setOkMessage('');
    try {
      if (detail?.mode === 'new') {
        await createPacienteObservacion(documentoPaciente, texto);
        setOkMessage('Observación creada.');
      } else {
        await updatePacienteObservacion(documentoPaciente, detail.item.id, {
          observacion: texto,
          idEstado: Number(detailEstado) === 8 ? 8 : 7,
        });
        setOkMessage('Observación actualizada.');
      }
      await loadItems();
      setDetail(null);
      setDetailText('');
      setDetailEstado(7);
    } catch (e) {
      setError(
        await messageFromAxiosError(e, 'No se pudo guardar la observación'),
      );
    } finally {
      setSaving(false);
    }
  }

  const busy = loading || saving;
  const isNew = detail?.mode === 'new';

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-dialog hc-list-dialog hc-obs-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="hc-obs-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <div>
            <h2 id="hc-obs-title">Observaciones</h2>
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
              disabled={busy || Boolean(detail)}
              aria-label="Nueva observación"
              onClick={openNew}
            >
              +
            </button>
            <button type="button" className="btn-outline" onClick={onClose}>
              Cerrar
            </button>
          </div>
        </header>
        <div className="modal-body">
          {loading && <p className="muted">Cargando observaciones…</p>}
          {error && !detail && (
            <div className="alert alert-error">{error}</div>
          )}
          {okMessage && !detail && (
            <div className="alert alert-ok">{okMessage}</div>
          )}
          {!loading && !items.length && !error && (
            <p className="muted hc-list-empty">
              Este paciente aún no tiene observaciones.
            </p>
          )}
          {!loading && items.length > 0 && (
            <div className="table-wrap hc-obs-table-wrap">
              <table className="usuarios-table hc-obs-table">
                <thead>
                  <tr>
                    <th>Fecha y hora</th>
                    <th>Observaciones entidad</th>
                    <th>Estado</th>
                    <th>Usuario</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr
                      key={item.id}
                      className="hc-obs-row"
                      onClick={() => openEdit(item)}
                    >
                      <td>{formatFechaObs(item.fecha)}</td>
                      <td className="hc-obs-preview" title={item.observacion}>
                        {previewObs(item.observacion)}
                      </td>
                      <td>{estadoLabel(item.idEstado)}</td>
                      <td>{item.nombreUsuario || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {detail ? (
        <div
          className="modal-backdrop hc-obs-detail-backdrop"
          role="presentation"
          onClick={(e) => {
            e.stopPropagation();
            closeDetail();
          }}
        >
          <div
            className="modal-dialog hc-obs-detail-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="hc-obs-detail-title"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="modal-header">
              <div>
                <h2 id="hc-obs-detail-title">
                  {isNew ? 'Nueva observación' : 'Observación'}
                </h2>
                <p className="muted" style={{ margin: '0.25rem 0 0' }}>
                  {isNew
                    ? 'Fecha y usuario se asignan al guardar'
                    : `${formatFechaObs(detail.item.fecha)}${
                        detail.item.nombreUsuario
                          ? ` · ${detail.item.nombreUsuario}`
                          : ''
                      }`}
                </p>
              </div>
              <button
                type="button"
                className="btn-outline"
                disabled={saving}
                onClick={closeDetail}
              >
                Cerrar
              </button>
            </header>
            <div className="modal-body">
              {error && <div className="alert alert-error">{error}</div>}
              <label className="hc-obs-new-text">
                Observaciones entidad
                <textarea
                  rows={8}
                  value={detailText}
                  disabled={saving}
                  autoFocus
                  onChange={(e) => setDetailText(e.target.value)}
                />
              </label>
              {!isNew && (
                <label className="hc-obs-new-text">
                  Estado
                  <select
                    className="hc-obs-estado"
                    disabled={saving}
                    value={detailEstado}
                    onChange={(e) => setDetailEstado(Number(e.target.value))}
                  >
                    <option value={7}>Activado</option>
                    <option value={8}>Desactivado</option>
                  </select>
                </label>
              )}
              <div className="hc-obs-new-actions">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void guardarDetalle()}
                >
                  {saving ? 'Guardando…' : 'Guardar'}
                </button>
                <button
                  type="button"
                  className="btn-outline"
                  disabled={saving}
                  onClick={closeDetail}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
