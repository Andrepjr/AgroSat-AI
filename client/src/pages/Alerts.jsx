import { useState, useEffect } from 'react';
import {
  BellRing,
  RefreshCw,
  CheckCheck,
  Shield,
  AlertTriangle,
  Info,
  ChevronDown,
} from 'lucide-react';
import {
  getAlerts,
  checkAlerts,
  markAlertRead,
  markAllAlertsRead,
  getAlertsSummary,
} from '../services/api';
import './Alerts.css';

function SeverityIcon({ sev }) {
  const s = (sev || '').toUpperCase();
  if (s === 'CRITICO') return <AlertTriangle size={16} color="#EF4444" />;
  if (s === 'ALERTA')  return <AlertTriangle size={16} color="#F59E0B" />;
  return <Info size={16} color="#3B82F6" />;
}

function SeverityBadge({ sev }) {
  const s = (sev || '').toUpperCase();
  if (s === 'CRITICO') return <span className="badge badge-red">{sev}</span>;
  if (s === 'ALERTA')  return <span className="badge badge-amber">{sev}</span>;
  return <span className="badge badge-blue">{sev || 'INFO'}</span>;
}

function severityBorderColor(sev) {
  const s = (sev || '').toUpperCase();
  if (s === 'CRITICO') return 'var(--red)';
  if (s === 'ALERTA')  return 'var(--amber)';
  return 'var(--blue)';
}

