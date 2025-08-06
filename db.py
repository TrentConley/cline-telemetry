# db.py - Database connection helper for FastAPI
# Uses environment variables (PGHOST, PGUSER, PGPASSWORD, PGDATABASE, PGPORT)
# For local dev you can run `scripts/init_db.sh` to set up the database/table.

import os
import asyncpg

async def create_db_pool():
    """Create database connection pool"""
    database_url = f"postgresql://{os.getenv('PGUSER', 'postgres')}:{os.getenv('PGPASSWORD', '')}@{os.getenv('PGHOST', 'localhost')}:{os.getenv('PGPORT', '5432')}/{os.getenv('PGDATABASE', 'telemetry')}"
    return await asyncpg.create_pool(database_url)

async def ensure_events_table(pool):
    """Ensure events table exists (idempotent)"""
    async with pool.acquire() as connection:
        await connection.execute("""
            CREATE TABLE IF NOT EXISTS events (
                id SERIAL PRIMARY KEY,
                event_type TEXT,
                user_id TEXT,
                properties JSONB,
                captured_at TIMESTAMPTZ DEFAULT NOW()
            );
        """)