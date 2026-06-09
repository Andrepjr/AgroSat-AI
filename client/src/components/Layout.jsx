import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  MessageSquare,
  Stethoscope,
  BellRing,
  LogOut,
  Leaf,
  Menu,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './Layout.css';

const navItems = [
  { to: '/dashboard',   label: 'Dashboard',  Icon: LayoutDashboard },
  { to: '/chat',        label: 'Chat IA',     Icon: MessageSquare },
  { to: '/diagnostics', label: 'Diagnóstico', Icon: Stethoscope },
  { to: '/alerts',      label: 'Alertas',     Icon: BellRing },
];

export default function Layout() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Fecha sidebar ao navegar (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Fecha sidebar ao pressionar Escape
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') setSidebarOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="layout">
      {/* ── Topbar (tablet / mobile only) ── */}
      <header className="topbar">
        <button
          className="hamburger"
          onClick={() => setSidebarOpen(v => !v)}
          aria-label={sidebarOpen ? 'Fechar menu' : 'Abrir menu'}
        >
          {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <div className="topbar-brand">
          <Leaf size={18} color="#22C55E" />
          <span>AgroSat AI</span>
        </div>
      </header>

      {/* ── Overlay (fecha ao clicar fora no mobile) ── */}
      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar ── */}
      <aside className={`sidebar${sidebarOpen ? ' sidebar--open' : ''}`}>
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

      {/* ── Conteúdo principal ── */}
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
