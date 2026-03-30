# openwebui-adi-importer Agent Specification

**Status:** V1 Complete - Maintenance & Enhancement Mode  
**Version:** 1.0.0  
**Last Updated:** 2026-03-30

This file defines the architecture, operational contract, and development guidance for `openwebui-adi-importer`.

## Project Status

✅ **V1 COMPLETE** - All acceptance criteria met (see Section 13)

**Current Mode:** Ops orchestration with cloud implementation agent (Codex)

**Operation Contract:** `.sisyphus/OPERATION-CONTRACT.md` defines the three-role collaboration model:
- `[ops-orchestration]` - Strategic planning and validation (OpenCode session)
- `[implementation-ops]` - Feature implementation (Codex cloud agent)  
- `[test-evaluation/validation]` - Testing and acceptance (OpenCode session)

For new work, follow the work order protocol defined in the Operation Contract.

## 1) Mission

**Objective:** Provide web orchestration of conversation imports into OpenWebUI through a guided UI.

**Core Principle:** Wrap `openwebui-importer` (Python core) without modifying its source code.

### V1 Features (Implemented ✅)

- ✅ **Three Import Actions:**
  - Convert-only (OpenWebUI JSON artifacts, no SQL)
  - SQL generation (convert + SQL artifact for manual execution)
  - Direct DB import (convert + SQL + automatic DB write with backup)
- ✅ **Auto OpenWebUI Discovery:** Resolves OpenWebUI URL, user identity, and DB path
- ✅ **Pre-check Validation:** Environment, files, permissions validated before execution
- ✅ **Conversion Preview:** Show counts, titles, snippets, tags before import
- ✅ **Job History:** Full audit trail with filters and live SSE log streaming
- ✅ **Smart Tagging:** Auto-tags with source, date, batch ID + custom tags
- ✅ **Batch Folder Mode:** Multi-file processing with robust error reporting
- ✅ **Safety Guardrails:** Automatic backups, explicit confirmation, transaction safety
- ✅ **Runtime Configuration:** Adjustable limits (files, size, timeout) via settings UI

**UI and Docs Language:** English

**Deployment Targets:** Local admin usage, shared server usage (Docker Compose)

## 2) Workspace Context

Project root:

- `Practice/in-computer-science/openwebui-adi-importer`

Existing Python core (do not edit):

- `Practice/in-computer-science/openwebui-adi-importer/openwebui-importer`

Core scripts to orchestrate:

- `convert_chatgpt.py`
- `convert_claude.py`
- `convert_grok.py`
- `convert_aistudio.py`
- `create_sql.py`
- `scripts/run_batch.py` (optional helper)

## 3) Hard Constraints

1. Never modify files under `openwebui-importer/`.
2. Run Python core only through subprocess calls from Node.
3. Use argument arrays for subprocess calls (no shell string concatenation).
4. In `Direct DB` mode, always create backup before any write.
5. Add explicit confirmation step before DB write.
6. Keep all user-facing text and docs in English.
7. If assumptions are needed, pick the safest default and proceed.

## 4) Recommended Tech Stack

Backend:

- Node.js 20+
- TypeScript
- Fastify
- Zod (input validation)
- Better-SQLite3 or SQLite library for app metadata storage

Frontend:

- React + Vite + TypeScript
- Minimal, clean component architecture

Runtime data:

- `storage/app.db` for app metadata (jobs, logs, settings)
- `storage/uploads`
- `storage/work`
- `storage/preview`
- `storage/sql`
- `storage/backups`

## 5) V1 Features (Implementation Reference)

### A. Import Wizard ✅

**Implemented:** Multi-step wizard with auto-discovery and advanced overrides

Features:
1. Source selection: `chatgpt | claude | grok | aistudio`
2. File upload (single/batch) with drag-and-drop
3. Auto OpenWebUI discovery with "Test Auto-Detection" preview
4. Action selection: `convert_only | sql | direct_db`
5. Optional advanced overrides (user ID, DB path)
6. Review and submit with explicit confirmation (Direct DB only)

