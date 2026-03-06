import fs from "node:fs";
import Database from "better-sqlite3";
import {
  DB_IMPORT_CONFIRMATION_TEXT,
  dbImportRequestSchema,
  type DbImportRequest,
} from "../schemas/db-import-schema";

export class DbImportError extends Error {
  public readonly code: string;

  public constructor(code: string, message: string) {
    super(message);
    this.name = "DbImportError";
    this.code = code;
  }
}

export type DbImportResult = {
  applied: boolean;
  statementCount: number;
};

export type DbImportService = {
  applySql: (input: DbImportRequest) => DbImportResult;
  expectedConfirmationText: string;
};

type SqliteLikeError = Error & {
  code?: unknown;
};

const countStatements = (sql: string): number => {
  return sql
    .split(";")
    .map((value) => value.trim())
    .filter((value) => value.length > 0).length;
};

const readSqliteErrorCode = (error: unknown): string | undefined => {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return undefined;
  }

  const code = (error as SqliteLikeError).code;
  return typeof code === "string" && code.trim().length > 0 ? code.trim() : undefined;
};

const toImportError = (error: unknown): DbImportError => {
  const sqliteCode = readSqliteErrorCode(error);
  if (sqliteCode === "SQLITE_BUSY") {
    return new DbImportError(
      "DB_IMPORT_DB_BUSY",
      "Target database is busy. Retry after active database operations complete.",
    );
  }

  if (sqliteCode === "SQLITE_READONLY") {
    return new DbImportError(
      "DB_IMPORT_READONLY",
      "Target database is read-only. Ensure write permissions before running Direct DB mode.",
    );
  }

  if (sqliteCode === "SQLITE_NOTADB" || sqliteCode === "SQLITE_CORRUPT") {
    return new DbImportError("DB_IMPORT_DB_INVALID", "Target database is not a valid SQLite database.");
  }

  if (sqliteCode === "SQLITE_CANTOPEN") {
    return new DbImportError("DB_IMPORT_DB_OPEN_FAILED", "Unable to open target database for write.");
  }

  const message = error instanceof Error ? error.message : "SQL apply failed.";
  return new DbImportError("DB_IMPORT_FAILED", message);
};

export const createDbImportService = (): DbImportService => {
  const applySql = (input: DbImportRequest): DbImportResult => {
    const parsed = dbImportRequestSchema.safeParse(input);
    if (!parsed.success) {
      throw new DbImportError("DB_IMPORT_INPUT_INVALID", parsed.error.issues[0]?.message ?? "Invalid input.");
    }

    if (!fs.existsSync(parsed.data.dbPath)) {
      throw new DbImportError("DB_TARGET_NOT_FOUND", `Target database not found: ${parsed.data.dbPath}`);
    }

    try {
      fs.accessSync(parsed.data.dbPath, fs.constants.W_OK);
    } catch {
      throw new DbImportError(
        "DB_TARGET_NOT_WRITABLE",
        `Target database is not writable: ${parsed.data.dbPath}`,
      );
    }

    if (!fs.existsSync(parsed.data.sqlPath)) {
      throw new DbImportError("SQL_FILE_NOT_FOUND", `SQL file not found: ${parsed.data.sqlPath}`);
    }

    const sql = fs.readFileSync(parsed.data.sqlPath, "utf8");
    const statementCount = countStatements(sql);
    if (statementCount === 0) {
      throw new DbImportError("SQL_FILE_EMPTY", "SQL file contains no executable statements.");
    }

    const db = new Database(parsed.data.dbPath);

    try {
      db.pragma("foreign_keys = ON");
      const transaction = db.transaction((statementText: string) => {
        db.exec(statementText);
      });
      transaction(sql);
      return {
        applied: true,
        statementCount,
      };
    } catch (error) {
      throw toImportError(error);
    } finally {
      db.close();
    }
  };

  return {
    applySql,
    expectedConfirmationText: DB_IMPORT_CONFIRMATION_TEXT,
  };
};
