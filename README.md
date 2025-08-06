# Cline Telemetry Server

A minimal telemetry server for Cline, migrated from Node.js/Express to FastAPI.

## Migration from Node.js to FastAPI

This project has been migrated from a Node.js/Express backend to FastAPI. The following functionality remains identical:

### API Endpoints

- `POST /capture/` - Capture single telemetry event
- `POST /batch/` - Capture batch of telemetry events  
- `GET /health` - Health check endpoint
- `GET /stats` - Aggregated statistics (last 30 days)
- `GET /api/events` - Recent events from today (last 20)
- `GET /` - Dashboard (when React build not available)

### Features

- ✅ PostgreSQL integration for event storage
- ✅ Legacy file logging (JSONL format)
- ✅ Static file serving for React frontend
- ✅ Dashboard with real-time metrics
- ✅ Batch event processing
- ✅ Environment variable configuration with .env support
- ✅ Auto-generated API documentation

## Requirements

- Python 3.8+
- PostgreSQL (configured via environment variables)

## Setup

### Quick Start

```bash
./start.sh
```

This will:
1. Create a Python virtual environment
2. Install dependencies
3. Start the FastAPI server on http://localhost:8000

### Manual Setup

1. Create virtual environment:
```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your database credentials
```

4. Start the server:
```bash
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

For development with auto-reload:
```bash
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

## Environment Variables

Create a `.env` file in the root directory (copy from `.env.example`) with your configuration:

### Required Database Variables:
- `PGHOST` - Database host (default: localhost)
- `PGUSER` - Database user (default: postgres)
- `PGPASSWORD` - Database password
- `PGDATABASE` - Database name (default: telemetry)
- `PGPORT` - Database port (default: 5432)

### Optional Variables:
- `DEBUG` - Enable debug mode (default: false)
- `LOG_LEVEL` - Logging level (default: info)

## Database Setup

Run the initialization script to set up the PostgreSQL database:

```bash
./scripts/init_db.sh
```

## API Documentation

FastAPI automatically generates interactive API documentation:

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Files

### FastAPI Backend
- `main.py` - FastAPI application with dotenv support
- `db.py` - Database helper utilities  
- `requirements.txt` - Python dependencies
- `.env.example` - Example environment configuration
- `.env` - Your environment configuration (create from example)

### Frontend
- `frontend/` - React application (unchanged)

### Configuration
- `start.sh` - Startup script with virtual environment management
- `package.json` - Project metadata and scripts

## Development

The FastAPI server supports hot reloading during development:

```bash
source venv/bin/activate
python -m uvicorn main:app --reload
```

## Production

For production deployment, consider using:

- Gunicorn with uvicorn workers
- Docker containerization
- Environment-specific configuration
- SSL/TLS termination
- Process management (systemd, supervisor)

Example with Gunicorn:
```bash
pip install gunicorn
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

## Security

- The `.env` file is automatically ignored by git
- Never commit sensitive credentials to version control
- Use environment-specific configuration for different deployments
- Consider using secrets management for production environments