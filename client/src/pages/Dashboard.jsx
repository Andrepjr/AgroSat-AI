import { useState, useEffect, useCallback } from 'react';
import {
  Thermometer,
  Droplets,
  Wind,
  Leaf,
  CloudRain,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
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

function StatCard({ icon: Icon, label, value, unit, color, sub }) {
  return (
    <div className="stat-card card">
      <div className="stat-icon" style={{ background: `${color}18`, color }}>
        <Icon size={20} />
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
        {sub && <span className="stat-sub">{sub}</span>}
      </div>
    </div>
  );
}

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

      if (latestRes.status === 'fulfilled') {
        setLatest(latestRes.value.data);
      }
      if (histRes.status === 'fulfilled') {
        const rows = histRes.value.data;
        const chart = [...rows]
          .reverse()
          .map((r) => ({
            time: formatTime(r.TIMESTAMP_LEITURA || r.timestamp_leitura),
            temperatura: r.TEMPERATURA ?? r.temperatura,
            umidade_solo: r.UMIDADE_SOLO ?? r.umidade_solo,
            umidade_ar: r.UMIDADE_AR ?? r.umidade_ar,
            ndvi: r.NDVI ?? r.ndvi,
          }));
        setHistory(chart);
      }
      if (statsRes.status === 'fulfilled') {
        setStats(statsRes.value.data);
      }
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

  const l = latest || {};
  const temp = l.TEMPERATURA ?? l.temperatura;
  const umidSolo = l.UMIDADE_SOLO ?? l.umidade_solo;
  const umidAr = l.UMIDADE_AR ?? l.umidade_ar;
  const ndvi = l.NDVI ?? l.ndvi;
  const precip = l.PRECIPITACAO ?? l.precipitacao;
  const setor = l.SETOR ?? l.setor;

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
          {lastUpdate && (
            <span className="update-time">
              Atualizado às {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
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
          {/* Sensor badge */}
          {setor && (
            <div style={{ marginBottom: 16 }}>
              <span className="badge badge-green">Setor {setor} · Online</span>
            </div>
          )}

          {/* Stat cards */}
          <div className="stat-grid">
            <StatCard
              icon={Thermometer}
              label="Temperatura"
              value={temp}
              unit="°C"
              color="#EF4444"
              sub={temp > 35 ? 'Acima do ideal' : temp < 10 ? 'Abaixo do ideal' : 'Faixa normal'}
            />
            <StatCard
              icon={Droplets}
              label="Umidade do Solo"
              value={umidSolo}
              unit="%"
              color="#3B82F6"
              sub={umidSolo < 30 ? 'Irrigação recomendada' : 'Adequada'}
            />
            <StatCard
              icon={Wind}
              label="Umidade do Ar"
              value={umidAr}
              unit="%"
              color="#8B5CF6"
            />
            <StatCard
              icon={Leaf}
              label="NDVI"
              value={ndvi}
              unit=""
              color="#22C55E"
              sub={ndvi >= 0.6 ? 'Vegetação saudável' : ndvi >= 0.3 ? 'Vegetação moderada' : 'Vegetação fraca'}
            />
            <StatCard
              icon={CloudRain}
              label="Precipitação"
              value={precip}
              unit="mm"
              color="#0EA5E9"
            />
          </div>

          {/* Chart */}
          {history.length > 0 && (
            <div className="card chart-card">
              <div className="chart-header">
                <div className="chart-title">
                  <TrendingUp size={16} color="#22C55E" />
                  <span>Histórico de Leituras</span>
                </div>
                <span className="badge badge-green">{history.length} leituras</span>
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={history} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gTemp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gSolo" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gAr" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#273449" />
                  <XAxis dataKey="time" tick={{ fill: '#64748B', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#64748B', fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: 12, color: '#94A3B8' }}
                    formatter={(v) => v.replace('_', ' ')}
                  />
                  <Area
                    type="monotone"
                    dataKey="temperatura"
                    stroke="#EF4444"
                    fill="url(#gTemp)"
                    strokeWidth={2}
                    dot={false}
                    name="Temperatura"
                  />
                  <Area
                    type="monotone"
                    dataKey="umidade_solo"
                    stroke="#3B82F6"
                    fill="url(#gSolo)"
                    strokeWidth={2}
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

          {/* Stats table */}
          {stats.length > 0 && (
            <div className="card" style={{ marginTop: 20 }}>
              <div className="chart-header" style={{ marginBottom: 16 }}>
                <div className="chart-title">
                  <AlertTriangle size={16} color="#F59E0B" />
                  <span>Estatísticas por Setor (24h)</span>
                </div>
              </div>
              <div className="stats-table-wrap">
                <table className="stats-table">
                  <thead>
                    <tr>
                      <th>Setor</th>
                      <th>Temp. Média</th>
                      <th>Temp. Min/Max</th>
                      <th>Umid. Solo</th>
                      <th>NDVI Médio</th>
                      <th>Precipitação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.map((s) => (
                      <tr key={s.SETOR ?? s.setor}>
                        <td><span className="badge badge-blue">{s.SETOR ?? s.setor}</span></td>
                        <td>{(s.TEMP_MEDIA ?? s.temp_media)?.toFixed(1)}°C</td>
                        <td>
                          {(s.TEMP_MIN ?? s.temp_min)?.toFixed(1)} /
                          {(s.TEMP_MAX ?? s.temp_max)?.toFixed(1)}°C
                        </td>
                        <td>{(s.UMIDADE_SOLO_MEDIA ?? s.umidade_solo_media)?.toFixed(1)}%</td>
                        <td>{(s.NDVI_MEDIO ?? s.ndvi_medio)?.toFixed(3)}</td>
                        <td>{(s.PRECIPITACAO_TOTAL ?? s.precipitacao_total)?.toFixed(1)}mm</td>
                      </tr>
                    ))}
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
