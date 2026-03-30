# ADI Importer v1.0

A Node.js web application for orchestrating conversation imports into OpenWebUI.

[![Tests](https://img.shields.io/badge/tests-23%20passing-brightgreen)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)]()
[![Node](https://img.shields.io/badge/Node-20+-green)]()

## Overview

ADI Importer provides a web interface to import conversations from various AI platforms (ChatGPT, Claude, Grok, AI Studio) into OpenWebUI. It wraps the `openwebui-importer` Python core without modifying it.

### Features

- **Import Wizard**: Multi-step guided import process
- **Auto OpenWebUI Discovery**: Resolves OpenWebUI URL, user identity, and DB path when possible
- **Format Conversion Pipeline**: Converts ChatGPT, Claude, Grok, and AI Studio exports into OpenWebUI-style JSON artifacts
- **Convert-Only Action**: Export normalized OpenWebUI JSON artifacts without SQL generation
- **SQL Generation Action**: Export import SQL for manual execution
- **Direct DB Import Action**: Automatic import with automatic backups
- **Pre-check Validation**: Validates environment before running
- **Conversion Preview**: See what will be imported before execution
- **Job History**: Track all import operations with full logs
- **Tag Upserts**: Ensures import tags exist per user during SQL generation
- **Batch Folder Mode**: Process multiple files at once

### openwebui-importer capabilities surfaced by ADI

ADI wraps `openwebui-importer` and exposes more than `job-<id>.sql` output:

- Converter scripts handle **ChatGPT**, **Claude**, **Grok**, and **AI Studio** exports.
- Converters emit normalized OpenWebUI-style JSON files in per-source output folders.
- Converter text sanitization removes private-use Unicode characters found in some exports.
- `scripts/run_batch.py` can batch-convert an input directory and optionally skip SQL generation when `--sql-output` is not provided.
- `create_sql.py` supports directory inputs and uses tag upserts, while replacing existing chats with the same IDs before insert.

## Prerequisites

- Node.js 20+ (for local development)
- Python 3.8+ (for conversion scripts)
- Docker & Docker Compose (for containerized deployment)
- OpenWebUI database (for Direct DB action)

## Quick Start

### Option 1: Docker Compose (Recommended)

```bash
# Clone or navigate to the project
cd adi-webapp

# Copy environment file
cp .env.example .env

# Start services
docker-compose up --build

# Access the application
# - Web UI: http://localhost:5173
# - API: http://localhost:8787
```

### Option 2: Local Development

```bash
cd adi-webapp

# Copy environment file
cp .env.example .env

# Install all dependencies (server + web) in one command
npm install

# Start both server and web concurrently
npm run dev

# Web UI: http://localhost:5173
# API:    http://localhost:8787
```

**Available monorepo commands:**

| Command | Description |
|---------|-------------|
| `npm install` | Install all dependencies (server + web) |
| `npm run dev` | Start server and web concurrently |
| `npm run build` | Build server (TypeScript) and web (Vite) |
| `npm run test` | Run all tests (server + web) |
| `npm run clean` | Remove all node_modules and build artifacts |
| `npm run rebuild` | Clean then reinstall everything |

Individual workspace commands also work (backward-compatible):

```bash
# Server only
cd server && npm run dev
cd server && npm test

# Web only
cd web && npm run dev
cd web && npm test
```

## Configuration

Edit `.env` to configure:

```bash
# Server settings
SERVER_HOST=0.0.0.0
SERVER_PORT=8787

# Python configuration
PYTHON_BIN=python
IMPORTER_ROOT=../openwebui-importer

# Storage paths
APP_DB=./storage/app.db
UPLOADS_DIR=./storage/uploads
WORK_DIR=./storage/work
PREVIEW_DIR=./storage/preview
SQL_DIR=./storage/sql
BACKUPS_DIR=./storage/backups

# Limits
MAX_INPUT_FILES=200
MAX_INPUT_TOTAL_BYTES=104857600
SUBPROCESS_TIMEOUT_MS=120000

# Optional OpenWebUI auto-discovery overrides
OPENWEBUI_BASE_URL=
OPENWEBUI_DISCOVERY_URLS=http://host.docker.internal:42004,http://host.docker.internal:3000,http://host.docker.internal:8080
OPENWEBUI_DATA_DIR=/pinokio/api/OpenWebUI/app/env/Lib/site-packages/open_webui/data
OPENWEBUI_PINOKIO_ROOT=/pinokio
OPENWEBUI_DATABASE_URL=
OPENWEBUI_AUTH_TOKEN=
OPENWEBUI_API_KEY=
OPENWEBUI_DISCOVERY_TIMEOUT_MS=3000

# Optional host-to-container mapping for direct DB detection
PATH_MAPPING=C:/pinokio;/pinokio

# Optional host path override for Docker volume mount
PINOKIO_HOST_ROOT=C:/pinokio
```

You can change these same runtime limits from `http://localhost:5173/settings`.
Changes apply immediately to new uploads/jobs (no server restart), including:

- `Max Input Files (count)`
- `Max Input Size (bytes)`
- `Subprocess Timeout (ms)`

When running with Docker on Windows + Pinokio, `docker-compose.yml` mounts `${PINOKIO_HOST_ROOT:-C:/pinokio}` into `/pinokio` for the server container in read-write mode so Direct DB action can update `webui.db`.

## Usage

### 1. Open the Web Interface

Navigate to http://localhost:5173 to see the dashboard.

### 2. Create an Import Job

1. Click "Import Wizard"
2. Select source (ChatGPT, Claude, Grok, or AI Studio)
3. Upload files or select a folder
4. Keep auto-detection defaults (open advanced overrides only if needed)
5. Choose action (Convert only, Generate SQL, or Direct DB import)
6. Review and submit

### 3. Monitor Progress

- View job status on the dashboard
- Click a job to see detailed logs
- Stream logs in real-time via SSE

### 4. Convert-Only Action

- Conversion runs and produces normalized preview artifacts
- No SQL artifact is generated
- No database write is attempted

### 5. SQL Action

- Conversion still runs first and produces normalized preview artifacts.
- Download generated SQL from the job detail page
- Execute manually in your OpenWebUI database

### 6. Direct DB Action

- Automatic backup before import
- One-click execution with rollback protection
- Detailed logs for troubleshooting
- Automatic DB path detection first, with optional advanced path override

## Project Structure

```
adi-webapp/
├── server/                 # Fastify API backend
│   ├── src/
│   │   ├── config/         # Environment & configuration
│   │   ├── db/            # Database repositories
│   │   ├── domain/        # Business logic (state machine, types)
│   │   ├── lib/           # Utilities (path safety, API response)
│   │   ├── routes/        # API endpoints
│   │   ├── schemas/       # Zod validation schemas
│   │   ├── services/      # Core services (precheck, conversion, etc.)
│   │   └── server.ts      # Application entry point
│   └── test/              # Backend tests
├── web/                   # React + Vite frontend
│   ├── src/
│   │   ├── api/           # API client
│   │   ├── features/      # Feature modules
│   │   ├── pages/         # Page components
│   │   ├── __tests__/     # Frontend tests
│   │   └── App.tsx        # Main application
│   └── index.html
├── docs/                  # Documentation
│   ├── getting-started.md
│   ├── operations.md
│   └── troubleshooting.md
├── storage/               # Runtime data (gitignored)
│   ├── app.db            # Application metadata
│   ├── uploads/          # Uploaded files
│   ├── work/             # Working directory
│   ├── preview/          # Preview artifacts
│   ├── sql/              # Generated SQL files
│   └── backups/          # DB backups
├── docker-compose.yml
├── Dockerfile
└── .env.example
```

## Testing

```bash
# Run all tests from root (recommended)
npm run test

# Run with coverage (individual workspaces)
cd server && npm run test -- --coverage
cd web && npm run test -- --coverage
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/health | Health check |
| POST | /api/openwebui/discovery | Preview OpenWebUI auto-discovery |
| GET | /api/settings | Get settings |
| PUT | /api/settings | Update settings |
| POST | /api/upload | Upload one source file |
| POST | /api/upload/batch | Upload multiple source files |
| GET | /api/jobs | List jobs |
| POST | /api/jobs | Create job |
| GET | /api/jobs/:id | Get job details |
| GET | /api/jobs/:id/stream | Stream logs (SSE) |
| POST | /api/jobs/:id/retry | Retry failed job |
| GET | /api/jobs/:id/artifacts/:type | Download artifact |

## Documentation

- [Getting Started](docs/getting-started.md) - Detailed setup instructions
- [Operations](docs/operations.md) - Action options and execution behavior
- [Troubleshooting](docs/troubleshooting.md) - Common issues and solutions

## Architecture

### State Machine

Jobs follow a strict state machine with action-based branching:

```
queued → precheck → converting → preview_ready ┬→ completed (convert_only)
                                               └→ sql_ready ┬→ completed (sql)
                                                            └→ db_importing → completed (direct_db)
  ↓           ↓            ↓                      ↓             ↓               ↓
failed_*   cancelled
```

### Security

- Path normalization and traversal protection
- Input size and file count limits
- Subprocess timeout handling
- Strict allow-list for source values
- No secrets in code (config via .env)

## Development

### Build for Production

```bash
# Build both server and web from root (recommended)
npm run build

# Or build individually
cd server && npm run build
cd web && npm run build
```

### Code Style

- TypeScript strict mode enabled
- Zod for runtime validation
- Functional programming patterns where appropriate
- Minimal, clean component architecture

## Known Limitations

- File uploads are stored locally (no cloud storage)
- Single-node deployment only
- No authentication layer (runs locally or behind reverse proxy)

## Next Steps

- [ ] Add user authentication
- [ ] Support cloud storage backends
- [ ] Implement job scheduling
- [ ] Add statistics dashboard
- [ ] Support more conversation formats

## License

MIT - See LICENSE file for details

## Support

For issues and feature requests, please refer to the troubleshooting guide or open an issue in the repository.
