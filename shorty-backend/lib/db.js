// lib/db.js
const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is required in env');
}

// Configure pool with SSL for Railway/cloud databases
// Railway and most cloud providers require SSL
const isProduction = process.env.NODE_ENV === 'production';
const isRailway = process.env.DATABASE_URL?.includes('railway') || 
                  process.env.DATABASE_URL?.includes('neon') ||
                  process.env.DATABASE_URL?.includes('supabase') ||
                  process.env.RAILWAY_ENVIRONMENT;

const pool = new Pool({
  connectionString,
  ssl: isProduction || isRailway
    ? { rejectUnauthorized: false }
    : false,
  // Add connection timeout
  connectionTimeoutMillis: 10000,
  // Keep connections alive
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000
});

// Initialize database - create table if it doesn't exist
async function initializeDatabase() {
  let retries = 3;
  while (retries > 0) {
    try {
      // Test connection first
      await pool.query('SELECT 1');
      
      // Create table if it doesn't exist
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
      return;
    } catch (err) {
      retries--;
      console.error(`Failed to initialize database (${3 - retries}/3):`, err.message);
      if (retries === 0) {
        console.error('Full error:', err);
        throw err;
      }
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
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
