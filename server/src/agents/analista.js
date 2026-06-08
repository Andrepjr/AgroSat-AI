import OpenAI from 'openai';
import oracledb from 'oracledb';
import { query } from '../database/connection.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `Você é um agrônomo especialista em agricultura de precisão e monitoramento satelital.
Analise os dados dos sensores IoT fornecidos e retorne SOMENTE um JSON válido (sem markdown, sem texto extra) com esta estrutura exata:

{
  "status_geral": "NORMAL" | "ALERTA" | "CRITICO",
  "analise_solo": "análise detalhada das condições do solo",
  "analise_clima": "análise detalhada das condições climáticas",
  "analise_vegetacao": "análise detalhada da vegetação com base no NDVI",
  "recomendacoes": "lista de recomendações práticas separadas por ponto-e-vírgula"
}

Critérios de status:
- NORMAL: todos os parâmetros dentro dos limites ideais
- ALERTA: 1-2 parâmetros fora do ideal, requer atenção
- CRITICO: parâmetros em níveis que podem causar perda de safra imediata

Referências agronômicas:
- Temperatura ideal: 18-32°C | ALERTA: >35°C | CRITICO: >38°C ou <5°C
- Umidade solo ideal: 40-70% | ALERTA: 20-40% | CRITICO: <20% ou >85%
- Umidade ar ideal: 50-80% | ALERTA: <30% ou >90%
- NDVI ideal: >0.5 | ALERTA: 0.3-0.5 | CRITICO: <0.3
- Precipitação: considere excesso >50mm/24h como risco de alagamento`;

export async function executarAnalista(usuarioId) {
  // Busca as últimas 10 leituras de cada setor para análise
  const leituras = await query(`
    SELECT * FROM (
      SELECT * FROM leituras_sensores
      ORDER BY timestamp_leitura DESC
    ) WHERE ROWNUM <= 20
  `);

  if (leituras.rows.length === 0) {
    throw new Error('Nenhuma leitura de sensor disponível para análise');
  }

  // Calcula médias para enviar ao GPT
  const dados = leituras.rows;
  const media = campo => {
    const vals = dados.map(r => r[campo]).filter(v => v != null);
    return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : null;
  };

  const resumo = {
    periodo: {
      inicio: dados[dados.length - 1]?.TIMESTAMP_LEITURA,
      fim: dados[0]?.TIMESTAMP_LEITURA,
      total_leituras: dados.length,
    },
    temperatura: {
      media: media('TEMPERATURA'),
      max: Math.max(...dados.map(r => r.TEMPERATURA).filter(Boolean)),
      min: Math.min(...dados.map(r => r.TEMPERATURA).filter(Boolean)),
    },
    umidade_solo: {
      media: media('UMIDADE_SOLO'),
      min: Math.min(...dados.map(r => r.UMIDADE_SOLO).filter(Boolean)),
    },
    umidade_ar: { media: media('UMIDADE_AR') },
    ndvi: {
      media: media('NDVI'),
      min: Math.min(...dados.map(r => r.NDVI).filter(Boolean)),
    },
    precipitacao_total_mm: dados.reduce((acc, r) => acc + (r.PRECIPITACAO || 0), 0).toFixed(2),
    setores: [...new Set(dados.map(r => r.SETOR))],
    ultima_leitura: dados[0],
  };

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    temperature: 0.3,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Analise estes dados do sistema AgroSat:\n\n${JSON.stringify(resumo, null, 2)}`,
      },
    ],
  });

  let analise;
  try {
    analise = JSON.parse(response.choices[0].message.content);
  } catch {
    throw new Error('GPT retornou JSON inválido: ' + response.choices[0].message.content);
  }

  // Valida campos obrigatórios
  const campos = ['status_geral', 'analise_solo', 'analise_clima', 'analise_vegetacao', 'recomendacoes'];
  for (const campo of campos) {
    if (!analise[campo]) throw new Error(`Campo ausente no JSON do GPT: ${campo}`);
  }

  if (!['NORMAL', 'ALERTA', 'CRITICO'].includes(analise.status_geral)) {
    throw new Error(`status_geral inválido: ${analise.status_geral}`);
  }

  // Salva diagnóstico no Oracle
  const insert = await query(
    `INSERT INTO diagnosticos
       (usuario_id, status_geral, analise_solo, analise_clima, analise_vegetacao, recomendacoes)
     VALUES (:usuario_id, :status_geral, :analise_solo, :analise_clima, :analise_vegetacao, :recomendacoes)
     RETURNING id INTO :id`,
    {
      usuario_id: usuarioId,
      status_geral: analise.status_geral,
      analise_solo: analise.analise_solo,
      analise_clima: analise.analise_clima,
      analise_vegetacao: analise.analise_vegetacao,
      recomendacoes: analise.recomendacoes,
      id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
    }
  );

  return {
    id: insert.outBinds.id[0],
    ...analise,
    dados_analisados: resumo,
    tokens_usados: response.usage?.total_tokens,
  };
}