### B. Pre-check ✅

**Implemented:** Comprehensive validation before execution

Validations:
- ✅ Python binary availability
- ✅ Converter script paths accessible
- ✅ Input files readable and valid extensions
- ✅ User identity resolvable (auto-detect or explicit)
- ✅ Output directories writable
- ✅ Target DB path resolvable and writable (Direct DB mode)
- ✅ OpenWebUI URL reachable (when auth succeeds)

### C. Conversion and SQL ✅

**Implemented:** Subprocess orchestration with artifact persistence

Behavior:
- Runs converter scripts via subprocess (argument arrays, no shell)
- Generates SQL via `create_sql.py` (when action ≠ `convert_only`)
- Persists SQL artifact path in `job_outputs.sqlPath`
- Exposes SQL file download in UI (`GET /api/jobs/:id/artifacts/sql`)
- Convert-only mode skips SQL generation entirely

### D. Direct DB Import ✅

**Implemented:** Safe automated import with backup and rollback

Features:
- ✅ Automatic backup to `BACKUPS_DIR` before any write
- ✅ Explicit user confirmation required
- ✅ Transaction-safe SQL execution
- ✅ Rollback on failure with detailed error logs
- ✅ Backup path persisted in `job_outputs.backupPath`

### E. Preview ✅

**Implemented:** Post-conversion preview before DB write

Shows:
- ✅ Conversation count
- ✅ Sample titles (first 5)
- ✅ Sample message snippets
- ✅ Effective tags (merged and normalized)
- ✅ Preview artifact download link

### F. Job History and Logs ✅

**Implemented:** Full audit trail with real-time streaming

Features:
- ✅ Job list page with filters (status, source, action, date range)
- ✅ Job detail page with timeline and full log history
- ✅ Live logs via SSE (`GET /api/jobs/:id/stream`)
- ✅ Retry action for failed jobs
- ✅ Artifact download links (preview, SQL)

### G. Smart Tagging ✅

**Implemented:** Auto-tag generation with normalization

Rules:
- ✅ Always include `imported-<source>`
- ✅ Optional date tag: `imported-YYYY-MM`
- ✅ Optional batch tag: `batch-<shortJobId>`
- ✅ Merge with custom user tags
- ✅ Normalize (lowercase, trim) and deduplicate
- ✅ Tag upserts in SQL generation (ensures tags exist per user)

### H. Batch Folder Mode ✅

**Implemented:** Multi-file upload with robust error handling

Features:
- ✅ Batch upload endpoint (`POST /api/upload/batch`)
- ✅ Per-file validation with detailed error reporting
- ✅ Configurable limits (count, total size)
- ✅ Parallel conversion support
- ✅ Aggregate success/failure reporting

## 6) API Contract ✅

**Implemented Endpoints:**

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| GET | `/api/health` | Health check | ✅ |
| POST | `/api/openwebui/discovery` | Preview OpenWebUI auto-discovery | ✅ |
| GET | `/api/settings` | Get runtime settings | ✅ |
| PUT | `/api/settings` | Update runtime settings | ✅ |
| POST | `/api/upload` | Upload single source file | ✅ |
| POST | `/api/upload/batch` | Upload multiple source files | ✅ |
| POST | `/api/jobs` | Create import job | ✅ |
| GET | `/api/jobs` | List jobs with filters | ✅ |
| GET | `/api/jobs/:id` | Get job details | ✅ |
| GET | `/api/jobs/:id/stream` | Stream logs (SSE) | ✅ |
| POST | `/api/jobs/:id/retry` | Retry failed job | ✅ |
| GET | `/api/jobs/:id/artifacts/:type` | Download artifact (preview/sql) | ✅ |

**Response Pattern:**

```typescript
{ ok: boolean, data?: T, error?: { code: string, message: string } }
```

