# Troubleshooting Guide

Common issues and their solutions.

## Table of Contents

- [Installation Issues](#installation-issues)
- [Runtime Errors](#runtime-errors)
- [Import Failures](#import-failures)
- [Database Issues](#database-issues)
- [Docker Issues](#docker-issues)

## Installation Issues

### Native Module Version Mismatch (better-sqlite3)

**Problem**: Server fails to start with:
```
Error: The module 'better_sqlite3.node' was compiled against a different Node.js version
using NODE_MODULE_VERSION X. This version of Node.js requires NODE_MODULE_VERSION Y.
```

**Cause**: `better-sqlite3` contains native C++ bindings that must be compiled for your specific Node.js version. This happens when you switch Node.js versions or copy `node_modules` from another machine.

**Solution**: Rebuild or reinstall from the monorepo root:
```bash
cd adi-webapp

# Option 1: Rebuild native modules in-place (fast)
npm rebuild better-sqlite3 --workspace=server

# Option 2: Full clean and reinstall (thorough)
npm run rebuild
```

**Verify fix**:
```bash
node -e "require('./server/node_modules/better-sqlite3')(':memory:'); console.log('OK')"
```

---

### Node Modules Installation Fails

**Problem**: `npm install` fails with permission errors or network issues.

**Solutions**:
```bash
# Clear npm cache
npm cache clean --force

# Use npm with verbose output to see errors
npm install --verbose

# If behind a proxy, configure npm
npm config set proxy http://proxy.company.com:8080
npm config set https-proxy http://proxy.company.com:8080
```

### Python Not Found

**Problem**: Application fails to start with "Python binary not found" error.

**Solutions**:
1. Verify Python is installed:
   ```bash
   python --version
   # or
   python3 --version
   ```

2. Update `.env` with correct path:
   ```bash
   # Windows
   PYTHON_BIN=C:\Python39\python.exe
   
   # Linux/Mac
   PYTHON_BIN=/usr/bin/python3
   ```

3. Ensure Python is in your PATH:
   ```bash
   which python3
   ```

### Missing Importer Scripts

**Problem**: "Importer scripts not found" error.

**Solutions**:
1. Verify the `openwebui-importer` directory exists alongside `adi-webapp`
2. Check the `IMPORTER_ROOT` path in `.env`:
   ```bash
   # Default (relative from server/)
   IMPORTER_ROOT=../openwebui-importer
   
   # Absolute path
   IMPORTER_ROOT=/home/user/projects/openwebui-importer
   ```

3. Ensure Python files are readable:
   ```bash
   ls -la ../openwebui-importer/*.py
   ```

## Runtime Errors

### Server Won't Start

**Problem**: Port 8787 already in use.

**Solutions**:
```bash
# Find process using port
lsof -i :8787
# or
netstat -ano | findstr :8787

# Kill process or change port in .env
SERVER_PORT=8788
```

### Web UI Won't Connect to API

**Problem**: Web UI shows "Cannot connect to server" or API errors.

**Solutions**:
1. Verify server is running:
   ```bash
   curl http://localhost:8787/api/health
   ```

2. Check `VITE_API_BASE_URL` in web environment:
   ```bash
   # In adi-webapp/web/.env
   VITE_API_BASE_URL=http://localhost:8787
   ```

3. Check CORS configuration if accessing from different origin

4. Clear browser cache and reload

### Frontend Dev Server (`http://localhost:5173`) Is Inaccessible

**Problem**: `npm run dev` (or `npm run dev --workspace=web`) exits with:
```bash
Error: Cannot find module @rollup/rollup-<platform>
```

**Cause**: Registry policy can block Rollup's native optional packages (`@rollup/rollup-*`). When that happens, Vite and Vitest fail during startup before binding to port `5173`.

**Current runtime-safe fix in this repo**:
- The web workspace dev/build commands use an `esbuild` fallback script instead of invoking Vite directly.
- This keeps local runtime and production build unblocked under strict registry policies while preserving the existing React app.

**Commands**:
1. Start web workspace:
   ```bash
   npm run dev --workspace=web
   ```
2. Build web workspace:
   ```bash
   npm run build --workspace=web
   ```
3. If your environment later allows `@rollup/*`, you can restore Vite workflows in a follow-up maintenance task.

### Subprocess Timeout

**Problem**: Import jobs fail with "Subprocess timeout" error.

**Solutions**:
1. Increase timeout in `.env`:
   ```bash
   SUBPROCESS_TIMEOUT_MS=300000  # 5 minutes
   ```

2. Reduce batch size for large imports:
   ```bash
   MAX_INPUT_FILES=50
   MAX_INPUT_TOTAL_BYTES=52428800  # 50MB
   ```

3. Process files individually instead of batch mode

## Import Failures

### Precheck Validation Failed

**Problem**: Job fails at precheck stage.

**Common causes and solutions**:

| Error | Cause | Solution |
|-------|-------|----------|
| "Python not available" | Python path incorrect | Update PYTHON_BIN in .env |
| "Invalid source format" | Wrong file type for source | Ensure files match selected source |
| "File too large" | Exceeds size limit | Increase MAX_INPUT_TOTAL_BYTES |
| "Too many files" | Exceeds file limit | Increase MAX_INPUT_FILES or split batch |
| "Unable to resolve OpenWebUI user identity" | Auto-discovery cannot authenticate to OpenWebUI | Set `OPENWEBUI_AUTH_TOKEN` or use advanced token/API key override |
| "Unable to resolve OpenWebUI database path" | Direct DB action cannot infer `webui.db` path | Set `OPENWEBUI_DATA_DIR`, `OPENWEBUI_DATABASE_URL`, or advanced DB path override |
| "OpenWebUI database is not writable" | `webui.db` mount/path is read-only | Use a read-write mount (avoid `:ro`) and verify file + parent directory write access |

### OpenWebUI Auto-Discovery Returns 401

**Problem**: OpenWebUI endpoint is reachable, but identity lookup fails with `401 Unauthorized`.

**Solutions**:
1. Add an auth token/API key via advanced wizard override.
2. Or set `OPENWEBUI_AUTH_TOKEN` in `.env` for operator-managed defaults.
3. Verify URL candidate list includes your running instance (for example Pinokio at `http://127.0.0.1:42004`).
4. From Docker, confirm host reachability:
   ```bash
   docker compose exec -T server wget -S -O - http://host.docker.internal:42004/api/v1/auths/
   ```
   A `401` here means networking works and credentials are the missing piece.
   If `webui.db` is readable in the container, discovery can still resolve `userId` via DB fallback and report a reachable URL in `Resolved OpenWebUI URL`.

### Conversion Failed

**Problem**: Files fail to convert.

**Solutions**:
1. Check file format matches selected source:
   - ChatGPT: JSON or HTML exports
   - Claude: JSON exports
   - Grok: JSON exports
   - AI Studio: JSON conversations

2. Verify files are not corrupted:
   ```bash
   # Check JSON validity
   python -m json.tool < file.json > /dev/null
   ```

3. Check job logs for specific error details

4. Try processing files individually to identify problematic files

### SQL Generation Failed

**Problem**: Conversion succeeds but SQL generation fails.

**Solutions**:
1. Check disk space for `SQL_DIR`
2. Verify write permissions:
   ```bash
   touch ./storage/sql/test.txt
   ```
3. Check logs for Python errors from create_sql.py

## Database Issues

### Direct DB Import Fails

**Problem**: Import fails when writing to OpenWebUI database.

**Solutions**:
1. **Check auto-discovery inputs**:
   ```bash
   # Optional but recommended in .env
   OPENWEBUI_BASE_URL=http://127.0.0.1:42004
   OPENWEBUI_AUTH_TOKEN=<token-or-api-key>
   OPENWEBUI_DATA_DIR=/path/to/openwebui/data
   OPENWEBUI_PINOKIO_ROOT=/pinokio
   PATH_MAPPING=C:/pinokio;/pinokio
   PINOKIO_HOST_ROOT=C:/pinokio
   ```

2. **If running Docker on Windows + Pinokio, mount Pinokio into the server container**:
   ```yaml
   services:
     server:
       volumes:
           - "${PINOKIO_HOST_ROOT:-C:/pinokio}:/pinokio:rw"
   ```
   Read-only mounts (`:ro`) trigger: `OpenWebUI database is not writable`.

3. **Check database path**:
   ```bash
   # Verify inferred/override webui.db path
   ls -la /path/to/webui.db
   ```

4. **Check database permissions**:
   ```bash
   # Database must be writable
   chmod 644 /path/to/webui.db
   ```

5. **Database locked**:
    - Stop OpenWebUI while importing
    - Or use SQL action instead

6. **Restore from backup** if corruption occurs:
   ```bash
   # Backups are in storage/backups/
   cp storage/backups/webui_backup_<timestamp>.db /path/to/webui.db
   ```

### SQLite Errors

**Problem**: Application database errors (app.db).

**Solutions**:
1. **Database is locked**:
   ```bash
   # Remove lock files
   rm storage/app.db-shm storage/app.db-wal
   ```

2. **Corrupted database**:
   ```bash
   # Backup and recreate
   mv storage/app.db storage/app.db.bak
   # Restart application to create new database
   ```

3. **Disk full**:
   ```bash
   df -h
   # Free up space or move storage directory
   ```

## Docker Issues

### Startup Flaps or `server` Stays Unhealthy

**Problem**: `docker compose up --build -d` starts containers, but `server` flips to `unhealthy` during boot and `web` is delayed or never starts.

**Root cause**:
- On Windows bind mounts, SQLite can fail with `SQLITE_IOERR_SHMOPEN` when `better-sqlite3` initializes journal/SHM files in `/workspace/storage`.
- The original startup also did `npm install` on every boot, which can delay health readiness on first start.

**Code-level fix applied** (`docker-compose.yml`):
- Runtime storage now uses a Docker named volume (`app_storage:/workspace/storage`) to avoid host SHM/WAL I/O issues.
- Server/web install dependencies only when `node_modules` is missing/empty.
- Healthcheck uses `CMD-SHELL` + `wget --spider` against `http://127.0.0.1:8787/api/health`.
- Health timing is tuned for first boot (`start_period: 90s`, `retries: 18`, `interval: 10s`).
- Web dev command and port mapping respect `WEB_PORT` (`${WEB_PORT:-5173}`).

**Validation**:
```bash
docker compose up --build -d
docker compose ps
docker compose logs server --tail=200
curl http://localhost:8787/api/health

# confirm stable health for 2 minutes
watch -n 10 "docker compose ps"
```

`server` should remain `healthy` for at least 12 consecutive checks (10s interval) and `web` should start only after server health is established.

### Docker Compose Build Fails

**Problem**: `docker-compose up --build` fails.

**Solutions**:
1. **Clear Docker cache**:
   ```bash
   docker-compose down -v
   docker system prune -a
   docker-compose up --build
   ```

2. **Check Docker logs**:
   ```bash
   docker-compose logs server
   docker-compose logs web
   ```

3. **Verify .env exists**:
   ```bash
   cp .env.example .env
   ```

### Services Won't Start

**Problem**: Containers exit immediately or show errors.

**Solutions**:
1. **Check health status**:
   ```bash
   docker-compose ps
   docker-compose logs server
   ```

2. **Port conflicts**:
   ```bash
   # Change ports in docker-compose.yml or .env
   ports:
     - "8788:8787"  # Different host port
   ```

3. **Volume permissions**:
   ```bash
   # Fix permissions
   docker-compose exec server chown -R node:node /workspace/storage
   ```

### Slow Performance in Docker

**Problem**: Imports or file uploads are slow.

**Solutions**:
1. **Volume mounting on macOS/Windows**:
   - Use Docker Desktop settings to increase resources
   - Enable file system caching

2. **Use named volumes for node_modules** (already configured):
   ```yaml
   volumes:
     - server_node_modules:/workspace/server/node_modules
   ```

## Getting Help

If issues persist:

1. **Check logs**:
   ```bash
   # Server logs
   cd server && npm run dev  # Run directly to see logs
   
   # Docker logs
   docker-compose logs -f
   
   # Job logs in UI
   # Navigate to Job Detail page and view logs
   ```

2. **Verify configuration**:
   ```bash
   # Print current config
   cat .env
   
   # Check Python can run scripts
   python ../openwebui-importer/convert_chatgpt.py --help
   ```

3. **Test components individually**:
   ```bash
   # Test Python converter
   python ../openwebui-importer/convert_chatgpt.py input.json output/
   
   # Test SQL generation
   python ../openwebui-importer/create_sql.py --help
   ```

## Debug Mode

Enable debug logging:

```bash
# Server
NODE_ENV=development npm run dev

# Or in .env
NODE_ENV=development
```

This will show:
- Detailed subprocess output
- Database queries
- Full error stack traces

## Common Error Messages

| Error | Likely Cause | Quick Fix |
|-------|--------------|-----------|
| "ECONNREFUSED" | Server not running | Start server with `npm run dev` |
| "ENOENT" | File/directory not found | Check paths in .env |
| "EACCES" | Permission denied | Fix file permissions |
| "ETIMEDOUT" | Network timeout | Check firewall/proxy settings |
| "SQLITE_BUSY" | Database locked | Stop other processes accessing DB |
