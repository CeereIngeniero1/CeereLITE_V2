import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useCompany } from '../auth/CompanyContext';

export function PrivateRoute() {
  const { isAuthenticated, hydrated } = useAuth();
  const { ready } = useCompany();
  if (!hydrated) return <div className="page muted shell-loading">Cargando sesión…</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!ready) return <div className="page muted shell-loading">Cargando empresa…</div>;
  return <Outlet />;
}
