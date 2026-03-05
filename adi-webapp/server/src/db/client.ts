import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

export type DbClient = Database.Database;

const resolveMigrationPath = (): string => {
  const srcPath = path.resolve(process.cwd(), "src/db/migrations/001_init.sql");
  const distPath = path.resolve(process.cwd(), "dist/db/migrations/001_init.sql");
  if (fs.existsSync(srcPath)) {
    return srcPath;
  }
  return distPath;
};

const ensureParentDirectory = (filePath: string): void => {
  const parent = path.dirname(filePath);
  fs.mkdirSync(parent, { recursive: true });
};

const runMigrations = (db: DbClient): void => {
  const migrationPath = resolveMigrationPath();
  const sql = fs.readFileSync(migrationPath, "utf8");
  db.exec(sql);
};

const configureJournalMode = (db: DbClient): void => {
  try {
    db.pragma("journal_mode = WAL");
    return;
  } catch {
    // fall through
  }

  try {
    db.pragma("journal_mode = DELETE");
  } catch {
    // keep SQLite default journal mode when pragma changes are unsupported
  }
};

export const createDbClient = (dbPath: string): DbClient => {
  ensureParentDirectory(dbPath);
  const db = new Database(dbPath);
  db.pragma("foreign_keys = ON");
  configureJournalMode(db);
  runMigrations(db);
  return db;
};
