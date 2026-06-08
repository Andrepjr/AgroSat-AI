import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initPool, getConnection, closePool } from './connection.js';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));

async function runInitSQL() {
  await initPool();
  const conn = await getConnection();

  const sql = readFileSync(join(__dirname, 'init.sql'), 'utf8');
  // Divide por ponto-e-vírgula, remove vazios e comentários-bloco
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  for (const stmt of statements) {
    try {
      await conn.execute(stmt);
      console.log(`✅ OK: ${stmt.substring(0, 60)}...`);
    } catch (err) {
      // ORA-00955 = objeto já existe — ignorar em re-execuções
      if (err.errorNum === 955 || err.errorNum === 2260 || err.errorNum === 2270) {
        console.log(`⚠️  Já existe: ${stmt.substring(0, 60)}...`);
      } else {
        console.error(`❌ Erro: ${err.message}\n   SQL: ${stmt.substring(0, 80)}`);
      }
    }
  }

  await conn.close();
  await closePool();
  console.log('\n🌱 Banco de dados inicializado com sucesso!');
}

runInitSQL().catch(err => {
  console.error('Falha ao inicializar banco:', err);
  process.exit(1);
});
