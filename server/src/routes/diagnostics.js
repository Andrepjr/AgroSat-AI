import { Router } from 'express';
import { query } from '../database/connection.js';
import { authMiddleware } from '../middleware/auth.js';
import { executarAnalista } from '../agents/analista.js';

const router = Router();
router.use(authMiddleware);

// POST /api/diagnostics/generate — aciona o Agente Analista
router.post('/generate', async (req, res) => {
  try {
    const resultado = await executarAnalista(req.user.id);
    res.status(201).json(resultado);
  } catch (err) {
    console.error('Erro no Agente Analista:', err);
    if (err.message.includes('Nenhuma leitura')) {
      return res.status(422).json({ error: err.message });
    }
    res.status(500).json({ error: 'Falha ao gerar diagnóstico', detalhes: err.message });
  }
});

// GET /api/diagnostics — lista diagnósticos do usuário autenticado
router.get('/', async (req, res) => {
  const { limit = 20 } = req.query;
  try {
    const result = await query(
      `SELECT * FROM (
         SELECT id, status_geral, analise_solo, analise_clima, analise_vegetacao,
                recomendacoes, created_at
         FROM diagnosticos
         WHERE usuario_id = :usuario_id
         ORDER BY created_at DESC
       ) WHERE ROWNUM <= :limit`,
      { usuario_id: req.user.id, limit: Number(limit) }
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Erro ao listar diagnósticos:', err);
    res.status(500).json({ error: 'Erro ao buscar diagnósticos' });
  }
});

// GET /api/diagnostics/latest — diagnóstico mais recente
router.get('/latest', async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM diagnosticos
       WHERE usuario_id = :usuario_id
       ORDER BY created_at DESC
       FETCH FIRST 1 ROW ONLY`,
      { usuario_id: req.user.id }
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Nenhum diagnóstico encontrado' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao buscar último diagnóstico:', err);
    res.status(500).json({ error: 'Erro ao buscar diagnóstico' });
  }
});

// GET /api/diagnostics/:id — diagnóstico específico
router.get('/:id', async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM diagnosticos
       WHERE id = :id AND usuario_id = :usuario_id`,
      { id: Number(req.params.id), usuario_id: req.user.id }
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Diagnóstico não encontrado' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao buscar diagnóstico:', err);
    res.status(500).json({ error: 'Erro ao buscar diagnóstico' });
  }
});

export default router;
