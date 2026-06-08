import { Router } from 'express';
import { query } from '../database/connection.js';
import { authMiddleware } from '../middleware/auth.js';
import { executarConsultor } from '../agents/consultor.js';

const router = Router();
router.use(authMiddleware);

// POST /api/chat — envia mensagem ao Agente Consultor
router.post('/', async (req, res) => {
  const { mensagem } = req.body;

  if (!mensagem || mensagem.trim().length === 0) {
    return res.status(400).json({ error: 'mensagem não pode ser vazia' });
  }

  if (mensagem.length > 2000) {
    return res.status(400).json({ error: 'mensagem muito longa (máx 2000 caracteres)' });
  }

  try {
    const resultado = await executarConsultor(req.user.id, mensagem.trim());
    res.json(resultado);
  } catch (err) {
    console.error('Erro no Agente Consultor:', err);
    res.status(500).json({ error: 'Falha ao processar mensagem', detalhes: err.message });
  }
});

// GET /api/chat/history — histórico de conversa do usuário
router.get('/history', async (req, res) => {
  const { limit = 50 } = req.query;
  try {
    const result = await query(
      `SELECT id, role, content, created_at
       FROM conversas
       WHERE usuario_id = :usuario_id
       ORDER BY created_at ASC
       FETCH FIRST :limit ROWS ONLY`,
      { usuario_id: req.user.id, limit: Number(limit) }
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Erro ao buscar histórico:', err);
    res.status(500).json({ error: 'Erro ao buscar histórico do chat' });
  }
});

// DELETE /api/chat/history — limpa histórico da conversa
router.delete('/history', async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM conversas WHERE usuario_id = :usuario_id',
      { usuario_id: req.user.id }
    );
    res.json({ message: 'Histórico removido', removidos: result.rowsAffected });
  } catch (err) {
    console.error('Erro ao limpar histórico:', err);
    res.status(500).json({ error: 'Erro ao limpar histórico' });
  }
});

export default router;