## 7) App Metadata Schema

Create app-level DB tables (example):

- `jobs`
  - `id`, `source`, `mode`, `status`, `createdAt`, `startedAt`, `finishedAt`, `durationMs`, `error`
- `job_inputs`
  - `jobId`, `userId`, `tagsCsv`, `inputMode`, `inputPaths`, `dbPath`
- `job_outputs`
  - `jobId`, `convertedCount`, `previewPath`, `sqlPath`, `backupPath`, `appliedToDb`
- `job_logs`
  - `id`, `jobId`, `ts`, `level`, `step`, `message`
- `settings`
  - `key`, `valueJson`, `updatedAt`

## 8) Job State Machine ✅

**Implemented:** Action-based branching state machine

```
queued → precheck → converting → preview_ready ┬→ completed (convert_only)
                                               └→ sql_ready ┬→ completed (sql)
                                                            └→ db_importing → completed (direct_db)
  ↓           ↓            ↓                      ↓             ↓               ↓
failed_*   cancelled
```

**States:**
- `queued` - Job created, waiting to start
- `precheck` - Running validation checks
- `converting` - Running conversion subprocess
- `preview_ready` - Conversion complete, preview available
- `sql_ready` - SQL generated (sql/direct_db actions)
- `db_importing` - Executing DB write (direct_db action only)
- `completed` - Job finished successfully
- `failed_precheck` - Pre-check validation failed
- `failed_convert` - Conversion subprocess failed
- `failed_sql` - SQL generation failed
- `failed_db` - DB import failed
- `cancelled` - Job cancelled by user

**Transition Guarantees:**
- ✅ Every state change writes log entry
- ✅ Timestamps recorded (`startedAt`, `finishedAt`)
- ✅ Duration calculated (`durationMs`)
- ✅ Error context persisted in `jobs.error` field

## 9) Security and Safety

Required safeguards:

- Path normalization and traversal protection.
- Input size and file count limits.
- Subprocess timeout and exit-code handling.
- Strict allow-list for source values.
- No secrets in code.
- Config via `.env`.

## 10) Target File Structure

Create the V1 implementation under:

- `adi-webapp/`

Expected top structure:

- `adi-webapp/server/`
- `adi-webapp/web/`
- `adi-webapp/storage/` (gitignored runtime)
- `adi-webapp/docs/`
- `adi-webapp/.env.example`
- `adi-webapp/docker-compose.yml`

## 11) Documentation ✅

**Implemented Documentation:**

| Document | Location | Status |
|----------|----------|--------|
| Main README | `adi-webapp/README.md` | ✅ Complete |
| Getting Started | `adi-webapp/docs/getting-started.md` | ✅ Complete |
| Operations Guide | `adi-webapp/docs/operations.md` | ✅ Complete |
| Troubleshooting | `adi-webapp/docs/troubleshooting.md` | ✅ Complete |
| Operation Contract | `.sisyphus/OPERATION-CONTRACT.md` | ✅ New (2026-03-30) |

**Content Coverage:**
- ✅ Prerequisites and dependencies
- ✅ Local development setup
- ✅ Docker Compose deployment
- ✅ Convert-only action workflow and use cases
- ✅ SQL action workflow and manual execution
- ✅ Direct DB action workflow and safety mechanisms
- ✅ Backup/restore procedures
- ✅ Auto-discovery configuration
- ✅ Troubleshooting common issues
- ✅ API reference
- ✅ Security considerations

## 12) Testing ✅

**Implemented Test Suites:**

**Backend Tests (Vitest):**
- ✅ Pre-check validation (all validation rules)
- ✅ Subprocess adapter behavior (timeouts, exit codes, output capture)
- ✅ Tagging rules (normalization, deduplication, merging)
- ✅ State machine transitions (all valid paths)
- ✅ Path safety utilities (traversal protection)
- ✅ API response formatting
- ✅ Database repositories (CRUD operations)

