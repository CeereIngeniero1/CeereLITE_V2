import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useCompany } from '../auth/CompanyContext';
import { useTheme } from '../theme/ThemeContext';
import { BrandLockup } from '../components/BrandLogo';
import { UserProfileModal } from '../components/UserProfileModal';

const moduleLinks = [
  { to: '/principal/home', label: 'Inicio', icon: '⌂' },
  { to: '/principal/agenda', label: 'Agenda', icon: '▦' },
  { to: '/principal/programaciones', label: 'Programaciones', icon: '☰' },
  { to: '/principal/usuarios', label: 'Usuarios', icon: '👥' },
  { to: '/principal/evolucion', label: 'Historias clínicas', icon: '⚕' },
  { to: '/principal/empresa', label: 'Empresa', icon: '🏛' },
];

function shortLoggedName(user) {
  const first = String(user?.primerNombre ?? '').trim();
  const last = String(user?.primerApellido ?? '').trim();
  if (first && last) return `${first} ${last}`;
  if (first) return first;

  const full = String(user?.nombreUsuario ?? '').trim();
  if (full) {
    const parts = full.split(/\s+/).filter(Boolean);
    if (parts.length >= 4) return `${parts[0]} ${parts[2]}`;
    if (parts.length >= 2) return `${parts[0]} ${parts[1]}`;
    return parts[0];
  }
  return String(user?.username ?? '').trim();
}

export function Sidebar() {
  const [open, setOpen] = useState(true);
  const [facturaOpen, setFacturaOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const { user, logout } = useAuth();
  const { nombreComercialEmpresa } = useCompany();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();

  function toggleSidebar() {
    setOpen((v) => {
      const next = !v;
      if (!next) {
        setFacturaOpen(false);
      }
      return next;
    });
  }

  const displayName = shortLoggedName(user);

  return (
    <>
    <aside className={`sidebar ${open ? 'sidebar-open' : 'sidebar-collapsed'}`}>
      <div className="sidebar-brand">
        <BrandLockup
          white
          mark={!open}
          size="sm"
          subtitle={open ? 'CEERESIO LITE' : undefined}
          meta={open ? displayName || undefined : undefined}
          detail={open ? nombreComercialEmpresa || undefined : undefined}
          onMetaClick={open ? () => setProfileOpen(true) : undefined}
        />
      </div>

      <nav className="sidebar-nav">
        {open && <p className="sidebar-section-label">Módulos</p>}
        {moduleLinks.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'active' : ''}`
            }
            end={to === '/principal/home'}
            title={label}
          >
            <span className="sidebar-link-icon" aria-hidden>
              {icon}
            </span>
            {open && <span>{label}</span>}
          </NavLink>
        ))}

        <div className="sidebar-submenu-wrap">
          <button
            type="button"
            className={`sidebar-link sidebar-submenu-head ${facturaOpen ? 'active' : ''}`}
            onClick={() => setFacturaOpen((v) => !v)}
          >
            <span className="sidebar-link-icon">$</span>
            {open && <span>Facturación</span>}
            {open && <span className="chevron">{facturaOpen ? '▾' : '▸'}</span>}
          </button>
          {open && facturaOpen && (
            <div className="sidebar-submenu">
              <NavLink
                to="/principal/facturacion"
                className={({ isActive }) =>
                  `sidebar-sublink${isActive ? ' active' : ''}`
                }
              >
                Crear factura
              </NavLink>
              <NavLink
                to="/principal/agregar-resolucion"
                className={({ isActive }) =>
                  `sidebar-sublink${isActive ? ' active' : ''}`
                }
              >
                Agregar resolución
              </NavLink>
              <NavLink
                to="/principal/agregar-productos"
                className={({ isActive }) =>
                  `sidebar-sublink${isActive ? ' active' : ''}`
                }
              >
                Agregar productos
              </NavLink>
            </div>
          )}
        </div>

        {open && <p className="sidebar-section-label">Herramientas</p>}
        <NavLink
          to="/principal/configuracion"
          className={({ isActive }) =>
            `sidebar-link ${isActive ? 'active' : ''}`
          }
          title="Configuración"
        >
          <span className="sidebar-link-icon" aria-hidden>
            ⚙
          </span>
          {open && <span>Configuración</span>}
        </NavLink>
      </nav>

      <div className="sidebar-footer">
        <button
          type="button"
          className="sidebar-link"
          onClick={toggleSidebar}
          title={open ? 'Comprimir menú' : 'Expandir menú'}
        >
          <span className="sidebar-link-icon" aria-hidden>
            {open ? '‹' : '›'}
          </span>
          {open && <span>Comprimir menú</span>}
        </button>
        <button
          type="button"
          className="sidebar-link"
          onClick={toggleTheme}
          title={isDark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
        >
          <span className="sidebar-link-icon" aria-hidden>
            {isDark ? '☀' : '☾'}
          </span>
          {open && <span>{isDark ? 'Tema claro' : 'Tema oscuro'}</span>}
        </button>
        <button
          type="button"
          className="sidebar-logout"
          onClick={() => {
            logout();
            navigate('/login', { replace: true });
          }}
          title="Cerrar sesión"
        >
          <span className="sidebar-link-icon" aria-hidden>
            ⏻
          </span>
          {open && <span>Cerrar sesión</span>}
        </button>
      </div>
    </aside>
    {profileOpen ? (
      <UserProfileModal onClose={() => setProfileOpen(false)} />
    ) : null}
    </>
  );
}
