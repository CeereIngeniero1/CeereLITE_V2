import { useEffect, useRef, useState } from 'react';
import { fetchMe, updateMe, uploadMeFoto } from '../api/client';
import { useAuth } from '../auth/AuthContext';

function initialsFrom(name, username) {
  const src = String(name || username || '').trim();
  if (!src) return '?';
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function blank(value) {
  return String(value ?? '').trim();
}

function profileToMeta(me) {
  return {
    username: blank(me?.username),
    documentoEntidad: blank(me?.documentoEntidad),
    userLevel: me?.userLevel ?? '',
    fotoUrl: me?.fotoUrl ?? '',
    nombreUsuario: blank(me?.nombreUsuario),
  };
}

function profileToForm(me, prev) {
  return {
    ...prev,
    primerNombre: blank(me?.primerNombre),
    segundoNombre: blank(me?.segundoNombre),
    primerApellido: blank(me?.primerApellido),
    segundoApellido: blank(me?.segundoApellido),
    email: blank(me?.email),
    telefono: blank(me?.telefono),
  };
}

export function UserProfileModal({ onClose }) {
  const { user, applyUser } = useAuth();
  const [form, setForm] = useState(() =>
    profileToForm(user, {
      primerNombre: '',
      segundoNombre: '',
      primerApellido: '',
      segundoApellido: '',
      email: '',
      telefono: '',
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    }),
  );
  const [meta, setMeta] = useState(() => profileToMeta(user));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [fotoBusy, setFotoBusy] = useState(false);
  const fotoInputRef = useRef(null);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    setError('');
    (async () => {
      try {
        const me = await fetchMe();
        if (cancel) return;
        applyUser(me);
        setMeta(profileToMeta(me));
        setForm((prev) => profileToForm(me, prev));
      } catch (e) {
        if (!cancel) {
          if (user) {
            setMeta(profileToMeta(user));
            setForm((prev) => profileToForm(user, prev));
          }
          const msg =
            e.response?.data?.message ??
            e.response?.data?.error ??
            e.message ??
            'No se pudo cargar el perfil';
          setError(Array.isArray(msg) ? msg.join('. ') : String(msg));
        }
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
    // Cargar una sola vez al abrir el modal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onFotoSelected(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    setOk('');
    if (!file.type.startsWith('image/')) {
      setError('Seleccione un archivo de imagen');
      return;
    }
    setFotoBusy(true);
    try {
      const me = await uploadMeFoto(file);
      applyUser(me);
      setMeta(profileToMeta(me));
      setOk('Foto actualizada');
    } catch (err) {
      const msg =
        err.response?.data?.message ??
        err.response?.data?.error ??
        err.message ??
        'No se pudo guardar la foto';
      setError(Array.isArray(msg) ? msg.join('. ') : String(msg));
    } finally {
      setFotoBusy(false);
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setOk('');
    if (form.newPassword && form.newPassword !== form.confirmPassword) {
      setError('La confirmación de la nueva contraseña no coincide');
      return;
    }
    if (form.newPassword && !form.currentPassword) {
      setError('Indique la contraseña actual para cambiarla');
      return;
    }
    setSaving(true);
    try {
      const body = {
        primerNombre: blank(form.primerNombre),
        segundoNombre: blank(form.segundoNombre),
        primerApellido: blank(form.primerApellido),
        segundoApellido: blank(form.segundoApellido),
        email: blank(form.email),
        telefono: blank(form.telefono),
      };
      if (form.newPassword) {
        body.currentPassword = form.currentPassword;
        body.newPassword = form.newPassword;
      }
      const me = await updateMe(body);
      applyUser(me);
      setMeta(profileToMeta(me));
      setForm(
        profileToForm(me, {
          primerNombre: '',
          segundoNombre: '',
          primerApellido: '',
          segundoApellido: '',
          email: '',
          telefono: '',
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        }),
      );
      setOk('Datos actualizados');
    } catch (err) {
      const msg =
        err.response?.data?.message ??
        err.response?.data?.error ??
        err.message ??
        'No se pudo guardar';
      setError(Array.isArray(msg) ? msg.join('. ') : String(msg));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-dialog profile-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <div className="profile-header-id">
            <div className="profile-header-photo">
              {meta.fotoUrl ? (
                <img
                  className="topbar-avatar topbar-avatar-lg"
                  src={meta.fotoUrl}
                  alt=""
                />
              ) : (
                <span className="topbar-avatar topbar-avatar-lg" aria-hidden>
                  {initialsFrom(meta.nombreUsuario, meta.username)}
                </span>
              )}
              <input
                ref={fotoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                hidden
                onChange={(e) => void onFotoSelected(e)}
              />
              <button
                type="button"
                className="secondary profile-foto-btn"
                disabled={loading || saving || fotoBusy}
                onClick={() => fotoInputRef.current?.click()}
              >
                {fotoBusy ? 'Guardando…' : 'Cambiar foto'}
              </button>
            </div>
            <div>
              <p className="page-eyebrow">Usuario conectado</p>
              <h2 id="profile-title">Mi perfil</h2>
            </div>
          </div>
          <button type="button" className="btn-outline" onClick={onClose}>
            Cerrar
          </button>
        </header>

        <div className="modal-body">
          {loading && <p className="muted">Cargando perfil…</p>}
          {error && <div className="alert alert-error">{error}</div>}
          {ok && <div className="alert alert-ok">{ok}</div>}
          {!loading && (
            <form className="form" onSubmit={(e) => void onSubmit(e)}>
              <div className="profile-readonly">
                <p className="profile-readonly-wide">
                  <span className="muted">Nombre completo</span>
                  <strong>{meta.nombreUsuario || '—'}</strong>
                </p>
                <p>
                  <span className="muted">Usuario</span>
                  <strong>{meta.username || '—'}</strong>
                </p>
                <p>
                  <span className="muted">Documento</span>
                  <strong>{meta.documentoEntidad || '—'}</strong>
                </p>
                <p>
                  <span className="muted">Nivel</span>
                  <strong>{meta.userLevel || '—'}</strong>
                </p>
              </div>

              <div className="profile-grid">
                <label>
                  Primer nombre
                  <input
                    value={form.primerNombre}
                    onChange={(e) => setField('primerNombre', e.target.value)}
                    required
                  />
                </label>
                <label>
                  Segundo nombre
                  <input
                    value={form.segundoNombre}
                    onChange={(e) => setField('segundoNombre', e.target.value)}
                  />
                </label>
                <label>
                  Primer apellido
                  <input
                    value={form.primerApellido}
                    onChange={(e) => setField('primerApellido', e.target.value)}
                    required
                  />
                </label>
                <label>
                  Segundo apellido
                  <input
                    value={form.segundoApellido}
                    onChange={(e) => setField('segundoApellido', e.target.value)}
                  />
                </label>
                <label>
                  Correo
                  <input
                    type="text"
                    autoComplete="email"
                    value={form.email}
                    onChange={(e) => setField('email', e.target.value)}
                  />
                </label>
                <label>
                  Teléfono
                  <input
                    value={form.telefono}
                    onChange={(e) => setField('telefono', e.target.value)}
                  />
                </label>
              </div>

              <h3 className="profile-section-title">Cambiar contraseña</h3>
              <p className="muted">Déjelo en blanco si no desea cambiarla.</p>
              <div className="profile-grid">
                <label>
                  Contraseña actual
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={form.currentPassword}
                    onChange={(e) =>
                      setField('currentPassword', e.target.value)
                    }
                  />
                </label>
                <label>
                  Nueva contraseña
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={form.newPassword}
                    onChange={(e) => setField('newPassword', e.target.value)}
                  />
                </label>
                <label>
                  Confirmar nueva
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={form.confirmPassword}
                    onChange={(e) =>
                      setField('confirmPassword', e.target.value)
                    }
                  />
                </label>
              </div>

              <div className="confirm-actions">
                <button type="button" className="secondary" onClick={onClose}>
                  Cancelar
                </button>
                <button type="submit" disabled={saving}>
                  {saving ? 'Guardando…' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
