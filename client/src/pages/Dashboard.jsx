import { useState, useEffect, useCallback } from 'react';
import {
  Thermometer,
  Droplets,
  Wind,
  Leaf,
  CloudRain,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Map,
  Activity,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { getSensors, getSensorLatest, getSensorStats } from '../services/api';
import { useAuth } from '../context/AuthContext';
import './Dashboard.css';

const POLL_INTERVAL = 30_000;

/* ─── Status helpers ─── */
function getKpiStatus(metric, value) {
  if (value == null) return null;
  switch (metric) {
    case 'temp':
      if (value > 35) return 'critico';
      if (value > 28) return 'alerta';
      return 'normal';
    case 'umid_solo':
      if (value < 20) return 'critico';
      if (value < 30) return 'alerta';
      return 'normal';
    case 'umid_ar':
      if (value < 30) return 'critico';
      if (value < 40) return 'alerta';
      return 'normal';
    case 'ndvi':
      if (value < 0.3) return 'critico';
      if (value < 0.6) return 'alerta';
      return 'normal';
    default:
      return 'normal';
  }
}

function sectorStatus(s) {
  const ndvi = s.NDVI_MEDIO ?? s.ndvi_medio ?? 0.5;
  const temp = s.TEMP_MEDIA ?? s.temp_media ?? 25;
  const umid = s.UMIDADE_SOLO_MEDIA ?? s.umidade_solo_media ?? 50;
  if (ndvi < 0.3 || temp > 38 || umid < 20) return 'critico';
  if (ndvi < 0.6 || temp > 32 || umid < 30) return 'alerta';
  return 'normal';
}

const STATUS_LABEL = { normal: 'Normal', alerta: 'Alerta', critico: 'Crítico' };
const STATUS_COLOR = { normal: '#22C55E', alerta: '#F59E0B', critico: '#EF4444' };
const STATUS_BG    = {
  normal:  'rgba(34,197,94,0.10)',
  alerta:  'rgba(245,158,11,0.10)',
  critico: 'rgba(239,68,68,0.10)',
};
const SECTOR_BORDER = {
  normal:  'rgba(34,197,94,0.45)',
  alerta:  'rgba(245,158,11,0.55)',
  critico: 'rgba(239,68,68,0.55)',
};
const BADGE_CLASS = { normal: 'badge-green', alerta: 'badge-amber', critico: 'badge-red' };

/* ─── StatCard ─── */
function StatCard({ icon: Icon, label, value, unit, iconColor, iconBg, status, delta, deltaUp, style }) {
  return (
    <div className="stat-card card fade-in-up" style={style}>
      {status && (
        <span className={`status-badge status-${status} stat-card-badge`}>
          <span className="status-badge-dot" />
          {STATUS_LABEL[status]}
        </span>
      )}
      <div className="stat-icon-circle" style={{ background: iconBg, color: iconColor }}>
        <Icon size={22} />
      </div>
      <div className="stat-body">
        <span className="stat-label">{label}</span>
        <div className="stat-value">
          {value !== undefined && value !== null ? (
            <>
              <strong>{typeof value === 'number' ? value.toFixed(1) : value}</strong>
              {unit && <span className="stat-unit">{unit}</span>}
            </>
          ) : (
            <span className="stat-placeholder">—</span>
          )}
        </div>
        {delta != null && (
          <div className={`stat-delta ${deltaUp ? 'delta-up' : 'delta-down'}`}>
            {deltaUp
              ? <TrendingUp size={12} />
              : <TrendingDown size={12} />}
            <span>
              {deltaUp ? '+' : ''}{delta} vs média 24h
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Sector Map ─── */
function SectorMap({ stats }) {
  if (!stats.length) return null;
  return (
    <div className="card sector-map-card">
      <div className="chart-header" style={{ marginBottom: 14 }}>
        <div className="chart-title">
          <Map size={15} color="#22C55E" />
          <span>Mapa da Propriedade</span>
        </div>
      </div>
      <div className="sector-grid">
        {stats.slice(0, 4).map((s) => {
          const name  = s.SETOR ?? s.setor ?? '—';
          const st    = sectorStatus(s);
          const ndvi  = (s.NDVI_MEDIO ?? s.ndvi_medio ?? 0).toFixed(3);
          const temp  = (s.TEMP_MEDIA ?? s.temp_media ?? 0).toFixed(1);
          const umid  = (s.UMIDADE_SOLO_MEDIA ?? s.umidade_solo_media ?? 0).toFixed(0);
          return (
            <div
              key={name}
              className="sector-cell"
              style={{
                borderColor: SECTOR_BORDER[st],
                background:  STATUS_BG[st],
              }}
            >
              <div className="sector-cell-header">
                <span className="sector-name">{name}</span>
                <span
                  className="sector-dot"
                  style={{ background: STATUS_COLOR[st] }}
                  title={STATUS_LABEL[st]}
                />
              </div>
              <div className="sector-stats">
                <span>NDVI <strong>{ndvi}</strong></span>
                <span>{temp}°C</span>
                <span>{umid}% solo</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="sector-legend">
        {Object.entries(STATUS_COLOR).map(([key, color]) => (
          <span key={key} className="legend-item">
            <span className="legend-dot" style={{ background: color }} />
            {STATUS_LABEL[key]}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ─── Tooltip ─── */
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <p className="tooltip-label">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: <strong>{p.value?.toFixed(1)}</strong>
        </p>
      ))}
    </div>
  );
};

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/* ─── Dashboard ─── */
export default function Dashboard() {
  const { usuario } = useAuth();
  const [latest, setLatest] = useState(null);
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdate, setLastUpdate] = useState(null);

  const fetchData = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);
    setError('');
    try {
      const [latestRes, histRes, statsRes] = await Promise.allSettled([
        getSensorLatest(),
        getSensors({ limit: 20 }),
        getSensorStats(),
      ]);

      if (latestRes.status === 'fulfilled') setLatest(latestRes.value.data);
      if (histRes.status === 'fulfilled') {
        const rows = histRes.value.data;
        setHistory(
          [...rows].reverse().map((r) => ({
            time:        formatTime(r.TIMESTAMP_LEITURA ?? r.timestamp_leitura),
            temperatura: r.TEMPERATURA  ?? r.temperatura,
            umidade_solo: r.UMIDADE_SOLO ?? r.umidade_solo,
            umidade_ar:  r.UMIDADE_AR   ?? r.umidade_ar,
            ndvi:        r.NDVI         ?? r.ndvi,
          }))
        );
      }
      if (statsRes.status === 'fulfilled') setStats(statsRes.value.data);
      setLastUpdate(new Date());
    } catch {
      setError('Erro ao carregar dados dos sensores.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(true);
    const timer = setInterval(() => fetchData(false), POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [fetchData]);

  const l        = latest || {};
  const temp     = l.TEMPERATURA  ?? l.temperatura;
  const umidSolo = l.UMIDADE_SOLO ?? l.umidade_solo;
  const umidAr   = l.UMIDADE_AR   ?? l.umidade_ar;
  const ndvi     = l.NDVI         ?? l.ndvi;
  const precip   = l.PRECIPITACAO ?? l.precipitacao;
  const setor    = l.SETOR        ?? l.setor;

  /* delta vs 24h avg para o setor atual */
  const curStat = stats.find(s => (s.SETOR ?? s.setor) === setor);
  function delta(val, avgKey, avgKey2) {
    if (val == null || !curStat) return null;
    const avg = curStat[avgKey] ?? curStat[avgKey2];
    if (avg == null) return null;
    return (val - avg).toFixed(1);
  }
  const tempDelta = delta(temp, 'TEMP_MEDIA', 'temp_media');
  const soloD     = delta(umidSolo, 'UMIDADE_SOLO_MEDIA', 'umidade_solo_media');

  return (
    <div className="dashboard">
      {/* Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Dashboard</h2>
          <p className="page-sub">
            Olá, <strong>{usuario?.nome?.split(' ')[0]}</strong>. Monitorando sua lavoura em tempo real.
          </p>
        </div>
        <div className="header-actions">
          {stats.length > 0 && (
            <div className="sensors-online">
              <span className="sensor-pulse" />
              <span>{stats.length} setores online</span>
            </div>
          )}
          {lastUpdate && (
            <span className="update-time">
              {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            className="btn btn-ghost"
            onClick={() => fetchData(true)}
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            Atualizar
          </button>
        </div>
      </div>

      {error && <div className="error-msg" style={{ marginBottom: 20 }}>{error}</div>}

      {loading && !latest ? (
        <div className="loading-state">
          <span className="spinner" style={{ width: 28, height: 28 }} />
          <span>Carregando dados dos sensores…</span>
        </div>
      ) : (
        <>
          {/* KPI Grid */}
          <div className="stat-grid">
            <StatCard
              icon={Thermometer}
              label="Temperatura"
              value={temp}
              unit="°C"
              iconColor="#EF4444"
              iconBg="rgba(239,68,68,0.18)"
              status={getKpiStatus('temp', temp)}
              delta={tempDelta}
              deltaUp={tempDelta > 0}
              style={{ animationDelay: '0ms' }}
            />
            <StatCard
              icon={Droplets}
              label="Umidade do Solo"
              value={umidSolo}
              unit="%"
              iconColor="#3B82F6"
              iconBg="rgba(59,130,246,0.18)"
              status={getKpiStatus('umid_solo', umidSolo)}
              delta={soloD}
              deltaUp={soloD > 0}
              style={{ animationDelay: '60ms' }}
            />
            <StatCard
              icon={Wind}
              label="Umidade do Ar"
              value={umidAr}
              unit="%"
              iconColor="#8B5CF6"
              iconBg="rgba(139,92,246,0.18)"
              status={getKpiStatus('umid_ar', umidAr)}
              style={{ animationDelay: '120ms' }}
            />
            <StatCard
              icon={Leaf}
              label="NDVI"
              value={ndvi}
              unit=""
              iconColor="#22C55E"
              iconBg="rgba(34,197,94,0.18)"
              status={getKpiStatus('ndvi', ndvi)}
              style={{ animationDelay: '180ms' }}
            />
            <StatCard
              icon={CloudRain}
              label="Precipitação"
              value={precip}
              unit="mm"
              iconColor="#06B6D4"
              iconBg="rgba(6,182,212,0.18)"
              status="normal"
              style={{ animationDelay: '240ms' }}
            />
          </div>

          {/* Chart + Sector Map */}
          <div className="chart-section">
            {history.length > 0 && (
              <div className="card chart-card">
                <div className="chart-header">
                  <div className="chart-title">
                    <Activity size={15} color="#22C55E" />
                    <span>Histórico de Leituras</span>
                  </div>
                  <span className="badge badge-green">{history.length} leituras</span>
                </div>
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={history} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gTemp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor="#F59E0B" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#F59E0B" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gSolo" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor="#22C55E" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#22C55E" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gAr" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor="#8B5CF6" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(148,163,184,0.08)"
                      vertical={false}
                    />
                    <XAxis dataKey="time" tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                      wrapperStyle={{ fontSize: 12, color: '#94A3B8', paddingTop: 8 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="temperatura"
                      stroke="#F59E0B"
                      fill="url(#gTemp)"
                      strokeWidth={2.5}
                      dot={false}
                      name="Temperatura"
                    />
                    <Area
                      type="monotone"
                      dataKey="umidade_solo"
                      stroke="#22C55E"
                      fill="url(#gSolo)"
                      strokeWidth={2.5}
                      dot={false}
                      name="Umid. Solo"
                    />
                    <Area
                      type="monotone"
                      dataKey="umidade_ar"
                      stroke="#8B5CF6"
                      fill="url(#gAr)"
                      strokeWidth={2}
                      dot={false}
                      name="Umid. Ar"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
            <SectorMap stats={stats} />
          </div>

          {/* Stats table */}
          {stats.length > 0 && (
            <div className="card stats-table-card">
              <div className="chart-header" style={{ marginBottom: 16 }}>
                <div className="chart-title">
                  <TrendingUp size={15} color="#F59E0B" />
                  <span>Estatísticas por Setor (24h)</span>
                </div>
              </div>
              <div className="stats-table-wrap">
                <table className="stats-table">
                  <thead>
                    <tr>
                      <th>Setor</th>
                      <th>Temp. Média</th>
                      <th>Min / Max</th>
                      <th>Umid. Solo</th>
                      <th>NDVI</th>
                      <th>Precipitação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.map((s) => {
                      const name = s.SETOR ?? s.setor;
                      const st   = sectorStatus(s);
                      return (
                        <tr key={name}>
                          <td>
                            <span className={`badge ${BADGE_CLASS[st]}`}>{name}</span>
                          </td>
                          <td>{(s.TEMP_MEDIA ?? s.temp_media)?.toFixed(1)}°C</td>
                          <td className="text-muted">
                            {(s.TEMP_MIN ?? s.temp_min)?.toFixed(1)} / {(s.TEMP_MAX ?? s.temp_max)?.toFixed(1)}°C
                          </td>
                          <td>{(s.UMIDADE_SOLO_MEDIA ?? s.umidade_solo_media)?.toFixed(1)}%</td>
                          <td>{(s.NDVI_MEDIO ?? s.ndvi_medio)?.toFixed(3)}</td>
                          <td>{(s.PRECIPITACAO_TOTAL ?? s.precipitacao_total)?.toFixed(1)} mm</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
