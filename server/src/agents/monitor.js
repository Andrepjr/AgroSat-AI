import OpenAI from 'openai';
import { query } from '../database/connection.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Definição dos thresholds de alerta
const THRESHOLDS = [
  {
    campo: 'TEMPERATURA',
    label: 'temperatura',
    unidade: '°C',
    checks: [
      { condicao: v => v > 38, severidade: 'CRITICO', descricao: 'acima de 38°C' },
      { condicao: v => v > 35, severidade: 'ALERTA', descricao: 'acima de 35°C' },
      { condicao: v => v < 5, severidade: 'CRITICO', descricao: 'abaixo de 5°C' },
    ],
  },
  {
    campo: 'UMIDADE_SOLO',
    label: 'umidade do solo',
    unidade: '%',
    checks: [
      { condicao: v => v < 20, severidade: 'CRITICO', descricao: 'abaixo de 20%' },
      { condicao: v => v < 30, severidade: 'ALERTA', descricao: 'abaixo de 30%' },
      { condicao: v => v > 85, severidade: 'ALERTA', descricao: 'acima de 85% (risco encharcamento)' },
    ],
  },
  {
    campo: 'NDVI',
    label: 'índice de vegetação (NDVI)',
    unidade: '',
    checks: [
      { condicao: v => v < 0.3, severidade: 'CRITICO', descricao: 'abaixo de 0.30' },
      { condicao: v => v < 0.5, severidade: 'ALERTA', descricao: 'abaixo de 0.50' },
    ],
  },
  {
    campo: 'UMIDADE_AR',
    label: 'umidade do ar',
    unidade: '%',
    checks: [
      { condicao: v => v < 25, severidade: 'CRITICO', descricao: 'abaixo de 25% (risco de incêndio)' },
      { condicao: v => v > 92, severidade: 'ALERTA', descricao: 'acima de 92% (risco de fungos)' },
    ],
  },
  {
    campo: 'PRECIPITACAO',
    label: 'precipitação',
    unidade: 'mm',
    checks: [
      { condicao: v => v > 50, severidade: 'ALERTA', descricao: 'acima de 50mm (risco de alagamento)' },
    ],
  },
];

async function gerarTextoAlerta(campo, valor, severidade, descricao, setor) {
  const prompt = `Você é um sistema de alertas agrícolas. Gere um alerta ${severidade} conciso em português.
Retorne SOMENTE um JSON: {"titulo": "...", "descricao": "..."}
O título deve ter no máximo 80 caracteres. A descrição deve ser de 1-2 frases explicando o risco e a ação imediata necessária.

Dados do alerta:
- Campo: ${campo}
- Valor atual: ${valor}${descricao.includes('%') || descricao.includes('mm') ? '' : ''}
- Threshold violado: ${descricao}
- Setor: ${setor}
- Severidade: ${severidade}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    temperature: 0.4,
    max_tokens: 200,
    messages: [{ role: 'user', content: prompt }],
  });

  try {
    let content = response.choices[0].message.content;
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(content);
  } catch {
    // Fallback se o JSON vier mal formatado
    return {
      titulo: `${severidade}: ${campo} ${descricao} no setor ${setor}`,
      descricao: `O valor atual de ${campo} é ${valor} — ${descricao}. Verifique imediatamente.`,
    };
  }
}

export async function executarMonitor() {
  // Busca a leitura mais recente de cada setor
  const leituras = await query(`
    SELECT ls.*
    FROM leituras_sensores ls
    INNER JOIN (
      SELECT setor, MAX(timestamp_leitura) AS max_ts
      FROM leituras_sensores
      GROUP BY setor
    ) ultimas ON ls.setor = ultimas.setor AND ls.timestamp_leitura = ultimas.max_ts
    ORDER BY ls.setor
  `);

  if (leituras.rows.length === 0) {
    return { alertas_gerados: 0, message: 'Nenhuma leitura disponível para monitorar' };
  }

  const alertasGerados = [];

  for (const leitura of leituras.rows) {
    for (const threshold of THRESHOLDS) {
      const valor = leitura[threshold.campo];
      if (valor == null) continue;

      for (const check of threshold.checks) {
        if (!check.condicao(valor)) continue;

        // Evita duplicar alerta nas últimas 2 horas para o mesmo campo/setor/severidade
        const duplicado = await query(
          `SELECT id FROM alertas
           WHERE setor = :setor
             AND severidade = :severidade
             AND titulo LIKE :pattern
             AND created_at >= SYSTIMESTAMP - INTERVAL '2' HOUR
             AND ROWNUM = 1`,
          {
            setor: leitura.SETOR,
            severidade: check.severidade,
            pattern: `%${threshold.label}%`,
          }
        );

        if (duplicado.rows.length > 0) break; // já existe alerta recente

        const texto = await gerarTextoAlerta(
          threshold.label,
          valor,
          check.severidade,
          check.descricao,
          leitura.SETOR
        );

        await query(
          `INSERT INTO alertas (severidade, titulo, descricao, setor)
           VALUES (:severidade, :titulo, :descricao, :setor)`,
          {
            severidade: check.severidade,
            titulo: texto.titulo.substring(0, 300),
            descricao: texto.descricao,
            setor: leitura.SETOR,
          }
        );

        alertasGerados.push({
          setor: leitura.SETOR,
          campo: threshold.label,
          valor,
          severidade: check.severidade,
          titulo: texto.titulo,
        });

        break; // um alerta por campo por vez (pega o mais grave)
      }
    }
  }

  return {
    alertas_gerados: alertasGerados.length,
    detalhes: alertasGerados,
    setores_verificados: leituras.rows.map(r => r.SETOR),
  };
}
