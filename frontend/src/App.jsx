import { useState, useEffect, useMemo } from 'react'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'
import './App.css'

function App() {
  const [events, setEvents] = useState([])
  const [stats, setStats] = useState(null)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    const fetchEvents = () => {
      fetch('/api/events')
        .then((r) => r.json())
        .then(data => {
          const normalized = data.map(row => ({
            ...row,
            event: row.event_type,
            timestamp: row.captured_at
          }))
          setEvents(normalized)
        })
        .catch(() => {})
    }
    const fetchStats = () => {
      fetch('/stats')
        .then((r) => r.json())
        .then(setStats)
        .catch(() => {})
    }
    
    fetchEvents()
    fetchStats()
    
    const eventsTimer = setInterval(fetchEvents, 3000)
    const statsTimer = setInterval(fetchStats, 5000)
    
    return () => {
      clearInterval(eventsTimer)
      clearInterval(statsTimer)
    }
  }, [])

  // Process events data for visualization
  const processedData = useMemo(() => {
    if (!events.length) return { eventTypes: [], timeline: [], usageData: [] }

    // Count event types
    const eventTypeCounts = {}
    const timelineData = {}
    let totalCost = 0
    const modelUsage = {}

    events.forEach(event => {
      // Event type counts
      eventTypeCounts[event.event] = (eventTypeCounts[event.event] || 0) + 1

      // Timeline data (group by minute)
      const minute = new Date(event.timestamp).toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      })
      if (!timelineData[minute]) {
        timelineData[minute] = { time: minute, count: 0 }
      }
      timelineData[minute].count++

      // Cost tracking for summary card
      if (event.properties?.totalCost) {
        totalCost += event.properties.totalCost
      }

      // Model usage tracking
      if (event.properties?.model) {
        const model = event.properties.model
        modelUsage[model] = (modelUsage[model] || 0) + 1
      }
    })

    const eventTypes = Object.entries(eventTypeCounts).map(([name, value]) => ({
      name: name.replace('task.', ''),
      value,
      fullName: name
    }))

    const timeline = Object.values(timelineData).slice(-20) // Last 20 time points

    const usageData = Object.entries(modelUsage).map(([model, count]) => ({
      name: model.split('/').pop() || model,
      value: count,
      fullName: model
    })).sort((a, b) => b.value - a.value) // Sort by usage count descending

    return { eventTypes, timeline, usageData, totalCost }
  }, [events])

  // Filter events
  const filteredEvents = useMemo(() => {
    if (filter === 'all') return events
    return events.filter(e => e.event === filter)
  }, [events, filter])

  // Process stats data for acceptance chart
  const acceptanceData = useMemo(() => {
    if (!stats) return []
    
    return [
      {
        name: 'Options',
        accepted: stats.accepted?.option_selected || 0,
        rejected: stats.rejected?.options_ignored || 0,
      },
      {
        name: 'Thumbs',
        accepted: stats.accepted?.thumbs_up || 0,
        rejected: stats.rejected?.thumbs_down || 0,
      },
    ]
  }, [stats])

  // Colors for charts
  const COLORS = ['#2563eb', '#dc2626', '#16a34a', '#ca8a04', '#9333ea', '#c2410c']

  const formatEventType = (type) => {
    return type.replace('task.', '').replace(/_/g, ' ').split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  // Custom label renderer for pie chart with proper text styling
  const renderPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, name, percent }) => {
    const RADIAN = Math.PI / 180
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5
    const x = cx + radius * Math.cos(-midAngle * RADIAN)
    const y = cy + radius * Math.sin(-midAngle * RADIAN)

    return (
      <text 
        x={x} 
        y={y} 
        fill="#ffffff" 
        stroke="#000000" 
        strokeWidth="0.5" 
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
        fontSize="12"
        fontWeight="600"
      >
        {`${name} ${(percent * 100).toFixed(0)}%`}
      </text>
    )
  }

  return (
    <div className="dashboard">
      <header className="header">
        <h1>Telemetry Dashboard</h1>
        <p className="subtitle">Real-time monitoring and analytics</p>
      </header>

      {/* Summary Cards */}
      <div className="summary-cards">
        <div className="card">
          <div className="card-label">Total Events</div>
          <div className="card-value">{events.length}</div>
          <div className="card-change">+{events.filter(e => 
            new Date(e.timestamp) > new Date(Date.now() - 60000)
          ).length} last min</div>
        </div>
        <div className="card">
          <div className="card-label">Event Types</div>
          <div className="card-value">{processedData.eventTypes.length}</div>
          <div className="card-change">Unique types</div>
        </div>
        <div className="card">
          <div className="card-label">Model Requests</div>
          <div className="card-value">
            {processedData.usageData.reduce((sum, model) => sum + model.value, 0)}
          </div>
          <div className="card-change">
            {processedData.usageData.length > 0 
              ? `Top: ${processedData.usageData[0]?.name || 'Unknown'} (${processedData.usageData[0]?.value || 0})`
              : 'No model data'
            }
          </div>
        </div>
        <div className="card">
          <div className="card-label">Active Tasks</div>
          <div className="card-value">
            {new Set(events.map(e => e.properties?.taskId).filter(Boolean)).size}
          </div>
          <div className="card-change">Unique task IDs</div>
        </div>
        <div className="card">
          <div className="card-label">Acceptance Rate</div>
          <div className="card-value">
            {stats ? 
              (() => {
                const totalAccepted = (stats.accepted?.option_selected || 0) + (stats.accepted?.thumbs_up || 0)
                const totalRejected = (stats.rejected?.options_ignored || 0) + (stats.rejected?.thumbs_down || 0)
                const total = totalAccepted + totalRejected
                return total > 0 ? `${Math.round((totalAccepted / total) * 100)}%` : '0%'
              })()
              : '0%'
            }
          </div>
          <div className="card-change">
            {stats ? 
              `${((stats.accepted?.option_selected || 0) + (stats.accepted?.thumbs_up || 0))} accepted, ${((stats.rejected?.options_ignored || 0) + (stats.rejected?.thumbs_down || 0))} rejected`
              : 'No data'
            }
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="charts-grid">
        <div className="chart-container">
          <h3>Event Timeline</h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={processedData.timeline}>
              <defs>
                <linearGradient id="colorArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="time" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }} />
              <Area type="monotone" dataKey="count" stroke="#2563eb" fillOpacity={1} fill="url(#colorArea)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-container">
          <h3>Event Distribution</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={processedData.eventTypes}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={renderPieLabel}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {processedData.eventTypes.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-container">
          <h3>Acceptance Rate</h3>
          {acceptanceData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={acceptanceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }} />
                <Legend />
                <Bar dataKey="accepted" fill="#16a34a" name="Accepted" />
                <Bar dataKey="rejected" fill="#dc2626" name="Rejected" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
              No acceptance data available
            </div>
          )}
        </div>

        {processedData.usageData.length > 0 && (
          <div className="chart-container full-width">
            <h3>Usage by Model</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={processedData.usageData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip 
                  formatter={(value) => [`${value} requests`, 'Usage']}
                  labelFormatter={(label) => processedData.usageData.find(d => d.name === label)?.fullName || label}
                  contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }} 
                />
                <Bar dataKey="value" fill="#9333ea" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Events List */}
      <div className="events-section">
        <div className="events-header">
          <h2>Recent Events</h2>
          <div className="filter-buttons">
            <button 
              className={filter === 'all' ? 'active' : ''} 
              onClick={() => setFilter('all')}
            >
              All
            </button>
            {processedData.eventTypes.map(type => (
              <button
                key={type.fullName}
                className={filter === type.fullName ? 'active' : ''}
                onClick={() => setFilter(type.fullName)}
              >
                {type.name}
              </button>
            ))}
          </div>
        </div>

        <div className="events-list">
          {filteredEvents.length === 0 ? (
            <div className="empty-state">
              <p>No events yet. Waiting for telemetry data...</p>
            </div>
          ) : (
            filteredEvents.slice(0, 50).map((event, idx) => (
              <div 
                key={idx} 
                className={`event-item ${selectedEvent === idx ? 'selected' : ''}`}
                onClick={() => setSelectedEvent(selectedEvent === idx ? null : idx)}
              >
                <div className="event-header">
                  <span className={`event-type ${event.event.replace(/\./g, '-')}`}>
                    {formatEventType(event.event)}
                  </span>
                  <span className="event-time">{formatTimestamp(event.timestamp)}</span>
                </div>
                
                <div className="event-summary">
                  {event.properties?.tool && (
                    <span className="property-badge tool">
                      🛠 {event.properties.tool}
                    </span>
                  )}
                  {event.properties?.model && (
                    <span className="property-badge model">
                      🤖 {event.properties.model.split('/').pop()}
                    </span>
                  )}
                  {event.properties?.totalCost && (
                    <span className="property-badge cost">
                      💰 ${event.properties.totalCost.toFixed(4)}
                    </span>
                  )}
                  {event.properties?.source && (
                    <span className="property-badge source">
                      👤 {event.properties.source}
                    </span>
                  )}
                </div>

                {selectedEvent === idx && (
                  <div className="event-details">
                    <pre>{JSON.stringify(event.properties, null, 2)}</pre>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default App