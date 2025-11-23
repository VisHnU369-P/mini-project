// server.js
const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const { pool } = require('./lib/db');
const { customAlphabet } = require('nanoid');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 4000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const codeRegex = /^[A-Za-z0-9]{6,8}$/;
const gen = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', 6);
const cors = require('cors');

app.use(cors({ origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173' }));


app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());

// Health
app.get('/healthz', (req, res) => {
  res.json({ ok: true, version: '1.0' });
});

// Helper DB queries
const selectOne = async (code) => {
  const q = 'SELECT code, target, clicks, last_clicked, created_at FROM links WHERE code = $1';
  const r = await pool.query(q, [code]);
  return r.rows[0];
};

// POST /api/links - create link (409 if exists)
app.post('/api/links', async (req, res) => {
  try {
    const { target, code } = req.body || {};
    if (!target || typeof target !== 'string') return res.status(400).json({ error: 'invalid-target' });
    // Validate URL
    try {
      const url = new URL(target);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error();
    } catch (e) {
      return res.status(400).json({ error: 'invalid-target' });
    }

    let finalCode = code && String(code).trim();
    if (finalCode) {
      if (!codeRegex.test(finalCode)) return res.status(400).json({ error: 'invalid-code' });
      const exists = await pool.query('SELECT 1 FROM links WHERE code=$1', [finalCode]);
      if (exists.rowCount) return res.status(409).json({ error: 'code-exists' });
    } else {
      // generate unique
      let attempts = 0;
      do {
        finalCode = gen();
        const r = await pool.query('SELECT 1 FROM links WHERE code=$1', [finalCode]);
        if (!r.rowCount) break;
        attempts++;
      } while (attempts < 5);
    }

    const created_at = new Date().toISOString();
    await pool.query(
      'INSERT INTO links(code, target, clicks, last_clicked, created_at) VALUES($1,$2,0,NULL,$3)',
      [finalCode, target, created_at]
    );
    return res.status(201).json({ code: finalCode, target, clicks: 0, last_clicked: null, created_at });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server-error' });
  }
});

// GET /api/links - list all
app.get('/api/links', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT code, target, clicks, last_clicked, created_at FROM links ORDER BY created_at DESC');
    res.json({ links: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server-error' });
  }
});

// GET /api/links/:code - stats for one code
app.get('/api/links/:code', async (req, res) => {
  try {
    const row = await selectOne(req.params.code);
    if (!row) return res.status(404).json({ error: 'not-found' });
    res.json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server-error' });
  }
});

// DELETE /api/links/:code
app.delete('/api/links/:code', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM links WHERE code=$1', [req.params.code]);
    if (!rowCount) return res.status(404).json({ error: 'not-found' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server-error' });
  }
});

// Redirect route - GET /:code (must be last so it doesn't collide with /api & /healthz)
app.get('/:code', async (req, res) => {
  try {
    const code = req.params.code;
    // skip api paths and healthz
    if (code === 'api' || code === 'healthz' || code === 'code') return res.status(404).send('Not found');

    const q = await pool.query('SELECT target FROM links WHERE code=$1', [code]);
    if (!q.rowCount) return res.status(404).send('Not found');

    const target = q.rows[0].target;
    try {
      await pool.query('UPDATE links SET clicks = clicks + 1, last_clicked = now() WHERE code=$1', [code]);
    } catch (e) {
      console.error('Failed to increment clicks', e);
    }
    return res.redirect(302, target);
  } catch (err) {
    console.error(err);
    return res.status(500).send('server error');
  }
});

// Fallback
app.use((req, res) => {
  res.status(404).json({ error: 'not-found' });
});

app.listen(PORT, () => {
  console.log(`Shorty backend listening on port ${PORT}`);
});