**Integration Tests:**
- ✅ Happy path for convert-only action
- ✅ Happy path for SQL action
- ✅ Happy path for Direct DB action
- ✅ Failure path with error propagation
- ✅ Job retry flow
- ✅ Settings update persistence

**Frontend Tests (Vitest + React Testing Library):**
- ✅ Import wizard basic flow
- ✅ Job detail rendering
- ✅ Job list filtering
- ✅ Settings form validation

**Coverage:**
- Backend: 80%+ (per requirement)
- Frontend: Basic component coverage

**Test Commands:**
```bash
cd server && npm test
cd web && npm test
```

## 13) V1 Acceptance Criteria ✅

**Status:** ALL CRITERIA MET

- ✅ `openwebui-importer/` remains unchanged (verified)
- ✅ Convert-only action works end-to-end (produces OpenWebUI JSON, no SQL)
- ✅ SQL action works end-to-end (conversion + SQL generation, manual execution)
- ✅ Direct DB action works with automatic backup + explicit confirmation
- ✅ Pre-check validation implemented and functional
- ✅ Conversion preview implemented (counts, titles, snippets, tags)
- ✅ Job history with filters and live SSE logs
- ✅ Smart tagging with normalization and tag upserts
- ✅ Batch folder mode with multi-file support
- ✅ Core tests pass (23 passing, 80%+ coverage)
- ✅ English documentation complete and runnable
- ✅ Docker Compose deployment functional

**V1 Declared Complete:** 2026-03-30

## 14) V1 Execution History ✅

**Completed Phases:**

1. ✅ **Phase 1-2:** App structure + config + health endpoint
   - Created `adi-webapp/` monorepo structure
   - Implemented environment config with `.env` support
   - Built Fastify server with health endpoint

2. ✅ **Phase 3:** Python adapter + pre-check service
   - Subprocess adapter with timeout and error handling
   - Comprehensive pre-check validation service
   - OpenWebUI auto-discovery service

3. ✅ **Phase 4:** Job persistence + state machine + logging
   - SQLite app.db with schema migrations
   - Action-based state machine implementation
   - Structured logging with levels and timestamps

4. ✅ **Phase 5:** Conversion + SQL orchestration
   - Converter subprocess orchestration
   - SQL generation via `create_sql.py`
   - Convert-only action (no SQL generation)

5. ✅ **Phase 6:** Direct DB mode + backup + safe execution
   - Automatic backup to `BACKUPS_DIR`
   - Transaction-safe SQL execution
   - Explicit user confirmation flow

6. ✅ **Phase 7:** Frontend pages
   - Dashboard with job list and filters
   - Import wizard with auto-discovery
   - Job detail with timeline and logs
   - Settings page for runtime config

7. ✅ **Phase 8:** SSE logs + retry flow
   - Live log streaming via SSE
   - Retry action for failed jobs
   - Artifact download endpoints

8. ✅ **Phase 9:** Tests
   - Backend unit + integration tests (23 passing)
   - Frontend component tests
   - 80%+ backend coverage

9. ✅ **Phase 10:** Docs + Docker
   - Complete English documentation
   - Docker Compose setup with Pinokio volume mount
   - Getting started, operations, troubleshooting guides

**Current Status:** V1 Complete - Maintenance & Enhancement Mode

## 15) V1 Delivery Summary ✅

### Build Summary

**Project:** openwebui-adi-importer V1  
**Delivery Date:** 2026-03-30  
**Implementation Agent:** Codex cloud agent  
**Orchestration Agent:** OpenCode session

**Tech Stack:**
- Backend: Node.js 20+, TypeScript 5.8, Fastify, Zod, Better-SQLite3
- Frontend: React 18, Vite 6, TypeScript 5.8
- Python Core: openwebui-importer (unchanged)
- Container: Docker, Docker Compose

### Key Directories

