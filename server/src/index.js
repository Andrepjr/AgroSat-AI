import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initPool, closePool } from './database/connection.js';

import authRoutes from './routes/auth.js';
import sensorsRoutes from './routes/sensors.js';
import diagnosticsRoutes from './routes/diagnostics.js';
import alertsRoutes from './routes/alerts.js';
import chatRoutes from './routes/chat.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares globais
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '1mb' }));

// Health check — sem autenticação
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    service: 'AgroSat AI API',
  });
});

// Rotas
app.use('/api/auth', authRoutes);
app.use('/api/sensors', sensorsRoutes);
app.use('/api/diagnostics', diagnosticsRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/chat', chatRoutes);

// 404
app.use((req, res) => {
  res.status(404).json({ error: `Rota não encontrada: ${req.method} ${req.path}` });
});

// Handler de erros global
app.use((err, req, res, next) => {
  console.error('Erro não tratado:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

// Inicialização
async function start() {
  try {
    await initPool();
    app.listen(PORT, () => {
      console.log(`\n🚀 AgroSat AI API rodando em http://localhost:${PORT}`);
      console.log(`   Ambiente: ${process.env.NODE_ENV || 'development'}`);
      console.log(`   Health: http://localhost:${PORT}/health\n`);
      console.log('   Endpoints disponíveis:');
      console.log(`   POST   /api/auth/register`);
      console.log(`   POST   /api/auth/login`);
      console.log(`   GET    /api/sensors`);
      console.log(`   GET    /api/sensors/latest`);
      console.log(`   POST   /api/diagnostics/generate  (Agente Analista)`);
      console.log(`   GET    /api/diagnostics`);
      console.log(`   GET    /api/alerts/check          (Agente Monitor)`);
      console.log(`   GET    /api/alerts`);
      console.log(`   POST   /api/chat                  (Agente Consultor)`);
      console.log(`   GET    /api/chat/history\n`);
    });
  } catch (err) {
    console.error('❌ Falha ao iniciar servidor:', err);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Encerrando servidor...');
  await closePool();
  process.exit(0);
});

start();
