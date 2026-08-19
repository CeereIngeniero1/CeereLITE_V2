import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { fetchHealthDb } from '../api/client';

export default function LoginPage() {
  const { login, isAuthenticated, hydrated } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
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
    <div className="login-shell">
      <div className="login-card">
        <div className="login-brand">
          <span className="login-brand-mark">C</span>
          <div className="login-brand-text">
            <span className="login-brand-title">CeereSio Lite</span>
            <span className="login-brand-sub">Acceso al panel</span>
          </div>
        </div>
        <h1>Iniciar sesión</h1>
        <p className="muted login-lead">
          Usa las credenciales de tu cuenta.
        </p>
        {error && <div className="alert alert-error">{error}</div>}
        {dbStatus && (
          <div className={dbStatus.ok ? 'alert alert-ok' : 'alert alert-warn'}>
            {dbStatus.msg}
          </div>
        )}
        <form onSubmit={onSubmit} className="form">
          <label>
            Usuario
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label>
            Contraseña
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <button type="submit">Entrar</button>
          <button type="button" className="secondary" onClick={checkDb}>
            Probar conexión DB
          </button>
        </form>
      </div>
    </div>
  );
}
