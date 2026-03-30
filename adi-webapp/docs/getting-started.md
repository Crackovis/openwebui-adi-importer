# Getting Started

This guide will help you get ADI Importer up and running quickly.

## Table of Contents

- [Installation](#installation)
- [First Run](#first-run)
- [Configuration](#configuration)
- [Creating Your First Import Job](#creating-your-first-import-job)
- [Next Steps](#next-steps)

## Installation

### Prerequisites

Before starting, ensure you have:

1. **Node.js 20+** - [Download here](https://nodejs.org/)
2. **Python 3.8+** - [Download here](https://python.org/)
3. **Docker & Docker Compose** (optional but recommended)
4. **OpenWebUI database** (for Direct DB mode)

### Docker Compose (Recommended)

This is the easiest way to get started:

```bash
# Navigate to the project directory
cd adi-webapp

# Copy the example environment file
cp .env.example .env

# Build and start all services
docker-compose up --build

# Or run in background
docker-compose up -d --build

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

Services will be available at:
- **Web UI**: http://localhost:5173
- **API**: http://localhost:8787
- **Health Check**: http://localhost:8787/api/health

### Local Development

For development or customization:

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

**Monorepo commands reference:**

| Command | Description |
|---------|-------------|
| `npm install` | Install all dependencies (server + web) |
| `npm run dev` | Start server and web concurrently |
| `npm run build` | Build both workspaces |
| `npm run test` | Run all tests |
| `npm run clean` | Remove all node_modules and build artifacts |
| `npm run rebuild` | Clean then reinstall (use after Node.js version change) |

## First Run

After starting the application:

1. **Check Health Status**
   ```bash
   curl http://localhost:8787/api/health
   ```
   Should return: `{"ok":true,"data":{"status":"ok"}}`

2. **Open the Web Interface**
   Navigate to http://localhost:5173

3. **Verify Settings**
   Go to the "Settings" page and verify:
   - Python binary path is correct
   - Importer scripts path points to openwebui-importer
   - Storage directories are writable

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and adjust as needed:

```bash
# Server Configuration
NODE_ENV=development
SERVER_HOST=0.0.0.0
SERVER_PORT=8787
WEB_PORT=5173
API_BASE_URL=http://localhost:8787

# Python Configuration
PYTHON_BIN=python                    # Path to Python executable
IMPORTER_ROOT=../openwebui-importer  # Path to Python converter scripts

# Storage Paths (relative to server/)
APP_DB=./storage/app.db
UPLOADS_DIR=./storage/uploads
WORK_DIR=./storage/work
PREVIEW_DIR=./storage/preview
SQL_DIR=./storage/sql
BACKUPS_DIR=./storage/backups

# Safety Limits
MAX_INPUT_FILES=200                  # Max files per batch
MAX_INPUT_TOTAL_BYTES=104857600      # 100MB total limit
SUBPROCESS_TIMEOUT_MS=120000         # 2 minute timeout
SSE_HEARTBEAT_MS=10000               # 10 second SSE heartbeat

# Optional OpenWebUI auto-discovery overrides
OPENWEBUI_BASE_URL=
OPENWEBUI_DISCOVERY_URLS=http://host.docker.internal:42004,http://host.docker.internal:3000,http://host.docker.internal:8080
OPENWEBUI_DATA_DIR=
OPENWEBUI_PINOKIO_ROOT=/pinokio
OPENWEBUI_DATABASE_URL=
OPENWEBUI_AUTH_TOKEN=
OPENWEBUI_API_KEY=
OPENWEBUI_DISCOVERY_TIMEOUT_MS=3000

# Optional host-to-container mapping and Docker mount root
PATH_MAPPING=C:/pinokio;/pinokio
PINOKIO_HOST_ROOT=C:/pinokio
```

Runtime limits can also be changed from `http://localhost:5173/settings`.
For new uploads and jobs, changes are applied immediately (no server restart required).

- `Max Input Files (count)` = file count limit
- `Max Input Size (bytes)` = byte limit (UI also shows MiB for readability)

### Storage Directories

The application creates these directories automatically on startup:

```
storage/
├── app.db              # SQLite database for job metadata
├── uploads/            # Uploaded conversation files
├── work/               # Temporary working files
├── preview/            # Preview artifacts
├── sql/                # Generated SQL files
└── backups/            # Database backups (Direct DB mode)
```

## Creating Your First Import Job

### Step 1: Prepare Your Export Files

Export your conversations from the source platform:

- **ChatGPT**: Settings → Data Controls → Export
- **Claude**: Settings → Account → Export Data
- **Grok**: (Export method depends on platform updates)
- **AI Studio**: Download individual conversations as JSON

### Step 2: Open the Import Wizard

1. Navigate to http://localhost:5173/wizard
2. Click "New Import Job"

### Step 3: Select Source

Choose the platform your exports are from:
- ChatGPT
- Claude
- Grok
- AI Studio

### Step 4: Upload Files

**Option A: Individual Files**
1. Click "Select Files"
2. Choose your exported JSON/HTML files
3. Files will be validated automatically

**Option B: Folder Mode**
1. Click "Select Folder"
2. Choose a directory containing multiple exports
3. All valid files will be processed

### Step 5: Configure Import

1. **Auto-detect defaults**: Keep OpenWebUI fields empty in normal cases
2. **Tags**: Add optional tags (comma-separated)
   - Auto-generated: `imported-<source>`
   - Optional: `imported-YYYY-MM`, `batch-<jobId>`
3. **Import Mode**:
    - **SQL Mode**: Generates SQL file for manual execution
    - **Direct DB Mode**: Imports directly into webui.db
4. **Advanced overrides (optional)**:
   - OpenWebUI base URL (example: `http://127.0.0.1:42004`)
   - OpenWebUI token/API key for identity resolution
   - Explicit user ID or DB path only when auto-detection cannot resolve

### Step 6: Review and Submit

1. Review the pre-check results
2. Verify file count and sizes
3. Click "Start Import"

### Step 7: Monitor Progress

1. Watch the job status on the dashboard
2. Click the job for detailed logs
3. Download artifacts when complete:
   - SQL file (SQL mode)
   - Backup file (Direct DB mode)

## Next Steps

### Learn More

- [Operations Guide](operations.md) - Understand SQL vs Direct DB modes
- [Troubleshooting](troubleshooting.md) - Common issues and solutions

### Advanced Usage

- **Batch Processing**: Upload entire folders for bulk imports
- **Retry Failed Jobs**: Click "Retry" on failed jobs after fixing issues
- **View Logs**: Stream logs in real-time during job execution
- **Download Artifacts**: Access generated SQL files and backups

### Testing

Run the test suite to ensure everything is working:

```bash
# Run all tests from root (recommended)
npm run test

# Or run individually
cd server && npm test
cd web && npm test
```

All 38 tests should pass:
- 31 backend tests (precheck, state machine, tagging, SQL integration, API, repos)
- 7 frontend tests (wizard flow, job detail)

## Support

If you encounter issues:

1. Check the [Troubleshooting Guide](troubleshooting.md)
2. Review the job logs for specific errors
3. Verify your configuration matches the requirements
4. Ensure the openwebui-importer Python scripts are accessible

## Security Notes

- Always backup your OpenWebUI database before using Direct DB mode
- The application runs locally by default (no authentication)
- For production use, deploy behind a reverse proxy with authentication
- Never commit the `.env` file with sensitive data
