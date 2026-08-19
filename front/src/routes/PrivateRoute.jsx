import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function PrivateRoute() {
  const { isAuthenticated, hydrated } = useAuth();
  if (!hydrated) return <div className="page muted shell-loading">Cargando sesión…</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Outlet />;
}
