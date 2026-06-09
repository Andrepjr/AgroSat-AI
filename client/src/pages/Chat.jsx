import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Bot, User, Trash2, Leaf } from 'lucide-react';
import { sendMessage, getChatHistory, clearChatHistory } from '../services/api';
import './Chat.css';

function formatDate(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [histLoading, setHistLoading] = useState(true);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  useEffect(() => {
    async function loadHistory() {
      setHistLoading(true);
      try {
        const res = await getChatHistory(100);
        const rows = res.data;
        const msgs = rows.map((r) => ({
          id: r.ID ?? r.id,
          role: (r.ROLE ?? r.role),
          content: r.CONTENT ?? r.content,
          ts: r.CREATED_AT ?? r.created_at,
        }));
        setMessages(msgs);
      } catch {
        // No history is fine
      } finally {
        setHistLoading(false);
      }
    }
    loadHistory();
  }, []);

  async function handleSend(e) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    setInput('');
    setError('');

    const userMsg = { id: Date.now(), role: 'user', content: text, ts: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await sendMessage(text);
      const data = res.data;
      const assistantContent = data.resposta || data.content || JSON.stringify(data);
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, role: 'assistant', content: assistantContent, ts: new Date().toISOString() },
      ]);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao enviar mensagem.');
      setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  async function handleClear() {
    if (!window.confirm('Limpar todo o histórico de conversa?')) return;
    try {
      await clearChatHistory();
      setMessages([]);
    } catch {
      setError('Erro ao limpar histórico.');
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const suggestions = [
    'Como está a saúde do solo hoje?',
    'Quais culturas recomendar para essa temperatura?',
    'Analise o NDVI das últimas leituras.',
    'Quando devo irrigar?',
  ];

  return (
    <div className="chat-page">
      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-info">
          <div className="chat-avatar-lg">
            <Bot size={20} color="#22C55E" />
          </div>
          <div>
            <h2 className="page-title">Consultor IA</h2>
            <p className="page-sub">Agente especializado em agronomia e monitoramento</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button className="btn btn-ghost" onClick={handleClear}>
            <Trash2 size={14} />
            Limpar
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {histLoading ? (
          <div className="chat-loading">
            <span className="spinner" />
            <span>Carregando histórico…</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="chat-empty">
            <div className="chat-empty-icon">
              <Leaf size={32} color="#22C55E" />
            </div>
            <h3>Olá! Sou o Consultor AgroSat</h3>
            <p>Pergunte sobre saúde do solo, clima, culturas, irrigação e muito mais.</p>
            <div className="suggestions">
              {suggestions.map((s) => (
                <button
                  key={s}
                  className="suggestion-chip"
                  onClick={() => { setInput(s); inputRef.current?.focus(); }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`message message--${msg.role}`}>
              <div className="message-avatar">
                {msg.role === 'assistant' ? (
                  <Bot size={15} color="#22C55E" />
                ) : (
                  <User size={15} color="#94A3B8" />
                )}
              </div>
              <div className="message-body">
                <div className="message-bubble">
                  {msg.content}
                </div>
                {msg.ts && (
                  <span className="message-time">{formatDate(msg.ts)}</span>
                )}
              </div>
            </div>
          ))
        )}

        {loading && (
          <div className="message message--assistant">
            <div className="message-avatar">
              <Bot size={15} color="#22C55E" />
            </div>
            <div className="message-body">
              <div className="message-bubble typing">
                <span /><span /><span />
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="error-msg" style={{ margin: '8px 0' }}>{error}</div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form className="chat-input-area" onSubmit={handleSend}>
        <textarea
          ref={inputRef}
          className="chat-input"
          placeholder="Pergunte sobre sua lavoura…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={loading}
        />
        <button
          type="submit"
          className="chat-send"
          disabled={loading || !input.trim()}
        >
          {loading ? <span className="spinner" /> : <Send size={16} />}
        </button>
      </form>
    </div>
  );
}
