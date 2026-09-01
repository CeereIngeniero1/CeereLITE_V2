import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { fetchHealthDb } from '../api/client';
import { BrandLockup } from '../components/BrandLogo';

export default function LoginPage() {
  const { login, isAuthenticated, hydrated } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [dbStatus, setDbStatus] = useState(null);

  useEffect(() => {
    if (hydrated && isAuthenticated) {
      navigate('/principal/home', { replace: true });
    }
  }, [hydrated, isAuthenticated, navigate]);

  async function checkDb() {
    try {
      await fetchHealthDb();
      setDbStatus({ ok: true, msg: 'Base de datos: conectada' });
    } catch (e) {
      setDbStatus({
        ok: false,
        msg: e.response?.data?.message ?? e.message ?? 'Sin conexión a DB',
      });
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      await login(username, password);
      navigate('/principal/home', { replace: true });
    } catch (err) {
      const msg =
        err.response?.data?.message ??
        err.response?.data?.error ??
        'Credenciales incorrectas';
      setError(typeof msg === 'string' ? msg : 'Error al iniciar sesión');
    }
  }

  return (
    <div className="login-split">
      <aside className="login-hero">
        <div className="login-hero-center">
          <BrandLockup white size="md" subtitle="CEERESIO LITE" />
        </div>
        <div className="login-hero-foot">
          <p className="login-hero-badge">Seguro y confiable</p>
          <p className="login-hero-copy">
            Copyright © 2026 CEERE Software. Todos los derechos reservados.
          </p>
        </div>
      </aside>

      <section className="login-panel">
        <div className="login-card">
          <BrandLockup size="md" />
          <p className="login-welcome">Bienvenido de nuevo</p>
          <h1>Iniciar sesión</h1>
          {error && <div className="alert alert-error">{error}</div>}
          {dbStatus && (
            <div className={dbStatus.ok ? 'alert alert-ok' : 'alert alert-warn'}>
              {dbStatus.msg}
            </div>
          )}
          <form onSubmit={onSubmit} className="login-form">
            <label className="login-field">
              <span className="login-field-icon" aria-hidden>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                  <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.7" />
                  <path
                    d="M5 19.2c.8-3.2 3.4-5 7-5s6.2 1.8 7 5"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                placeholder="Usuario"
                required
              />
            </label>
            <label className="login-field">
              <span className="login-field-icon" aria-hidden>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                  <rect
                    x="5"
                    y="11"
                    width="14"
                    height="9"
                    rx="2"
                    stroke="currentColor"
                    strokeWidth="1.7"
                  />
                  <path
                    d="M8 11V8.5a4 4 0 0 1 8 0V11"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="Contraseña"
                required
              />
              <button
                type="button"
                className="login-field-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showPassword ? (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden>
                    <path
                      d="M3 3l18 18"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                    />
                    <path
                      d="M10.5 10.7a2.2 2.2 0 0 0 3 2.9"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                    />
                    <path
                      d="M6.7 6.9C4.6 8.3 3.2 10.2 2.5 12c1.6 4.2 5.3 7 9.5 7 1.8 0 3.5-.5 5-1.3M9.5 5.3A10.8 10.8 0 0 1 12 5c4.2 0 7.9 2.8 9.5 7-.4 1.1-1 2.1-1.8 3"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                    />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden>
                    <path
                      d="M2.5 12C4.1 7.8 7.8 5 12 5s7.9 2.8 9.5 7c-1.6 4.2-5.3 7-9.5 7s-7.9-2.8-9.5-7z"
                      stroke="currentColor"
                      strokeWidth="1.7"
                    />
                    <circle cx="12" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.7" />
                  </svg>
                )}
              </button>
            </label>
            <button type="submit" className="login-submit">
              Iniciar sesión
            </button>
            <button type="button" className="login-db" onClick={checkDb}>
              Probar conexión DB
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
