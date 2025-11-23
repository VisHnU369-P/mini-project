// lib/db.js
const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is required in env');
}

// Configure pool with SSL for Railway/cloud databases
const pool = new Pool({
  connectionString,
  ssl: process.env.DATABASE_URL?.includes('railway') || process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false
});

// Initialize database - create table if it doesn't exist
async function initializeDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS links (
        code VARCHAR(8) PRIMARY KEY,
        target TEXT NOT NULL,
        clicks INTEGER NOT NULL DEFAULT 0,
        last_clicked TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    console.log('Database initialized: links table ready');
  } catch (err) {
    console.error('Failed to initialize database:', err);
    throw err;
  }
}

// Test connection and initialize on startup
pool.on('connect', () => {
  console.log('Database connection established');
});

pool.on('error', (err) => {
  console.error('Unexpected database error:', err);
});

module.exports = { pool, initializeDatabase };
