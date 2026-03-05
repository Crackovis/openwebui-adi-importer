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

export const createDbClient = (dbPath: string): DbClient => {
  ensureParentDirectory(dbPath);
  const db = new Database(dbPath);
  db.pragma("foreign_keys = ON");
  db.pragma("journal_mode = WAL");
  runMigrations(db);
  return db;
};
