import { Router } from 'express';
import oracledb from 'oracledb';
import { query } from '../database/connection.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// GET /api/sensors — últimas 50 leituras
router.get('/', async (req, res) => {
  const { setor, limit = 50 } = req.query;
  try {
    let sql = `SELECT * FROM (
      SELECT * FROM leituras_sensores
      ${setor ? 'WHERE setor = :setor' : ''}
      ORDER BY timestamp_leitura DESC
    ) WHERE ROWNUM <= :limit`;

    const binds = setor ? { setor, limit: Number(limit) } : { limit: Number(limit) };
    const result = await query(sql, binds);
    res.json(result.rows);
  } catch (err) {
    console.error('Erro ao buscar sensores:', err);
    res.status(500).json({ error: 'Erro ao buscar leituras' });
  }
});

// GET /api/sensors/latest — leitura mais recente
router.get('/latest', async (req, res) => {
  const { setor } = req.query;
  try {
    const sql = setor
      ? `SELECT * FROM leituras_sensores WHERE setor = :setor ORDER BY timestamp_leitura DESC FETCH FIRST 1 ROW ONLY`
      : `SELECT * FROM leituras_sensores ORDER BY timestamp_leitura DESC FETCH FIRST 1 ROW ONLY`;

    const result = await query(sql, setor ? { setor } : []);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Nenhuma leitura encontrada' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao buscar última leitura:', err);
    res.status(500).json({ error: 'Erro ao buscar leitura' });
  }
});

// GET /api/sensors/stats — estatísticas das últimas 24h
router.get('/stats', async (req, res) => {
  try {
    const result = await query(`
      SELECT
        setor,
        COUNT(*) AS total_leituras,
        ROUND(AVG(temperatura), 2) AS temp_media,
        ROUND(MIN(temperatura), 2) AS temp_min,
        ROUND(MAX(temperatura), 2) AS temp_max,
        ROUND(AVG(umidade_solo), 2) AS umidade_solo_media,
        ROUND(AVG(umidade_ar), 2) AS umidade_ar_media,
        ROUND(AVG(ndvi), 4) AS ndvi_medio,
        ROUND(SUM(precipitacao), 2) AS precipitacao_total
      FROM leituras_sensores
      WHERE timestamp_leitura >= SYSTIMESTAMP - INTERVAL '24' HOUR
      GROUP BY setor
      ORDER BY setor
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Erro ao buscar stats:', err);
    res.status(500).json({ error: 'Erro ao buscar estatísticas' });
  }
});

// POST /api/sensors — inserir leitura manualmente
router.post('/', async (req, res) => {
  const { temperatura, umidade_solo, umidade_ar, ndvi, precipitacao, setor = 'A1' } = req.body;

  if (temperatura == null || umidade_solo == null) {
    return res.status(400).json({ error: 'temperatura e umidade_solo são obrigatórios' });
  }

  try {
    const result = await query(
      `INSERT INTO leituras_sensores (temperatura, umidade_solo, umidade_ar, ndvi, precipitacao, setor)
       VALUES (:temperatura, :umidade_solo, :umidade_ar, :ndvi, :precipitacao, :setor)
       RETURNING id INTO :id`,
      {
        temperatura,
        umidade_solo,
        umidade_ar: umidade_ar ?? null,
        ndvi: ndvi ?? null,
        precipitacao: precipitacao ?? 0,
        setor,
        id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      }
    );

    res.status(201).json({ id: result.outBinds.id[0], message: 'Leitura registrada' });
  } catch (err) {
    console.error('Erro ao inserir leitura:', err);
    res.status(500).json({ error: 'Erro ao salvar leitura' });
  }
});

export default router;
