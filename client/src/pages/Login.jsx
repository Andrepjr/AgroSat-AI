import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Leaf, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { login as apiLogin, register as apiRegister } from '../services/api';
import './Login.css';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState('login'); // 'login' | 'register'
  const [showPass, setShowPass] = useState(false);

  const [form, setForm] = useState({ nome: '', email: '', senha: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function handleChange(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      let data;
      if (tab === 'login') {
        const res = await apiLogin(form.email, form.senha);
        data = res.data;
      } else {
        if (!form.nome.trim()) {
          setError('Nome é obrigatório.');
          return;
        }
        const res = await apiRegister(form.nome, form.email, form.senha);
        data = res.data;
      }
      login(data.token, data.usuario);
      navigate('/dashboard');
    } catch (err) {
      setError(
        err.response?.data?.error ||
          'Erro ao conectar ao servidor. Verifique se o backend está rodando.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-bg">
      <video
        className="login-bg-img"
        src="/bg-login-video.mp4"
        autoPlay
        muted
        loop
        playsInline
      />
      <div className="login-overlay" />
      <div className="login-card">
        {/* Logo */}
        <div className="login-logo">
          <div className="login-logo-icon">
            <Leaf size={40} color="#22C55E" />
          </div>
          <h1 className="login-title">AgroSat AI</h1>
          <p className="login-subtitle">
            Monitoramento inteligente com IA + dados satelitais
          </p>
        </div>

        {/* Tabs */}
        <div className="login-tabs">
          <button
            className={`login-tab${tab === 'login' ? ' login-tab--active' : ''}`}
            onClick={() => { setTab('login'); setError(''); }}
          >
            Entrar
          </button>
          <button
            className={`login-tab${tab === 'register' ? ' login-tab--active' : ''}`}
            onClick={() => { setTab('register'); setError(''); }}
          >
            Criar conta
          </button>
        </div>

        {/* Form */}
        <form className="login-form" onSubmit={handleSubmit}>
          {tab === 'register' && (
            <div className="field">
              <label className="field-label">Nome completo</label>
              <input
                className="field-input"
                type="text"
                name="nome"
                placeholder="João Silva"
                value={form.nome}
                onChange={handleChange}
                required={tab === 'register'}
                autoComplete="name"
              />
            </div>
          )}

          <div className="field">
            <label className="field-label">E-mail</label>
            <input
              className="field-input"
              type="email"
              name="email"
              placeholder="seu@email.com"
              value={form.email}
              onChange={handleChange}
              required
              autoComplete="email"
            />
          </div>

          <div className="field">
            <label className="field-label">Senha</label>
            <div className="field-pass">
              <input
                className="field-input"
                type={showPass ? 'text' : 'password'}
                name="senha"
                placeholder="••••••••"
                value={form.senha}
                onChange={handleChange}
                required
                minLength={6}
                autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
              />
              <button
                type="button"
                className="pass-toggle"
                onClick={() => setShowPass((v) => !v)}
                tabIndex={-1}
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && <div className="error-msg">{error}</div>}

          <button
            type="submit"
            className="btn btn-primary login-submit"
            disabled={loading}
          >
            {loading && <span className="spinner" />}
            {loading
              ? tab === 'login' ? 'Entrando...' : 'Criando conta...'
              : tab === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>

        <p className="login-hint">
          {tab === 'login' ? (
            <>Não tem conta?{' '}
              <button className="link-btn" onClick={() => { setTab('register'); setError(''); }}>
                Criar conta
              </button>
            </>
          ) : (
            <>Já tem conta?{' '}
              <button className="link-btn" onClick={() => { setTab('login'); setError(''); }}>
                Entrar
              </button>
            </>
          )}
        </p>
      </div>

    </div>
  );
}
