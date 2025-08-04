// server.js
const express = require('express')
const fs       = require('fs')
const path     = require('path')

const app  = express()
const PORT = 8000

// ────────────────────────────────────────────────────────────
// middleware
app.use(express.json())
app.use(express.static('public'))

// ensure logs dir exists
const logsDir = path.join(__dirname, 'logs')
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir)

// ────────────────────────────────────────────────────────────
// helpers
function appendEvent(ev) {
  const today   = new Date().toISOString().split('T')[0]
  const logFile = path.join(logsDir, `telemetry-${today}.jsonl`)
  fs.appendFileSync(logFile, JSON.stringify(ev) + '\n')
}

// ────────────────────────────────────────────────────────────
// capture endpoints (single + batch)
app.post('/capture/', (req, res) => {
  try {
    const event = { timestamp: new Date().toISOString(), ...req.body }
    console.log('📊 Telemetry Event:', JSON.stringify(event, null, 2))
    appendEvent(event)
    res.json({ status: 1 })
  } catch (err) {
    console.error('Error processing telemetry:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

app.post('/batch/', (req, res) => {
  try {
    const { batch = [] } = req.body || {}
    batch.forEach(ev => {
      const event = { timestamp: new Date().toISOString(), ...ev }
      console.log('📊 Telemetry Event:', JSON.stringify(event, null, 2))
      appendEvent(event)
    })
    res.json({ status: 1 })
  } catch (err) {
    console.error('Error processing batch:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ────────────────────────────────────────────────────────────
// health
app.get('/health', (_, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// stats (aggregated counts)
app.get('/stats', (_, res) => {
  try {
    const files    = fs.readdirSync(logsDir).filter(f => f.endsWith('.jsonl'))
    const totals   = Object.create(null)
    const accepted = { option_selected: 0, thumbs_up: 0 }
    const rejected = { options_ignored: 0, thumbs_down: 0 }

    files.forEach(f => {
      const lines = fs.readFileSync(path.join(logsDir, f), 'utf8')
        .trim().split('\n').filter(Boolean)

      lines.forEach(line => {
        const ev = JSON.parse(line)
        totals[ev.event] = (totals[ev.event] || 0) + 1

        if (ev.event === 'task.option_selected')      accepted.option_selected++
        if (ev.event === 'task.options_ignored')      rejected.options_ignored++
        if (ev.event === 'task.feedback') {
          if (ev.properties?.feedbackType === 'thumbs_up')   accepted.thumbs_up++
          if (ev.properties?.feedbackType === 'thumbs_down') rejected.thumbs_down++
        }
      })
    })

    res.json({ totals, accepted, rejected })
  } catch (err) {
    console.error('stats error', err)
    res.status(500).json({ error: 'stats failed' })
  }
})

// recent-events API (last 20 of today)
app.get('/api/events', (_, res) => {
  try {
    const today   = new Date().toISOString().split('T')[0]
    const logFile = path.join(logsDir, `telemetry-${today}.jsonl`)
    if (!fs.existsSync(logFile)) return res.json([])

    const events = fs.readFileSync(logFile, 'utf8')
      .trim().split('\n').filter(Boolean)
      .map(JSON.parse)
      .slice(-20).reverse()

    res.json(events)
  } catch (err) {
    console.error('Error reading events:', err)
    res.json([])
  }
})

// ────────────────────────────────────────────────────────────
// dashboard
app.get('/', (_, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>Cline Telemetry Dashboard</title>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .header { background:#f5f5f5; padding:20px; border-radius:5px; margin-bottom:20px; }
    .event  { background:#f9f9f9; padding:10px; margin:10px 0; border-left:4px solid #007cba; }
    .timestamp { color:#666; font-size:0.9em; }
    .event-type{ font-weight:bold; color:#007cba; }
    pre { background:#f0f0f0; padding:10px; overflow-x:auto; }

    table { border-collapse:collapse; margin-top:20px; }
    th,td { border:1px solid #ddd; padding:8px; text-align:center; }
    th { background:#007cba; color:#fff; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🔍 Cline Telemetry Dashboard</h1>
    <p>Endpoint: <code>http://localhost:${PORT}/capture/</code></p>
  </div>

  <h2>Recent Events</h2>
  <div id="events">Loading...</div>

  <h2>Metrics (Accepted vs Rejected)</h2>
  <div id="metrics">Loading...</div>

  <script>
    // recent events
    function loadEvents() {
      fetch('/api/events')
        .then(r=>r.json())
        .then(events=>{
          const div=document.getElementById('events')
          if(events.length===0){ div.innerHTML='<p>No events yet.</p>'; return }
          div.innerHTML = events.map(ev => \`
             <div class="event">
               <div class="timestamp">\${ev.timestamp}</div>
               <div class="event-type">\${ev.event}</div>
               <pre>\${JSON.stringify(ev,null,2)}</pre>
             </div>\`).join('')
        })
        .catch(()=>{document.getElementById('events').innerHTML='<p>Error loading events</p>'})
    }

    // metrics
    function loadStats() {
      fetch('/stats')
        .then(r=>r.json())
        .then(s=>{
          const m=document.getElementById('metrics')
          const acc=s.accepted||{}
          const rej=s.rejected||{}
          const tot=s.totals || {}

          m.innerHTML = \`
            <table>
              <thead><tr><th>Metric</th><th>Accepted</th><th>Rejected</th></tr></thead>
              <tbody>
                <tr><td>Options</td><td>\${acc.option_selected}</td><td>\${rej.options_ignored}</td></tr>
                <tr><td>Thumbs</td><td>\${acc.thumbs_up}</td><td>\${rej.thumbs_down}</td></tr>
              </tbody>
            </table>
            <h4>Event Totals</h4>
            <pre>\${JSON.stringify(tot,null,2)}</pre>
          \`
        })
        .catch(()=>{document.getElementById('metrics').innerHTML='<p>Error loading metrics</p>'})
    }

    loadEvents()
    loadStats()
    setInterval(loadEvents, 5000)
    setInterval(loadStats, 10000)
  </script>
</body>
</html>
  `)
})

// ────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Cline Telemetry Server running at http://localhost:${PORT}`)
  console.log(`📊 Dashboard: http://localhost:${PORT}`)
  console.log(`🔗 Capture endpoint: http://localhost:${PORT}/capture/`)
  console.log(`📁 Logs saved to: ${logsDir}`)
})