# Operations Guide

Understanding the two import modes and how to use them safely.

## Table of Contents

- [Import Modes Overview](#import-modes-overview)
- [SQL Mode](#sql-mode)
- [Direct DB Mode](#direct-db-mode)
- [Backup and Restore](#backup-and-restore)
- [Best Practices](#best-practices)

## Import Modes Overview

ADI Importer supports two import modes:

| Mode | Use Case | Safety Level | Speed |
|------|----------|--------------|-------|
| **SQL Mode** | Review before import, manual control | Highest | Requires manual execution |
| **Direct DB** | Automated imports, trusted sources | High (with backups) | Automatic |

## SQL Mode

### Overview

SQL Mode generates a SQL file containing all INSERT statements needed to import your conversations. You review and execute the SQL manually.

### Workflow

1. **Upload Files** → Select your export files
2. **Configure** → Keep auto-detect defaults, add optional tags
3. **Preview Discovery** → Use "Test Auto-Detection" to verify resolved user and URL
4. **Select SQL Mode** → Choose "Generate SQL Only"
5. **Run Conversion** → System converts and generates SQL
6. **Download SQL** → Get the generated SQL file
7. **Review** → Inspect the SQL statements
8. **Execute** → Run SQL in your OpenWebUI database

### When to Use SQL Mode

- **First-time imports**: Review what will be imported
- **Production databases**: Extra safety for critical data
- **Custom modifications**: Edit SQL before execution
- **Learning**: Understand the data structure
- **Team review**: Share SQL for approval

### Generated SQL Structure

```sql
-- Generated SQL includes:
-- 1. Chats table inserts
INSERT INTO chat (id, user_id, title, chat) VALUES (...);

-- 2. Messages table inserts  
INSERT INTO message (id, chat_id, user_id, content, ...) VALUES (...);

-- 3. Tag associations
INSERT INTO chat_tag (chat_id, tag_id) VALUES (...);
```

### Executing SQL

#### Option 1: Command Line (sqlite3)

```bash
# Backup first
cp webui.db webui.db.backup.$(date +%Y%m%d_%H%M%S)

# Execute SQL
sqlite3 webui.db < generated_import.sql
```

#### Option 2: Database GUI

1. Open webui.db in DB Browser for SQLite, DBeaver, etc.
2. Open the generated SQL file
3. Review statements
4. Execute in transaction

#### Option 3: OpenWebUI Console (if available)

Some OpenWebUI deployments provide database access via admin console.

### SQL Mode Safety

- **No automatic changes**: Database is never modified automatically
- **Review opportunity**: Inspect every statement before execution
- **Transaction safety**: SQL can be wrapped in BEGIN/COMMIT
- **Rollback ready**: Original database remains unchanged until you execute

## Direct DB Mode

### Overview

Direct DB Mode automatically imports conversations directly into your OpenWebUI database. Includes automatic backups and safety checks.

### Workflow

1. **Upload Files** → Select your export files
2. **Configure** → Keep auto-detect defaults, add optional tags
3. **Preview Discovery** → Use "Test Auto-Detection" and verify resolved user/DB path
4. **Select Direct DB Mode** → Choose "Import Directly to Database"
5. **Optional Advanced Override** → Set DB path only if auto-detection fails
6. **Review Pre-check** → System validates everything
7. **Confirm** → Explicit confirmation required
8. **Automatic Backup** → Database backed up automatically
9. **Import** → Conversations imported directly
10. **Verify** → Check OpenWebUI for imported conversations

### When to Use Direct DB Mode

- **Regular imports**: Trusted, recurring import workflow
- **Large batches**: Process many files automatically
- **Automation**: Integrate into scripts or CI/CD
- **Convenience**: No manual SQL execution needed
- **Testing**: Import into test instances

### Safety Mechanisms

#### 1. Automatic Backup

Before any database modification:

```
webui.db → webui.db.backup.YYYYMMDD_HHMMSS
```

Backups are stored in:
- Configured `BACKUPS_DIR` (default: `./storage/backups`)
- Named with timestamp for easy identification

#### 2. Pre-check Validation

Before import, system validates:
- ✅ Python binary available
- ✅ Converter scripts accessible
- ✅ Input files readable
- ✅ File extensions valid for source
- ✅ User identity resolvable (auto or explicit override)
- ✅ Output directories writable
- ✅ Target database path resolvable and accessible (Direct DB mode)

#### 3. Explicit Confirmation

Direct DB import requires explicit user confirmation:

```
⚠️ WARNING: This will modify your OpenWebUI database
✓ Backup will be created automatically
✓ Target: /path/to/webui.db

[Cancel] [Confirm Import]
```

#### 4. Transaction Safety

SQL execution uses transactions:
- All changes committed together
- Or all rolled back on error
- No partial imports

#### 5. Detailed Logging

Every step is logged:
- Backup creation
- SQL generation
- Execution steps
- Errors with context

### Restoring from Backup

If something goes wrong:

```bash
# List available backups
ls -la storage/backups/

# Restore from backup
cp storage/backups/webui.db.backup.20240315_143022 /path/to/webui.db

# Or using sqlite3
sqlite3 /path/to/webui.db ".restore storage/backups/webui.db.backup.20240315_143022"
```

### Direct DB Configuration

Optional override settings:

```bash
# In .env (recommended for stable automation)
OPENWEBUI_BASE_URL=
OPENWEBUI_DISCOVERY_URLS=http://host.docker.internal:42004,http://host.docker.internal:3000,http://host.docker.internal:8080
OPENWEBUI_DATA_DIR=
OPENWEBUI_DATABASE_URL=
OPENWEBUI_AUTH_TOKEN=
OPENWEBUI_API_KEY=
```

## Backup and Restore

### Backup Strategy

#### Automatic Backups (Direct DB Mode)

Every Direct DB import creates a backup:

```
storage/backups/
├── webui.db.backup.20240315_143022
├── webui.db.backup.20240316_091534
└── webui.db.backup.20240317_161245
```

#### Manual Backups (Recommended)

Before major operations:

```bash
# Create manual backup
cp webui.db webui.db.manual.backup.$(date +%Y%m%d)

# Or automated script
#!/bin/bash
BACKUP_DIR="/path/to/backups"
DB_PATH="/path/to/webui.db"
cp "$DB_PATH" "$BACKUP_DIR/webui.db.backup.$(date +%Y%m%d_%H%M%S)"
```

### Backup Retention

Manage backup storage:

```bash
# Keep last 10 backups
cd storage/backups
ls -t webui.db.backup.* | tail -n +11 | xargs rm -f

# Keep backups from last 30 days
find storage/backups -name "webui.db.backup.*" -mtime +30 -delete
```

### Restore Procedures

#### Complete Restore

Replace current database with backup:

```bash
# Stop OpenWebUI (if running)

# Backup current state (just in case)
cp webui.db webui.db.emergency.backup

# Restore from backup
cp storage/backups/webui.db.backup.20240315_143022 webui.db

# Restart OpenWebUI
```

#### Selective Restore

Restore specific conversations (advanced):

```sql
-- From backup database, extract specific chats
ATTACH DATABASE 'storage/backups/webui.db.backup.20240315_143022' AS backup;

-- Insert specific chat
INSERT INTO chat SELECT * FROM backup.chat WHERE id = 'specific-chat-id';
INSERT INTO message SELECT * FROM backup.message WHERE chat_id = 'specific-chat-id';

DETACH DATABASE backup;
```

## Best Practices

### General Recommendations

1. **Always Backup First**
   ```bash
   # Before any operation
   cp webui.db webui.db.pre-import.backup
   ```

2. **Start with SQL Mode**
   - First import: Use SQL Mode to understand the process
   - Review generated SQL
   - Then switch to Direct DB for routine imports

3. **Test in Non-Production**
   - Test imports in a development OpenWebUI instance
   - Verify imported conversations look correct
   - Then import to production

4. **Monitor Disk Space**
   ```bash
   # Check storage
   du -sh storage/*
   df -h
   ```

5. **Clean Up Regularly**
   ```bash
   # Remove old work files
   find storage/work -mtime +7 -delete
   
   # Archive old SQL files
   tar czf sql-archive-$(date +%Y%m).tar.gz storage/sql/
   rm -rf storage/sql/*
   ```

### SQL Mode Best Practices

1. **Review Before Execution**
   - Check user_id is correct
   - Verify conversation count matches input
   - Look for any unusual content

2. **Test in Transaction**
   ```bash
   # Wrap in transaction
   echo "BEGIN; $(cat import.sql) COMMIT;" | sqlite3 webui.db
   ```

3. **Keep Generated SQL**
   - Store SQL files for audit trail
   - Name with date: `import_2024-03-15_chatgpt.sql`

### Direct DB Best Practices

1. **Verify Identity Resolution**
   - Confirm OpenWebUI session or token/API key is valid
   - If auto-detect fails, provide explicit user ID override

2. **Small Batches First**
   - Test with 1-2 conversations
   - Then scale to larger batches

3. **Monitor Job Logs**
   - Watch for warnings
   - Check conversion success rate
   - Review any errors

4. **Validate After Import**
   ```bash
   # Count conversations
   sqlite3 webui.db "SELECT COUNT(*) FROM chat WHERE user_id = 'your-user-id';"
   
   # Check recent imports
   sqlite3 webui.db "SELECT id, title, created_at FROM chat ORDER BY created_at DESC LIMIT 10;"
   ```

### Troubleshooting Mode Selection

| Problem | Recommended Mode |
|---------|-----------------|
| First time using importer | SQL Mode |
| Unsure about data quality | SQL Mode |
| Importing to production | SQL Mode (or Direct DB with extra backup) |
| Routine monthly import | Direct DB Mode |
| Bulk import (100+ files) | Direct DB Mode |
| Automated/scripted import | Direct DB Mode |
| Testing/development | Either mode |

## Security Considerations

### Database Access

- Direct DB Mode requires file system access to webui.db
- Ensure proper file permissions
- Run importer with same user as OpenWebUI

### Path Safety

- Paths are normalized to prevent directory traversal
- Only configured directories are accessible
- User input is validated before use

### Data Privacy

- Exported conversations may contain sensitive data
- Store exports securely
- Clean up after import completion

## Advanced Operations

### Batch Processing

Process multiple sources:

1. Create separate jobs for each source
2. Use consistent tagging: `batch-march-2024`
3. Run sequentially or in parallel
4. Monitor aggregate statistics

### Scheduling Imports

Automate with cron (Linux/Mac):

```bash
# Edit crontab
crontab -e

# Daily import at 2 AM
0 2 * * * cd /path/to/adi-webapp && curl -X POST http://localhost:8787/api/jobs \
  -H "Content-Type: application/json" \
  -d '{"source":"chatgpt","files":[...],"mode":"direct_db"}'
```

### Integration with OpenWebUI

Future enhancement possibilities:
- OpenWebUI plugin for one-click import
- Webhook notifications on import completion
- Direct API integration
