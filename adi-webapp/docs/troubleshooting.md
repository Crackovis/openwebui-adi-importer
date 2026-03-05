# Troubleshooting Guide

Common issues and their solutions.

## Table of Contents

- [Installation Issues](#installation-issues)
- [Runtime Errors](#runtime-errors)
- [Import Failures](#import-failures)
- [Database Issues](#database-issues)
- [Docker Issues](#docker-issues)

## Installation Issues

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
| "User ID missing" | No userId provided | Enter your OpenWebUI user ID |

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
1. **Check database path**:
   ```bash
   # Verify webui.db path in job configuration
   ls -la /path/to/webui.db
   ```

2. **Check database permissions**:
   ```bash
   # Database must be writable
   chmod 644 /path/to/webui.db
   ```

3. **Database locked**:
   - Stop OpenWebUI while importing
   - Or use SQL mode instead

4. **Restore from backup** if corruption occurs:
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
