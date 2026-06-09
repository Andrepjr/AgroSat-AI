import { useState, useEffect } from 'react';
import { Stethoscope, Plus, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { getDiagnostics, generateDiagnostic } from '../services/api';
import './Diagnostics.css';

function StatusBadge({ status }) {
  const s = (status || '').toLowerCase();
  if (s.includes('ótim') || s.includes('excel') || s.includes('bom') || s.includes('normal'))
    return <span className="badge badge-green">{status}</span>;
  if (s.includes('alerta') || s.includes('atenção') || s.includes('médio') || s.includes('medio'))
    return <span className="badge badge-amber">{status}</span>;
  if (s.includes('crít') || s.includes('ruim') || s.includes('baixo') || s.includes('alto'))
    return <span className="badge badge-red">{status}</span>;
  return <span className="badge badge-blue">{status}</span>;
}

function DiagCard({ diag }) {
  const [expanded, setExpanded] = useState(false);
  const d = {
    id: diag.ID ?? diag.id,
    status: diag.STATUS_GERAL ?? diag.status_geral,
    solo: diag.ANALISE_SOLO ?? diag.analise_solo,
    clima: diag.ANALISE_CLIMA ?? diag.analise_clima,
    vegetacao: diag.ANALISE_VEGETACAO ?? diag.analise_vegetacao,
    recomendacoes: diag.RECOMENDACOES ?? diag.recomendacoes,
    created_at: diag.CREATED_AT ?? diag.created_at,
  };

  return (
    <div className="diag-card card">
      <div className="diag-card-header" onClick={() => setExpanded((v) => !v)}>
        <div className="diag-card-meta">
          <StatusBadge status={d.status} />
          <span className="diag-date">
            {d.created_at
              ? new Date(d.created_at).toLocaleString('pt-BR', {
                  day: '2-digit', month: '2-digit', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })
              : '—'}
          </span>
        </div>
        <button className="expand-btn">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {expanded && (
        <div className="diag-body">
          {d.solo && (
            <div className="diag-section">
              <h4 className="diag-section-title">Solo</h4>
              <p className="diag-text">{d.solo}</p>
            </div>
          )}
          {d.clima && (
            <div className="diag-section">
              <h4 className="diag-section-title">Clima</h4>
              <p className="diag-text">{d.clima}</p>
            </div>
          )}
          {d.vegetacao && (
            <div className="diag-section">
              <h4 className="diag-section-title">Vegetação</h4>
              <p className="diag-text">{d.vegetacao}</p>
            </div>
          )}
          {d.recomendacoes && (
            <div className="diag-section diag-section--rec">
              <h4 className="diag-section-title">Recomendações</h4>
              <p className="diag-text">{d.recomendacoes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Diagnostics() {
  const [diagnostics, setDiagnostics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function loadDiagnostics() {
    setLoading(true);
    setError('');
    try {
      const res = await getDiagnostics(20);
      setDiagnostics(res.data);
    } catch {
      setError('Erro ao carregar diagnósticos.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadDiagnostics(); }, []);

  async function handleGenerate() {
    setGenerating(true);
    setError('');
    setSuccess('');
    try {
      await generateDiagnostic();
      setSuccess('Diagnóstico gerado com sucesso!');
      await loadDiagnostics();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao gerar diagnóstico.');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="diagnostics-page">
      <div className="page-header">
        <div>
          <h2 className="page-title">Diagnósticos</h2>
          <p className="page-sub">Análises geradas pelo Agente Analista IA</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-ghost" onClick={loadDiagnostics} disabled={loading}>
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
          </button>
          <button
            className="btn btn-primary"
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating ? <span className="spinner" /> : <Plus size={15} />}
            {generating ? 'Gerando…' : 'Gerar Diagnóstico'}
          </button>
        </div>
      </div>

      {error && <div className="error-msg" style={{ marginBottom: 16 }}>{error}</div>}
      {success && <div className="success-msg" style={{ marginBottom: 16 }}>{success}</div>}

      {loading ? (
        <div className="loading-state">
          <span className="spinner" style={{ width: 24, height: 24 }} />
          <span>Carregando diagnósticos…</span>
        </div>
      ) : diagnostics.length === 0 ? (
        <div className="empty-state card">
          <Stethoscope size={40} color="#64748B" />
          <h3>Nenhum diagnóstico encontrado</h3>
          <p>Clique em "Gerar Diagnóstico" para que o Agente Analista analise os dados dos sensores.</p>
          <button
            className="btn btn-primary"
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating ? <span className="spinner" /> : <Plus size={15} />}
            {generating ? 'Gerando…' : 'Gerar Primeiro Diagnóstico'}
          </button>
        </div>
      ) : (
        <div className="diag-list">
          {diagnostics.map((d) => (
            <DiagCard key={d.ID ?? d.id} diag={d} />
          ))}
        </div>
      )}
    </div>
  );
}
