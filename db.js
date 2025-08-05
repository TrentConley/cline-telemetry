// db.js - simple Postgres connection helper
// Uses environment variables (PGHOST, PGUSER, PGPASSWORD, PGDATABASE, PGPORT)
// For local dev you can run `scripts/init_db.sh` to set up the database/table.
const { Pool } = require('pg')

const pool = new Pool({
  database: process.env.PGDATABASE || 'telemetry'
})

// Ensure events table exists on startup (idempotent)
async function ensureSchema() {
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS events (
      id SERIAL PRIMARY KEY,
      event_type TEXT,
      user_id TEXT,
      properties JSONB,
      captured_at TIMESTAMPTZ DEFAULT NOW()
    );`)
  } catch (err) {
    console.error('Failed to ensure DB schema', err)
  }
}

ensureSchema()

module.exports = { pool }
