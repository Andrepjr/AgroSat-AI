import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import oracledb from 'oracledb';
import { query } from '../database/connection.js';

const router = Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { nome, email, senha } = req.body;

  if (!nome || !email || !senha) {
    return res.status(400).json({ error: 'nome, email e senha são obrigatórios' });
  }

  try {
    const existe = await query(
      'SELECT id FROM usuarios WHERE email = :email',
      { email }
    );
    if (existe.rows.length > 0) {
      return res.status(409).json({ error: 'E-mail já cadastrado' });
    }

    const senha_hash = await bcrypt.hash(senha, 12);

    const result = await query(
      `INSERT INTO usuarios (nome, email, senha_hash)
       VALUES (:nome, :email, :senha_hash)
       RETURNING id INTO :id`,
      { nome, email, senha_hash, id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER } }
    );

    const id = result.outBinds.id[0];
    const token = jwt.sign({ id, email, nome }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({ token, usuario: { id, nome, email } });
  } catch (err) {
    console.error('Erro no registro:', err);
    res.status(500).json({ error: 'Erro interno ao registrar usuário' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, senha } = req.body;

  if (!email || !senha) {
    return res.status(400).json({ error: 'email e senha são obrigatórios' });
  }

  try {
    const result = await query(
      'SELECT id, nome, email, senha_hash FROM usuarios WHERE email = :email',
      { email }
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const usuario = result.rows[0];
    const senhaValida = await bcrypt.compare(senha, usuario.SENHA_HASH);

    if (!senhaValida) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const token = jwt.sign(
      { id: usuario.ID, email: usuario.EMAIL, nome: usuario.NOME },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      usuario: { id: usuario.ID, nome: usuario.NOME, email: usuario.EMAIL },
    });
  } catch (err) {
    console.error('Erro no login:', err);
    res.status(500).json({ error: 'Erro interno ao fazer login' });
  }
});

export default router;
