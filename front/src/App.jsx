import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { PrivateRoute } from './routes/PrivateRoute';
import { AppLayout } from './layout/AppLayout';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import PlaceholderPage from './pages/PlaceholderPage';
import UsuariosPage from './pages/UsuariosPage';
import EvolucionPage from './pages/EvolucionPage';
import './index.css';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route element={<PrivateRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Navigate to="/principal/home" replace />} />
              <Route path="/principal/home" element={<HomePage />} />
              <Route
                path="/principal/agenda"
                element={
                  <PlaceholderPage
                    title="Agenda"
                    hint="Aquí irá el calendario y citas (migración desde CeereLite)."
                  />
                }
              />
              <Route path="/principal/evolucion" element={<EvolucionPage />} />
              <Route
                path="/principal/facturacion"
                element={
                  <PlaceholderPage
                    title="Facturación"
                    hint="Flujo de facturas y resoluciones."
                  />
                }
              />
              <Route
                path="/principal/agregar-resolucion"
                element={
                  <PlaceholderPage
                    title="Agregar resolución"
                    hint="Alta y mantenimiento de resoluciones DIAN."
                  />
                }
              />
              <Route
                path="/principal/agregar-productos"
                element={
                  <PlaceholderPage
                    title="Agregar productos"
                    hint="Catálogo y tarifas."
                  />
                }
              />
              <Route path="/principal/usuarios" element={<UsuariosPage />} />
              {/* RDA va integrado en Evolución; rutas antiguas del menú RDA */}
              <Route
                path="/principal/rda"
                element={<Navigate to="/principal/evolucion" replace />}
              />
              <Route
                path="/principal/rda/*"
                element={<Navigate to="/principal/evolucion" replace />}
              />
              <Route
                path="/principal/rips"
                element={
                  <PlaceholderPage
                    title="RIPS"
                    hint="Relacionador, validación y envío."
                  />
                }
              />
              <Route
                path="/principal/configuracion"
                element={
                  <PlaceholderPage
                    title="Configuración"
                    hint="Empresa, logo y preferencias."
                  />
                }
              />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/principal/home" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
