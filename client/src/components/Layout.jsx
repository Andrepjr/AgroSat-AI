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
  Settings,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getAlertsSummary } from '../services/api';
import './Layout.css';

const operacaoItems = [
  { to: '/dashboard',   label: 'Dashboard',    Icon: LayoutDashboard },
  { to: '/chat',        label: 'Consultor IA', Icon: MessageSquare },
  { to: '/diagnostics', label: 'Diagnóstico',  Icon: Stethoscope },
  { to: '/alerts',      label: 'Alertas',      Icon: BellRing, hasAlertBadge: true },
];

export default function Layout() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') setSidebarOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    async function fetchAlerts() {
      try {
        const res = await getAlertsSummary();
        setUnreadCount(res.data?.nao_lidos ?? res.data?.NAO_LIDOS ?? 0);
      } catch {}
    }
    fetchAlerts();
    const t = setInterval(fetchAlerts, 60_000);
    return () => clearInterval(t);
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
        {unreadCount > 0 && (
          <span className="topbar-alert-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
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
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <Leaf size={22} color="#22C55E" />
          </div>
          <div className="sidebar-logo-text">
            <div className="sidebar-logo-row">
              <span className="sidebar-logo-name">AgroSat AI</span>
              <span className="sidebar-version">V2.4</span>
            </div>
            <span className="sidebar-farm">Fazenda São Paulo</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          <div className="nav-section">
            <span className="nav-section-label">OPERAÇÃO</span>
            {operacaoItems.map(({ to, label, Icon, hasAlertBadge }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `nav-item${isActive ? ' nav-item--active' : ''}`
                }
              >
                <Icon size={17} />
                <span className="nav-item-label">{label}</span>
                {hasAlertBadge && unreadCount > 0 && (
                  <span className="nav-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
                )}
              </NavLink>
            ))}
          </div>

          <div className="nav-section nav-section--bottom">
            <span className="nav-section-label">CONTA</span>
            <button className="nav-item nav-item--disabled" disabled>
              <Settings size={17} />
              <span className="nav-item-label">Configurações</span>
              <span className="nav-soon">em breve</span>
            </button>
            <button className="nav-item nav-item--logout" onClick={handleLogout}>
              <LogOut size={17} />
              <span className="nav-item-label">Sair</span>
            </button>
          </div>
        </nav>

        {/* User footer */}
        <div className="sidebar-footer">
          <div className="user-avatar">
            {usuario?.nome?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <div className="user-details">
            <span className="user-name">{usuario?.nome}</span>
            <span className="user-email">{usuario?.email}</span>
          </div>
        </div>
      </aside>

      {/* ── Conteúdo principal ── */}
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
