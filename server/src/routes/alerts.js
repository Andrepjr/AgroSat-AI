import { Router } from 'express';
import { query } from '../database/connection.js';
import { authMiddleware } from '../middleware/auth.js';
import { executarMonitor } from '../agents/monitor.js';

const router = Router();
router.use(authMiddleware);

// GET /api/alerts/check — aciona o Agente Monitor
router.get('/check', async (req, res) => {
  try {
    const resultado = await executarMonitor();
    res.json(resultado);
  } catch (err) {
    console.error('Erro no Agente Monitor:', err);
    res.status(500).json({ error: 'Falha ao verificar alertas', detalhes: err.message });
  }
});

// GET /api/alerts — lista alertas com paginação
router.get('/', async (req, res) => {
  const { limit = 50, apenas_nao_lidos, setor } = req.query;
  try {
    const conditions = [];
    const binds = { limit: Number(limit) };

    if (apenas_nao_lidos === 'true') {
      conditions.push('lido = 0');
    }
    if (setor) {
      conditions.push('setor = :setor');
      binds.setor = setor;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await query(
      `SELECT * FROM (
         SELECT * FROM alertas ${where}
         ORDER BY created_at DESC
       ) WHERE ROWNUM <= :limit`,
      binds
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Erro ao listar alertas:', err);
    res.status(500).json({ error: 'Erro ao buscar alertas' });
  }
});

// GET /api/alerts/summary — contagem por severidade
router.get('/summary', async (req, res) => {
  try {
    const result = await query(`
      SELECT
        SUM(CASE WHEN lido = 0 AND severidade = 'CRITICO' THEN 1 ELSE 0 END) AS criticos_nao_lidos,
        SUM(CASE WHEN lido = 0 AND severidade = 'ALERTA'  THEN 1 ELSE 0 END) AS alertas_nao_lidos,
        SUM(CASE WHEN lido = 0 THEN 1 ELSE 0 END) AS total_nao_lidos,
        COUNT(*) AS total
      FROM alertas
    `);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao buscar resumo:', err);
    res.status(500).json({ error: 'Erro ao buscar resumo de alertas' });
  }
});

// PATCH /api/alerts/:id/read — marcar como lido
router.patch('/:id/read', async (req, res) => {
  try {
    const result = await query(
      'UPDATE alertas SET lido = 1 WHERE id = :id',
      { id: Number(req.params.id) }
    );
    if (result.rowsAffected === 0) {
      return res.status(404).json({ error: 'Alerta não encontrado' });
    }
    res.json({ message: 'Alerta marcado como lido' });
  } catch (err) {
    console.error('Erro ao marcar alerta:', err);
    res.status(500).json({ error: 'Erro ao atualizar alerta' });
  }
});

// PATCH /api/alerts/read-all — marcar todos como lidos
router.patch('/read-all', async (req, res) => {
  try {
    const result = await query('UPDATE alertas SET lido = 1 WHERE lido = 0');
    res.json({ message: 'Todos os alertas marcados como lidos', atualizados: result.rowsAffected });
  } catch (err) {
    console.error('Erro ao marcar alertas:', err);
    res.status(500).json({ error: 'Erro ao atualizar alertas' });
  }
});

export default router;
