# main.py - FastAPI telemetry server
from fastapi import FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, JSONResponse
import uvicorn
import os
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Any, Optional
import asyncpg
import asyncio
from contextlib import asynccontextmanager
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Database configuration
DATABASE_URL = f"postgresql://{os.getenv('PGUSER', 'postgres')}:{os.getenv('PGPASSWORD', '')}@{os.getenv('PGHOST', 'localhost')}:{os.getenv('PGPORT', '5432')}/{os.getenv('PGDATABASE', 'telemetry')}"

# Global database pool
db_pool = None

async def ensure_schema():
    """Ensure events table exists on startup (idempotent)"""
    try:
        async with db_pool.acquire() as connection:
            await connection.execute("""
                CREATE TABLE IF NOT EXISTS events (
                    id SERIAL PRIMARY KEY,
                    event_type TEXT,
                    user_id TEXT,
                    properties JSONB,
                    captured_at TIMESTAMPTZ DEFAULT NOW()
                );
            """)
        print("✅ Database schema ensured")
    except Exception as err:
        print(f"❌ Failed to ensure DB schema: {err}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    global db_pool
    try:
        db_pool = await asyncpg.create_pool(DATABASE_URL)
        await ensure_schema()
        print("✅ Database pool created")
    except Exception as e:
        print(f"❌ Failed to create database pool: {e}")
        db_pool = None
    
    # Ensure logs directory exists
    logs_dir = Path("logs")
    logs_dir.mkdir(exist_ok=True)
    
    yield
    
    # Shutdown
    if db_pool:
        await db_pool.close()
        print("✅ Database pool closed")

app = FastAPI(
    title="Cline Telemetry Server",
    description="Minimal telemetry server for Cline",
    version="1.0.0",
    lifespan=lifespan
)

# Serve React build (if present) – production mode
prod_dir = Path("frontend/dist")
if prod_dir.exists():
    app.mount("/", StaticFiles(directory=str(prod_dir), html=True), name="static")

# Helper function to append events
async def append_event(event: Dict[str, Any]):
    """Log event to file and database"""
    # Legacy file logging (optional)
    today = datetime.now().date().isoformat()
    log_file = Path("logs") / f"telemetry-{today}.jsonl"
    
    try:
        with open(log_file, "a") as f:
            f.write(json.dumps(event) + "\n")
    except Exception as e:
        print(f"⚠️ File logging error: {e}")
    
    # Also write to Postgres (non-blocking)
    if db_pool:
        try:
            async with db_pool.acquire() as connection:
                await connection.execute(
                    "INSERT INTO events(event_type, user_id, properties, captured_at) VALUES ($1, $2, $3, $4)",
                    event.get("event"),
                    event.get("user_id"),
                    json.dumps(event.get("properties")) if event.get("properties") else None,
                    datetime.fromisoformat(event["timestamp"].replace("Z", "+00:00")) if event.get("timestamp") else datetime.now(timezone.utc)
                )
        except Exception as e:
            print(f"❌ DB insert error: {e}")

# Capture endpoints (single + batch)
@app.post("/capture/")
async def capture_event(request: Request):
    """Capture a single telemetry event"""
    try:
        body = await request.json()
        event = {"timestamp": datetime.now(timezone.utc).isoformat(), **body}
        print(f"📊 Telemetry Event: {json.dumps(event, indent=2)}")
        await append_event(event)
        return {"status": 1}
    except Exception as err:
        print(f"❌ Error processing telemetry: {err}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/batch/")
async def capture_batch(request: Request):
    """Capture a batch of telemetry events"""
    try:
        body = await request.json()
        batch = body.get("batch", [])
        
        for ev in batch:
            event = {"timestamp": datetime.now(timezone.utc).isoformat(), **ev}
            print(f"📊 Telemetry Event: {json.dumps(event, indent=2)}")
            await append_event(event)
        
        return {"status": 1}
    except Exception as err:
        print(f"❌ Error processing batch: {err}")
        raise HTTPException(status_code=500, detail="Internal server error")

# Health endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}

# Stats endpoint (aggregated counts)
@app.get("/stats")
async def get_stats():
    """Get aggregated statistics for the last 30 days"""
    try:
        if not db_pool:
            return {"totals": {}, "accepted": {}, "rejected": {}}
        
        async with db_pool.acquire() as connection:
            rows = await connection.fetch(
                "SELECT event_type, properties FROM events WHERE captured_at >= NOW() - INTERVAL '30 days'"
            )
        
        totals = {}
        accepted = {"option_selected": 0, "thumbs_up": 0}
        rejected = {"options_ignored": 0, "thumbs_down": 0}
        
        for row in rows:
            event_type = row["event_type"]
            totals[event_type] = totals.get(event_type, 0) + 1
            
            if event_type == "task.option_selected":
                accepted["option_selected"] += 1
            elif event_type == "task.options_ignored":
                rejected["options_ignored"] += 1
            elif event_type == "task.feedback":
                properties = json.loads(row["properties"]) if row["properties"] else {}
                fb = properties.get("feedbackType") or properties.get("feedback_type")
                if fb == "thumbs_up":
                    accepted["thumbs_up"] += 1
                elif fb == "thumbs_down":
                    rejected["thumbs_down"] += 1
        
        return {"totals": totals, "accepted": accepted, "rejected": rejected}
    except Exception as err:
        print(f"❌ Stats error: {err}")
        raise HTTPException(status_code=500, detail="Stats failed")

# Recent events API (last 20 of today)
@app.get("/api/events")
async def get_recent_events():
    """Get recent events from today (last 20)"""
    try:
        if not db_pool:
            return []
        
        async with db_pool.acquire() as connection:
            rows = await connection.fetch(
                "SELECT * FROM events WHERE captured_at::date = CURRENT_DATE ORDER BY id DESC LIMIT 20"
            )
        
        events = []
        for row in rows:
            events.append({
                "id": row["id"],
                "event": row["event_type"],
                "user_id": row["user_id"],
                "properties": json.loads(row["properties"]) if row["properties"] else None,
                "timestamp": row["captured_at"].isoformat(),
                "event_type": row["event_type"],
                "captured_at": row["captured_at"].isoformat()
            })
        
        return events
    except Exception as err:
        print(f"❌ Error reading events: {err}")
        return []

# Legacy dashboard (only used when React build not found)
@app.get("/", response_class=HTMLResponse)
async def dashboard():
    """Legacy dashboard when React build is not available"""
    if prod_dir.exists():
        # This should be handled by static files, but just in case
        raise HTTPException(status_code=404, detail="Not found")
    
    html_content = f"""
<!DOCTYPE html>
<html>
<head>
  <title>Cline Telemetry Dashboard</title>
  <meta charset="utf-8">
  <style>
    body {{ font-family: Arial, sans-serif; margin: 20px; }}
    .header {{ background:#f5f5f5; padding:20px; border-radius:5px; margin-bottom:20px; }}
    .event  {{ background:#f9f9f9; padding:10px; margin:10px 0; border-left:4px solid #007cba; }}
    .timestamp {{ color:#666; font-size:0.9em; }}
    .event-type{{ font-weight:bold; color:#007cba; }}
    pre {{ background:#f0f0f0; padding:10px; overflow-x:auto; }}

    table {{ border-collapse:collapse; margin-top:20px; }}
    th,td {{ border:1px solid #ddd; padding:8px; text-align:center; }}
    th {{ background:#007cba; color:#fff; }}
  </style>
</head>
<body>
  <div class="header">
    <h1>🔍 Cline Telemetry Dashboard</h1>
    <p>Endpoint: <code>http://localhost:8000/capture/</code></p>
  </div>

  <h2>Recent Events</h2>
  <div id="events">Loading...</div>

  <h2>Metrics (Accepted vs Rejected)</h2>
  <div id="metrics">Loading...</div>

  <script>
    // recent events
    function loadEvents() {{
      fetch('/api/events')
        .then(r=>r.json())
        .then(events=>{{
          const div=document.getElementById('events')
          if(events.length===0){{ div.innerHTML='<p>No events yet.</p>'; return }}
          div.innerHTML = events.map(ev => `
             <div class="event">
               <div class="timestamp">${{ev.timestamp}}</div>
               <div class="event-type">${{ev.event}}</div>
               <pre>${{JSON.stringify(ev,null,2)}}</pre>
             </div>`).join('')
        }})
        .catch(()=>{{document.getElementById('events').innerHTML='<p>Error loading events</p>'}})
    }}

    // metrics
    function loadStats() {{
      fetch('/stats')
        .then(r=>r.json())
        .then(s=>{{
          const m=document.getElementById('metrics')
          const acc=s.accepted||{{}}
          const rej=s.rejected||{{}}
          const tot=s.totals || {{}}

          m.innerHTML = `
            <table>
              <thead><tr><th>Metric</th><th>Accepted</th><th>Rejected</th></tr></thead>
              <tbody>
                <tr><td>Options</td><td>${{acc.option_selected}}</td><td>${{rej.options_ignored}}</td></tr>
                <tr><td>Thumbs</td><td>${{acc.thumbs_up}}</td><td>${{rej.thumbs_down}}</td></tr>
              </tbody>
            </table>
            <h4>Event Totals</h4>
            <pre>${{JSON.stringify(tot,null,2)}}</pre>
          `
        }})
        .catch(()=>{{document.getElementById('metrics').innerHTML='<p>Error loading metrics</p>'}})
    }}

    loadEvents()
    loadStats()
    setInterval(loadEvents, 5000)
    setInterval(loadStats, 10000)
  </script>
</body>
</html>
    """
    return HTMLResponse(content=html_content)

if __name__ == "__main__":
    print("🚀 Cline Telemetry Server running at http://localhost:8000")
    print("📊 Dashboard: http://localhost:8000")
    print("🔗 Capture endpoint: http://localhost:8000/capture/")
    print("📁 Logs saved to: logs/")
    uvicorn.run(app, host="0.0.0.0", port=8000)