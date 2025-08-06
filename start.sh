#!/bin/bash

echo "🚀 Starting Cline Minimal Telemetry Server (FastAPI)..."

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is required but not installed. Please install Python 3.8 or later."
    exit 1
fi

# Install Python dependencies if virtual environment doesn't exist
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment and installing dependencies..."
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
else
    echo "📦 Activating virtual environment..."
    source venv/bin/activate
fi

# Start the FastAPI server
echo "🔗 Starting FastAPI server at http://localhost:8011"
python -m uvicorn main:app --host 0.0.0.0 --port 8011