import { initPool, query, closePool } from '../database/connection.js';
import dotenv from 'dotenv';

dotenv.config();

const isCritical = process.argv.includes('--critical');
const INTERVAL_MS = 30_000;

// Estado atual dos sensores — variação gradual por setor
const estado = {
  A1: { temperatura: 26, umidade_solo: 55, umidade_ar: 65, ndvi: 0.72, precipitacao: 0 },
  A2: { temperatura: 28, umidade_solo: 48, umidade_ar: 60, ndvi: 0.65, precipitacao: 0 },
  B1: { temperatura: 25, umidade_solo: 62, umidade_ar: 70, ndvi: 0.80, precipitacao: 0 },
};

// Modos críticos forçados para demonstração
const CENARIO_CRITICO = {
  A1: { temperatura: 41.5, umidade_solo: 12, umidade_ar: 22, ndvi: 0.18, precipitacao: 0 },
  A2: { temperatura: 39.0, umidade_solo: 17, umidade_ar: 28, ndvi: 0.25, precipitacao: 0 },
  B1: { temperatura: 38.5, umidade_solo: 19, umidade_ar: 55, ndvi: 0.28, precipitacao: 55 },
};

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function varia(valor, magnitude, min, max, decimais = 2) {
  const delta = (Math.random() - 0.5) * 2 * magnitude;
  return parseFloat(clamp(valor + delta, min, max).toFixed(decimais));
}

function proximaLeitura(setor) {
  if (isCritical) {
    // No modo crítico, os valores se aproximam gradualmente dos valores extremos
    const alvo = CENARIO_CRITICO[setor];
    const atual = estado[setor];
    for (const campo of Object.keys(alvo)) {
      const diff = alvo[campo] - atual[campo];
      atual[campo] = parseFloat((atual[campo] + diff * 0.3).toFixed(4));
    }
    return { ...estado[setor] };
  }

  const s = estado[setor];

  // Variação natural gradual
  s.temperatura = varia(s.temperatura, 0.8, 10, 40);
  s.umidade_solo = varia(s.umidade_solo, 1.5, 15, 90);
  s.umidade_ar = varia(s.umidade_ar, 2.0, 20, 95);
  s.ndvi = varia(s.ndvi, 0.02, 0.1, 0.95, 4);
  // Chuva: 80% do tempo sem chuva, 20% com chuva leve
  s.precipitacao = Math.random() < 0.8 ? 0 : parseFloat((Math.random() * 15).toFixed(2));

  return { ...s };
}

async function inserirLeituras() {
  const timestamp = new Date().toISOString();
  const setores = Object.keys(estado);
  let inseridos = 0;

  for (const setor of setores) {
    const dados = proximaLeitura(setor);

    await query(
      `INSERT INTO leituras_sensores
         (temperatura, umidade_solo, umidade_ar, ndvi, precipitacao, setor)
       VALUES
         (:temperatura, :umidade_solo, :umidade_ar, :ndvi, :precipitacao, :setor)`,
      { ...dados, setor }
    );

    inseridos++;
    console.log(
      `[${timestamp}] ${setor} | ` +
      `Temp: ${dados.temperatura}°C | ` +
      `Solo: ${dados.umidade_solo}% | ` +
      `Ar: ${dados.umidade_ar}% | ` +
      `NDVI: ${dados.ndvi} | ` +
      `Chuva: ${dados.precipitacao}mm` +
      (isCritical ? ' ⚠️  CRÍTICO' : '')
    );
  }

  return inseridos;
}

async function main() {
  console.log(`\n🌱 AgroSat IoT Simulator iniciado`);
  console.log(`   Modo: ${isCritical ? '🔴 CENÁRIO CRÍTICO' : '🟢 Normal'}`);
  console.log(`   Intervalo: ${INTERVAL_MS / 1000}s`);
  console.log(`   Setores: ${Object.keys(estado).join(', ')}`);
  console.log(`   Para encerrar: Ctrl+C\n`);

  await initPool();

  // Primeira leitura imediata
  await inserirLeituras();

  const intervalo = setInterval(async () => {
    try {
      await inserirLeituras();
    } catch (err) {
      console.error('Erro ao inserir leitura:', err.message);
    }
  }, INTERVAL_MS);

  process.on('SIGINT', async () => {
    console.log('\n\nSimulador encerrado.');
    clearInterval(intervalo);
    await closePool();
    process.exit(0);
  });
}

main().catch(err => {
  console.error('Falha ao iniciar simulador:', err);
  process.exit(1);
});