function AlertItem({ alert, onRead }) {
  const [expanded, setExpanded] = useState(false);

  // Oracle retorna colunas em MAIÚSCULO; suporte a minúsculo como fallback
  const a = {
    id:         alert.ID         ?? alert.id,
    titulo:     alert.TITULO     ?? alert.titulo     ?? '',
    descricao:  alert.DESCRICAO  ?? alert.descricao  ?? '',
    severidade: alert.SEVERIDADE ?? alert.severidade ?? '',
    setor:      alert.SETOR      ?? alert.setor      ?? '',
    lido:       alert.LIDO       ?? alert.lido,
    created_at: alert.CREATED_AT ?? alert.created_at,
  };

  const unread = !a.lido || a.lido === 0;

  const timestamp = a.created_at
    ? new Date(a.created_at).toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : '';

  function handleReadClick(e) {
    e.stopPropagation();
    onRead(a.id);
  }

  return (
    <div
      className={`alert-item card${unread ? ' alert-item--unread' : ''}${expanded ? ' alert-item--expanded' : ''}`}
      style={unread ? { borderLeftColor: severityBorderColor(a.severidade) } : {}}
    >
      {/* ── Header: sempre visível, clicável para expandir ── */}
      <div className="alert-header" onClick={() => setExpanded(v => !v)}>
        <div
          className="alert-icon-wrap"
          style={{ background: unread ? `${severityBorderColor(a.severidade)}18` : undefined }}
        >
          <SeverityIcon sev={a.severidade} />
        </div>

        <div className="alert-header-body">
          <div className="alert-meta-row">
            <SeverityBadge sev={a.severidade} />
            {a.setor && <span className="badge badge-blue">{a.setor}</span>}
            {timestamp && <span className="alert-time">{timestamp}</span>}
          </div>
          <p className="alert-titulo">{a.titulo || '(sem título)'}</p>
          {!expanded && a.descricao && (
            <p className="alert-descricao-preview">{a.descricao}</p>
          )}
        </div>

        <div className="alert-header-right">
          {unread && !expanded && (
            <button
              className="alert-read-btn"
              onClick={handleReadClick}
              title="Marcar como lido"
            >
              <CheckCheck size={14} />
            </button>
          )}
          <ChevronDown
            size={15}
            className={`alert-chevron${expanded ? ' alert-chevron--up' : ''}`}
          />
        </div>
      </div>

      {/* ── Corpo expandido ── */}
      {expanded && (
        <div className="alert-body">
          {a.descricao ? (
            <p className="alert-descricao">{a.descricao}</p>
          ) : (
            <p className="alert-descricao alert-descricao--empty">Sem descrição disponível.</p>
          )}
          {unread && (
            <button
              className="btn btn-ghost alert-read-btn-full"
              onClick={handleReadClick}
            >
              <CheckCheck size={14} />
              Marcar como lido
            </button>
          )}
          {!unread && (
            <span className="alert-lido-tag">
              <CheckCheck size={13} /> Lido
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filter, setFilter] = useState('all'); // 'all' | 'unread'

  async function loadAlerts() {
    setLoading(true);
    setError('');
    try {
      const params = filter === 'unread' ? { apenas_nao_lidos: 'true' } : {};
      const [alertsRes, summaryRes] = await Promise.allSettled([
        getAlerts({ ...params, limit: 50 }),
        getAlertsSummary(),
      ]);
      if (alertsRes.status === 'fulfilled') setAlerts(alertsRes.value.data);
      if (summaryRes.status === 'fulfilled') setSummary(summaryRes.value.data);
    } catch {
      setError('Erro ao carregar alertas.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAlerts(); }, [filter]);

  async function handleCheck() {
    setChecking(true);
    setError('');
    setSuccess('');
    try {
      const res = await checkAlerts();
      const data = res.data;
      const count = data.alertas_gerados ?? data.novos ?? 0;
      setSuccess(`Verificação concluída. ${count} novo(s) alerta(s) gerado(s).`);
      await loadAlerts();
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao verificar alertas.');
    } finally {
      setChecking(false);
    }
  }

  async function handleMarkRead(id) {
    try {
      await markAlertRead(id);
      setAlerts(prev =>
        prev.map(a => (a.ID ?? a.id) === id ? { ...a, LIDO: 1, lido: 1 } : a)
      );
      if (summary) {
        setSummary(s => ({
          ...s,
          TOTAL_NAO_LIDOS: Math.max(0, (s.TOTAL_NAO_LIDOS ?? s.total_nao_lidos ?? 1) - 1),
          total_nao_lidos: Math.max(0, (s.total_nao_lidos ?? s.TOTAL_NAO_LIDOS ?? 1) - 1),
        }));
      }
    } catch {
      setError('Erro ao marcar alerta como lido.');
    }
  }

  async function handleMarkAll() {
    try {
      await markAllAlertsRead();
      setAlerts(prev => prev.map(a => ({ ...a, LIDO: 1, lido: 1 })));
      if (summary) setSummary(s => ({ ...s, TOTAL_NAO_LIDOS: 0, total_nao_lidos: 0 }));
      setSuccess('Todos os alertas marcados como lidos.');
      setTimeout(() => setSuccess(''), 3000);
    } catch {
      setError('Erro ao marcar alertas.');
    }
  }

  const sum = summary || {};
  const totalUnread  = sum.TOTAL_NAO_LIDOS    ?? sum.total_nao_lidos    ?? 0;
  const criticos     = sum.CRITICOS_NAO_LIDOS ?? sum.criticos_nao_lidos ?? 0;
  const alertasCount = sum.ALERTAS_NAO_LIDOS  ?? sum.alertas_nao_lidos  ?? 0;

  return (
    <div className="alerts-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Alertas</h2>
          <p className="page-sub">Monitoramento automático pelo Agente Monitor IA</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-ghost" onClick={loadAlerts} disabled={loading}>
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
          </button>
          {totalUnread > 0 && (
            <button className="btn btn-ghost" onClick={handleMarkAll}>
              <CheckCheck size={15} />
              Marcar todos
            </button>
          )}
          <button
            className="btn btn-primary"
            onClick={handleCheck}
            disabled={checking}
          >
            {checking ? <span className="spinner" /> : <Shield size={15} />}
            {checking ? 'Verificando…' : 'Verificar Alertas'}
          </button>
        </div>
      </div>

      {error   && <div className="error-msg"   style={{ marginBottom: 16 }}>{error}</div>}
      {success && <div className="success-msg" style={{ marginBottom: 16 }}>{success}</div>}

      {/* Summary cards */}
      <div className="alert-summary">
        <div className="summary-card card">
          <span className="summary-value" style={{ color: '#F1F5F9' }}>
            {sum.TOTAL ?? sum.total ?? 0}
          </span>
          <span className="summary-label">Total</span>
        </div>
        <div className="summary-card card">
          <span className="summary-value" style={{ color: '#EF4444' }}>{criticos}</span>
          <span className="summary-label">Críticos não lidos</span>
        </div>
        <div className="summary-card card">
          <span className="summary-value" style={{ color: '#F59E0B' }}>{alertasCount}</span>
          <span className="summary-label">Alertas não lidos</span>
        </div>
        <div className="summary-card card">
          <span className="summary-value" style={{ color: '#22C55E' }}>{totalUnread}</span>
          <span className="summary-label">Não lidos total</span>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="filter-tabs">
        <button
          className={`filter-tab${filter === 'all' ? ' filter-tab--active' : ''}`}
          onClick={() => setFilter('all')}
        >
          Todos
        </button>
        <button
          className={`filter-tab${filter === 'unread' ? ' filter-tab--active' : ''}`}
          onClick={() => setFilter('unread')}
        >
          Não lidos{totalUnread > 0 && <span className="unread-dot">{totalUnread}</span>}
        </button>
      </div>

      {/* Alert list */}
      {loading ? (
        <div className="loading-state">
          <span className="spinner" style={{ width: 24, height: 24 }} />
          <span>Carregando alertas…</span>
        </div>
      ) : alerts.length === 0 ? (
        <div className="empty-state card">
          <BellRing size={40} color="#64748B" />
          <h3>Nenhum alerta encontrado</h3>
          <p>
            {filter === 'unread'
              ? 'Todos os alertas já foram lidos.'
              : 'Clique em "Verificar Alertas" para que o Agente Monitor analise os dados.'}
          </p>
        </div>
      ) : (
        <div className="alert-list">
          {alerts.map(a => (
            <AlertItem key={a.ID ?? a.id} alert={a} onRead={handleMarkRead} />
          ))}
        </div>
      )}
    </div>
  );
}
