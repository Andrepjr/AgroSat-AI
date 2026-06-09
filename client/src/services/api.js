import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3001/api',
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('usuario');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth
export const login = (email, senha) =>
  api.post('/auth/login', { email, senha });

export const register = (nome, email, senha) =>
  api.post('/auth/register', { nome, email, senha });

// Sensors
export const getSensors = (params) =>
  api.get('/sensors', { params });

export const getSensorLatest = (setor) =>
  api.get('/sensors/latest', { params: setor ? { setor } : undefined });

export const getSensorStats = () =>
  api.get('/sensors/stats');

// Chat
export const sendMessage = (mensagem) =>
  api.post('/chat', { mensagem });

export const getChatHistory = (limit = 100) =>
  api.get('/chat/history', { params: { limit } });

export const clearChatHistory = () =>
  api.delete('/chat/history');

// Diagnostics
export const generateDiagnostic = () =>
  api.post('/diagnostics/generate');

export const getDiagnostics = (limit = 20) =>
  api.get('/diagnostics', { params: { limit } });

export const getLatestDiagnostic = () =>
  api.get('/diagnostics/latest');

// Alerts
export const getAlerts = (params) =>
  api.get('/alerts', { params });

export const checkAlerts = () =>
  api.get('/alerts/check');

export const markAlertRead = (id) =>
  api.patch(`/alerts/${id}/read`);

export const markAllAlertsRead = () =>
  api.patch('/alerts/read-all');

export const getAlertsSummary = () =>
  api.get('/alerts/summary');

export default api;
