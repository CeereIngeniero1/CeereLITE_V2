import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { CompanyProvider } from './auth/CompanyContext';
import { ThemeProvider } from './theme/ThemeContext';
import { PrivateRoute } from './routes/PrivateRoute';
import { AppLayout } from './layout/AppLayout';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import PlaceholderPage from './pages/PlaceholderPage';
import UsuariosPage from './pages/UsuariosPage';
import EvolucionPage from './pages/EvolucionPage';
import AgendaPage from './pages/AgendaPage';
import ProgramacionesPage from './pages/ProgramacionesPage';
import EmpresaPage from './pages/EmpresaPage';
import './index.css';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <CompanyProvider>
            <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route element={<PrivateRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Navigate to="/principal/home" replace />} />
              <Route path="/principal/home" element={<HomePage />} />
              <Route path="/principal/agenda" element={<AgendaPage />} />
              <Route
                path="/principal/programaciones"
                element={<ProgramacionesPage />}
              />
              <Route path="/principal/evolucion" element={<EvolucionPage />} />
              <Route path="/principal/empresa" element={<EmpresaPage />} />
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
              <Route path="/principal/rda" element={<Navigate to="/principal/home" replace />} />
              <Route path="/principal/rda/*" element={<Navigate to="/principal/home" replace />} />
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
          </CompanyProvider>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
