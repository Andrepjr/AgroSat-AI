import oracledb from 'oracledb';
import dotenv from 'dotenv';

dotenv.config();

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
oracledb.autoCommit = true;

let pool;

export async function initPool() {
    pool = await oracledb.createPool({
    user: process.env.ORACLE_USER,
    password: process.env.ORACLE_PASSWORD,
    connectString: process.env.ORACLE_CONNECTION_STRING,
    configDir: process.env.TNS_ADMIN,
    walletLocation: process.env.TNS_ADMIN,
    walletPassword: process.env.WALLET_PASSWORD,
    poolMin: 2,
    poolMax: 10,
    poolIncrement: 1,
  });
  console.log('✅ Pool Oracle criado com sucesso');
}

export async function getConnection() {
  if (!pool) throw new Error('Pool Oracle não inicializado');
  return pool.getConnection();
}

export async function query(sql, binds = [], opts = {}) {
  const conn = await getConnection();
  try {
    const result = await conn.execute(sql, binds, opts);
    return result;
  } finally {
    await conn.close();
  }
}

export async function closePool() {
  if (pool) {
    await pool.close(10);
    console.log('Pool Oracle encerrado');
  }
}
