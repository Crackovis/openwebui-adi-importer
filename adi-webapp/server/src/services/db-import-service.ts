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

const countStatements = (sql: string): number => {
  return sql
    .split(";")
    .map((value) => value.trim())
    .filter((value) => value.length > 0).length;
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

    if (!fs.existsSync(parsed.data.sqlPath)) {
      throw new DbImportError("SQL_FILE_NOT_FOUND", `SQL file not found: ${parsed.data.sqlPath}`);
    }

    const sql = fs.readFileSync(parsed.data.sqlPath, "utf8");
    const db = new Database(parsed.data.dbPath);

    try {
      db.pragma("foreign_keys = ON");
      const transaction = db.transaction((statementText: string) => {
        db.exec(statementText);
      });
      transaction(sql);
      return {
        applied: true,
        statementCount: countStatements(sql),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "SQL apply failed.";
      throw new DbImportError("DB_IMPORT_FAILED", message);
    } finally {
      db.close();
    }
  };

  return {
    applySql,
    expectedConfirmationText: DB_IMPORT_CONFIRMATION_TEXT,
  };
};
