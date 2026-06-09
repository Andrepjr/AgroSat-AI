import OpenAI from 'openai';
import { query } from '../database/connection.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function buildSystemPrompt(diagnostico) {
  let base = `Você é o Consultor Agrícola AgroSat — um assistente especializado em agricultura de precisão.
Responda em português brasileiro de forma clara, prática e empática.
Foque em soluções acionáveis para o agricultor.
Seja conciso mas completo. Use linguagem acessível, evitando jargões técnicos excessivos.`;

  if (diagnostico) {
    base += `

--- CONTEXTO ATUAL DA FAZENDA (diagnóstico mais recente) ---
Status geral: ${diagnostico.STATUS_GERAL}
Solo: ${diagnostico.ANALISE_SOLO}
Clima: ${diagnostico.ANALISE_CLIMA}
Vegetação: ${diagnostico.ANALISE_VEGETACAO}
Recomendações em aberto: ${diagnostico.RECOMENDACOES}
Data do diagnóstico: ${diagnostico.CREATED_AT}
--------------------------------------------------------------

Use este contexto para personalizar suas respostas quando relevante.`;
  }

  return base;
}

export async function executarConsultor(usuarioId, mensagem) {
  // Busca o último diagnóstico para contexto
  const diagResult = await query(
    `SELECT * FROM diagnosticos
     WHERE usuario_id = :usuario_id
     ORDER BY created_at DESC
     FETCH FIRST 1 ROW ONLY`,
    { usuario_id: usuarioId }
  );
  // Extrai apenas primitivos do row Oracle para evitar referências circulares (LOBs)
  const raw = diagResult.rows[0];
  const diagnostico = raw ? {
    STATUS_GERAL:      String(raw.STATUS_GERAL      || ''),
    ANALISE_SOLO:      String(raw.ANALISE_SOLO      || ''),
    ANALISE_CLIMA:     String(raw.ANALISE_CLIMA     || ''),
    ANALISE_VEGETACAO: String(raw.ANALISE_VEGETACAO || ''),
    RECOMENDACOES:     String(raw.RECOMENDACOES     || ''),
    CREATED_AT:        raw.CREATED_AT,
  } : null;

  // Busca histórico recente da conversa (últimas 20 mensagens)
  const historicoResult = await query(
    `SELECT role, content FROM (
       SELECT role, content, created_at FROM conversas
       WHERE usuario_id = :usuario_id
       ORDER BY created_at DESC
       FETCH FIRST 20 ROWS ONLY
     ) ORDER BY created_at ASC`,
    { usuario_id: usuarioId }
  );

  const historico = historicoResult.rows.map(r => ({
    role: String(r.ROLE || ''),
    content: String(r.CONTENT || ''),
  }));

  // Monta array de mensagens para o GPT
  const messages = [
    { role: 'system', content: buildSystemPrompt(diagnostico) },
    ...historico,
    { role: 'user', content: mensagem },
  ];

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    temperature: 0.7,
    max_tokens: 1024,
    messages,
  });

  const resposta = response.choices[0].message.content;

  // Salva mensagem do usuário e resposta do assistente no Oracle
  await query(
    `INSERT INTO conversas (usuario_id, role, content) VALUES (:usuario_id, 'user', :content)`,
    { usuario_id: usuarioId, content: mensagem }
  );
  await query(
    `INSERT INTO conversas (usuario_id, role, content) VALUES (:usuario_id, 'assistant', :content)`,
    { usuario_id: usuarioId, content: resposta }
  );

  return {
    resposta,
    tem_diagnostico_contexto: diagnostico !== null,
    tokens_usados: response.usage?.total_tokens,
  };
}
