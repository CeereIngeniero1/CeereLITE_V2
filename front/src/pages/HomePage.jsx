import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import * as api from '../api/client';

export default function HomePage() {
  const { user } = useAuth();
  const [companies, setCompanies] = useState([]);
  const [usersPreview, setUsersPreview] = useState([]);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [co, us] = await Promise.all([
          api.fetchCompanies(),
          api.fetchUsers(),
        ]);
        if (!cancelled) {
          setCompanies(co);
          setUsersPreview(Array.isArray(us) ? us.slice(0, 5) : []);
        }
      } catch (e) {
        if (!cancelled)
          setError(
            e.response?.data?.message ?? e.message ?? 'Error cargando datos',
          );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!user?.documentoEntidad) return;
    let cancelled = false;
    (async () => {
      try {
        const d = await api.fetchCompanyDetail(user.documentoEntidad);
        if (!cancelled) setDetail(d?.[0] ?? null);
      } catch {
        if (!cancelled) setDetail(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.documentoEntidad]);

  return (
    <div className="page">
      <header className="top">
        <div>
          <p className="page-eyebrow">Resumen</p>
          <h1>Inicio</h1>
          <p className="muted">
            {user?.nombreUsuario} · nivel {user?.userLevel} · doc.{' '}
            {user?.documentoEntidad}
          </p>
        </div>
      </header>

      {error && <div className="alert alert-error">{error}</div>}

      <section className="card">
        <h2>Empresa asociada al usuario (detalle)</h2>
        {detail ? (
          <ul className="list">
            <li>
              <strong>{detail.nombreEmpresa}</strong>
            </li>
            <li>NIT: {detail.documentoEmpresa}</li>
            <li>{detail.direccionEmpresa || '—'}</li>
            <li>{detail.telefonoEmpresa || '—'}</li>
            <li>{detail.correoEmpresa || '—'}</li>
          </ul>
        ) : (
          <p className="muted">Sin datos de empresa para este documento.</p>
        )}
      </section>

      <section className="card">
        <h2>Empresas en base ({companies.length})</h2>
        <ul className="list compact">
          {companies.map((c) => (
            <li key={c.documentoEmpresa}>
              {c.nombreComercialEmpresa} · {c.documentoEmpresa}
            </li>
          ))}
        </ul>
        <p className="muted">Listado desde la API.</p>
      </section>

      <section className="card">
        <h2>Pacientes (primeros 5 de /users)</h2>
        <ul className="list compact">
          {usersPreview.map((u) => (
            <li key={u.id}>
              {u.name} — {u.id}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