```
openwebui-adi-importer/
├── .sisyphus/
│   └── OPERATION-CONTRACT.md          # Ops orchestration protocol (NEW)
├── adi-webapp/
│   ├── server/                        # Fastify backend
│   │   ├── src/
│   │   │   ├── config/                # Environment config
│   │   │   ├── db/                    # Database repositories
│   │   │   ├── domain/                # State machine + types
│   │   │   ├── lib/                   # Utilities
│   │   │   ├── routes/                # API endpoints
│   │   │   ├── schemas/               # Zod validation
│   │   │   ├── services/              # Business logic
│   │   │   └── server.ts              # Entry point
│   │   └── test/                      # Backend tests (23 passing)
│   ├── web/                           # React frontend
│   │   ├── src/
│   │   │   ├── api/                   # API client
│   │   │   ├── features/              # Feature modules
│   │   │   ├── pages/                 # Page components
│   │   │   └── __tests__/             # Frontend tests
│   │   └── index.html
│   ├── docs/                          # Documentation
│   │   ├── getting-started.md
│   │   ├── operations.md
│   │   └── troubleshooting.md
│   ├── storage/                       # Runtime data (gitignored)
│   ├── docker-compose.yml
│   ├── Dockerfile
│   └── .env.example
├── openwebui-importer/                # Python core (unchanged)
└── AGENTS.md                          # This file (updated)
```

### Run Commands

**Docker Compose (Production):**
```bash
cd adi-webapp
cp .env.example .env
docker-compose up --build
# Web UI: http://localhost:5173
# API: http://localhost:8787
```

**Local Development:**
```bash
cd adi-webapp

# Terminal 1: Server
cd server && npm install && npm run dev

# Terminal 2: Web
cd web && npm install && npm run dev
```

### Test Commands

```bash
# Backend tests
cd adi-webapp/server && npm test

# Frontend tests
cd adi-webapp/web && npm test

# With coverage
cd adi-webapp/server && npm test -- --coverage
```

**Test Results:** 23 passing, 80%+ backend coverage

### Known Limitations

1. **No Authentication Layer:** Runs locally or behind reverse proxy
2. **Single-Node Deployment:** No horizontal scaling support
3. **Local Storage Only:** No cloud storage backend integration
4. **No Job Scheduling:** Manual job creation only (future enhancement)

### Post-V1 Enhancement Opportunities

1. **Authentication & Authorization:**
   - User accounts with role-based access
   - API key authentication
   - OAuth2 integration

2. **Cloud Storage:**
   - S3-compatible storage backends
   - Azure Blob Storage support
   - Configurable storage strategy

3. **Advanced Scheduling:**
   - Cron-based recurring imports
   - Webhook triggers
   - Integration with CI/CD pipelines

4. **Analytics Dashboard:**
   - Import statistics and trends
   - Conversion success rates
   - Resource usage monitoring

5. **Additional Sources:**
   - Google Gemini exports
   - Perplexity exports
   - Custom format adapters

6. **OpenWebUI Plugin:**
   - One-click import from OpenWebUI UI
   - Bidirectional sync capabilities

---

## Operation Model (V1 Complete → Maintenance Mode)

**For Future Work:**

All new features, bug fixes, and enhancements follow the **Operation Contract** protocol:

1. **[ops-orchestration]** (OpenCode session):
   - Analyzes requirements
   - Issues structured work orders
   - Defines acceptance criteria
   - Orchestrates validation

2. **[implementation-ops]** (Codex cloud agent):
   - Implements work orders
   - Reports completion status
   - Requests clarifications

3. **[test-evaluation/validation]** (OpenCode session):
   - Executes test scenarios via Playwright
   - Validates acceptance criteria
   - Issues approval/rejection

**Contract Location:** `.sisyphus/OPERATION-CONTRACT.md`

---

**V1 Status:** ✅ Complete - All acceptance criteria met  
**Maintenance Status:** Active - Ready for enhancement work orders
