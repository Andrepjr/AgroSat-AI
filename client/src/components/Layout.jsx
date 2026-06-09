import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  MessageSquare,
  Stethoscope,
  BellRing,
  LogOut,
  Leaf,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './Layout.css';

const navItems = [
  { to: '/dashboard',   label: 'Dashboard',    Icon: LayoutDashboard },
  { to: '/chat',        label: 'Chat IA',       Icon: MessageSquare },
  { to: '/diagnostics', label: 'Diagnóstico',   Icon: Stethoscope },
  { to: '/alerts',      label: 'Alertas',       Icon: BellRing },
];

export default function Layout() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <Leaf size={22} color="#22C55E" />
          <span>AgroSat AI</span>
        </div>

        <nav className="sidebar-nav">
          {navItems.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `nav-item${isActive ? ' nav-item--active' : ''}`
              }
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">
              {usuario?.nome?.[0]?.toUpperCase() ?? 'U'}
            </div>
            <div className="user-details">
              <span className="user-name">{usuario?.nome}</span>
              <span className="user-email">{usuario?.email}</span>
            </div>
          </div>
          <button className="logout-btn" onClick={handleLogout} title="Sair">
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
