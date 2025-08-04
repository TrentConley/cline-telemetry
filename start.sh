#!/bin/bash

echo "🚀 Starting Cline Minimal Telemetry Server..."

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Start the server
echo "🔗 Starting server at http://localhost:8000"
node server.js