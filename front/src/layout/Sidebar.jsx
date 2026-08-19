import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const mainLinks = [
  { to: '/principal/home', label: 'Inicio', icon: '⌂' },
  { to: '/principal/agenda', label: 'Agenda', icon: '▦' },
  { to: '/principal/evolucion', label: 'HC / Evolución', icon: '⚕' },
  { to: '/principal/usuarios', label: 'Usuarios', icon: '👥' },
  { to: '/principal/rips', label: 'RIPS', icon: '📋' },
  { to: '/principal/configuracion', label: 'Configuración', icon: '⚙' },
];

export function Sidebar() {
  const [open, setOpen] = useState(true);
  const [facturaOpen, setFacturaOpen] = useState(false);
  const { logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <aside className={`sidebar ${open ? 'sidebar-open' : 'sidebar-collapsed'}`}>
      <button
        type="button"
        className="sidebar-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title={open ? 'Contraer' : 'Expandir'}
      >
        {open ? '◂' : '▸'}
      </button>

      <div className="sidebar-brand">
        <span className="sidebar-brand-mark">C</span>
        {open && <span className="sidebar-brand-text">CeereSio Lite</span>}
      </div>

      <nav className="sidebar-nav">
        {mainLinks.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'active' : ''}`
            }
            end={to === '/principal/home'}
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
      </nav>

      <button type="button" className="sidebar-logout" onClick={handleLogout}>
        {open ? 'Cerrar sesión' : '⎆'}
      </button>
    </aside>
  );
}
