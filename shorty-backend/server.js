// server.js
const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const { pool, initializeDatabase } = require('./lib/db');
const { customAlphabet } = require('nanoid');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 4000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const codeRegex = /^[A-Za-z0-9]{6,8}$/;
const gen = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', 6);
const cors = require('cors');

// Configure CORS with environment variable support
const allowedOrigins = process.env.CORS_ORIGINS 
  ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim())
  : [
      'http://localhost:5173',
      'https://mini-project-production-d8d2.up.railway.app'
    ];

// Normalize origins (remove trailing slashes)
const normalizedOrigins = allowedOrigins.map(origin => origin.replace(/\/$/, ''));

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      if (process.env.NODE_ENV !== 'production') console.log('CORS: Allowing request with no origin');
      return callback(null, true);
    }
    
    // Normalize origin (remove trailing slash)
    const normalizedOrigin = origin.replace(/\/$/, '');
    
    if (normalizedOrigins.indexOf(normalizedOrigin) !== -1) {
      if (process.env.NODE_ENV !== 'production') console.log('CORS: Allowing origin:', normalizedOrigin);
      callback(null, true);
    } else {
      // In development, allow localhost origins
      if (process.env.NODE_ENV !== 'production' && normalizedOrigin.includes('localhost')) {
        console.log('CORS: Allowing localhost origin in development:', normalizedOrigin);
        callback(null, true);
      } else {
        console.warn('CORS: Blocked origin:', normalizedOrigin);
        console.warn('CORS: Allowed origins:', normalizedOrigins);
        callback(new Error(`Origin ${normalizedOrigin} not allowed by CORS`));
      }
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS', 'PUT', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Length', 'Content-Type'],
  preflightContinue: false,
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));

// Configure Helmet to not interfere with CORS
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false
}));
app.use(morgan('dev'));
app.use(express.json());

// Health check
app.get('/healthz', async (req, res) => {
  try {
    // Test database connection
    await pool.query('SELECT 1');
    
    // Check if table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'links'
      )
    `);
    
    const tableExists = tableCheck.rows[0].exists;
    
    res.json({ 
      ok: true, 
      version: '1.0', 
      database: 'connected',
      table_exists: tableExists,
      env: {
        has_database_url: !!process.env.DATABASE_URL,
        node_env: process.env.NODE_ENV
      }
    });
  } catch (err) {
    console.error('Health check failed:', err);
    res.status(503).json({ 
      ok: false, 
      version: '1.0', 
      database: 'disconnected', 
      error: err.message,
      code: err.code,
      env: {
        has_database_url: !!process.env.DATABASE_URL,
        node_env: process.env.NODE_ENV
      }
    });
  }
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
    console.error('Error in POST /api/links:', err.message);
    console.error('Full error:', err);
    const errorMessage = process.env.NODE_ENV === 'production' 
      ? 'server-error' 
      : err.message || 'server-error';
    return res.status(500).json({ error: errorMessage, details: process.env.NODE_ENV !== 'production' ? err.stack : undefined });
  }
});

// GET /api/links - list all
app.get('/api/links', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT code, target, clicks, last_clicked, created_at FROM links ORDER BY created_at DESC');
    res.json({ links: rows });
  } catch (err) {
    console.error('Error in GET /api/links:', err.message);
    console.error('Full error:', err);
    console.error('Error code:', err.code);
    console.error('Error detail:', err.detail);
    
    // Check if it's a database connection error
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.message?.includes('connect')) {
      return res.status(503).json({ 
        error: 'database-connection-error',
        message: 'Unable to connect to database. Please check DATABASE_URL configuration.'
      });
    }
    
    // Check if table doesn't exist
    if (err.code === '42P01' || err.message?.includes('does not exist')) {
      console.error('Table does not exist, attempting to create...');
      try {
        await initializeDatabase();
        // Retry the query
        const { rows } = await pool.query('SELECT code, target, clicks, last_clicked, created_at FROM links ORDER BY created_at DESC');
        return res.json({ links: rows });
      } catch (initErr) {
        console.error('Failed to initialize table:', initErr);
        return res.status(500).json({ 
          error: 'database-init-error',
          message: 'Failed to initialize database table'
        });
      }
    }
    
    // Return error type and message for better debugging
    res.status(500).json({ 
      error: err.code || 'server-error',
      message: err.message || 'An unexpected error occurred'
    });
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

// Initialize database and start server
async function startServer() {
  try {
    // Initialize database tables
    await initializeDatabase();
    
    // Start server
    app.listen(PORT, () => {
      console.log(`Shorty backend listening on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
