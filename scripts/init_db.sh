#!/usr/bin/env bash
# Initialize PostgreSQL database and schema for Cline Telemetry
# Usage: PGUSER, PGPASSWORD, PGHOST, PGPORT env vars should be set (or rely on psql defaults)
# Example (macOS):
#   createdb telemetry
#   ./scripts/init_db.sh
set -euo pipefail

DB_NAME=${PGDATABASE:-telemetry}

# Create DB if it doesn't exist
if ! psql -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
  createdb "$DB_NAME"
  echo "Database $DB_NAME created."
fi

# Run migrations
psql "$DB_NAME" <<'SQL'
CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  event_type TEXT,
  user_id TEXT,
  properties JSONB,
  captured_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_captured_at ON events (captured_at);
SQL

echo "✅ Database schema ensured."