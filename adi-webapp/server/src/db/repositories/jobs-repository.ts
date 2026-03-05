import type { DbClient } from "../client";
import type { JobMode, JobSource, JobStatus } from "../../domain/job-types";

export type JobRecord = {
  id: string;
  source: JobSource;
  mode: JobMode;
  status: JobStatus;
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
  durationMs: number | null;
  error: string | null;
};

export type JobInputRecord = {
  jobId: string;
  userId: string;
  tagsCsv: string;
  inputMode: "files" | "folder";
  inputPaths: string;
  dbPath: string | null;
};

export type JobOutputRecord = {
  jobId: string;
  convertedCount: number;
  previewPath: string | null;
  sqlPath: string | null;
  backupPath: string | null;
  appliedToDb: number;
};

export type JobLogRecord = {
  id: number;
  jobId: string;
  ts: number;
  level: "debug" | "info" | "warning" | "error";
  step: string;
  message: string;
};

export type JobFilters = {
  status?: JobStatus;
  source?: JobSource;
  mode?: JobMode;
  fromTs?: number;
  toTs?: number;
  limit?: number;
  offset?: number;
};

export type JobsRepository = {
  createJob: (job: JobRecord) => void;
  getJobById: (id: string) => JobRecord | null;
  listJobs: (filters?: JobFilters) => JobRecord[];
  updateJobState: (id: string, status: JobStatus, error: string | null) => void;
  markJobStarted: (id: string, startedAt: number) => void;
  markJobFinished: (id: string, finishedAt: number, durationMs: number, status: JobStatus, error: string | null) => void;
  upsertJobInput: (input: JobInputRecord) => void;
  getJobInput: (jobId: string) => JobInputRecord | null;
  upsertJobOutput: (output: JobOutputRecord) => void;
  patchJobOutput: (jobId: string, patch: Partial<JobOutputRecord>) => void;
  getJobOutput: (jobId: string) => JobOutputRecord | null;
  appendJobLog: (log: Omit<JobLogRecord, "id">) => number;
  listJobLogs: (jobId: string, afterId?: number) => JobLogRecord[];
};

const mapJobRow = (row: Record<string, unknown> | undefined): JobRecord | null => {
  if (!row) {
    return null;
  }
  return {
    id: String(row.id),
    source: row.source as JobSource,
    mode: row.mode as JobMode,
    status: row.status as JobStatus,
    createdAt: Number(row.createdAt),
    startedAt: row.startedAt === null ? null : Number(row.startedAt),
    finishedAt: row.finishedAt === null ? null : Number(row.finishedAt),
    durationMs: row.durationMs === null ? null : Number(row.durationMs),
    error: row.error === null ? null : String(row.error),
  };
};

const mapJobInputRow = (row: Record<string, unknown> | undefined): JobInputRecord | null => {
  if (!row) {
    return null;
  }
  return {
    jobId: String(row.jobId),
    userId: String(row.userId),
    tagsCsv: String(row.tagsCsv),
    inputMode: row.inputMode as "files" | "folder",
    inputPaths: String(row.inputPaths),
    dbPath: row.dbPath === null ? null : String(row.dbPath),
  };
};

const mapJobOutputRow = (row: Record<string, unknown> | undefined): JobOutputRecord | null => {
  if (!row) {
    return null;
  }
  return {
    jobId: String(row.jobId),
    convertedCount: Number(row.convertedCount),
    previewPath: row.previewPath === null ? null : String(row.previewPath),
    sqlPath: row.sqlPath === null ? null : String(row.sqlPath),
    backupPath: row.backupPath === null ? null : String(row.backupPath),
    appliedToDb: Number(row.appliedToDb),
  };
};

const mapLogRow = (row: Record<string, unknown>): JobLogRecord => ({
  id: Number(row.id),
  jobId: String(row.jobId),
  ts: Number(row.ts),
  level: row.level as JobLogRecord["level"],
  step: String(row.step),
  message: String(row.message),
});

export const createJobsRepository = (db: DbClient): JobsRepository => {
  const createJobStmt = db.prepare(
    [
      "INSERT INTO jobs (id, source, mode, status, createdAt, startedAt, finishedAt, durationMs, error)",
      "VALUES (@id, @source, @mode, @status, @createdAt, @startedAt, @finishedAt, @durationMs, @error)",
    ].join(" "),
  );
  const getJobStmt = db.prepare("SELECT * FROM jobs WHERE id = ?");
  const setStateStmt = db.prepare("UPDATE jobs SET status = ?, error = ? WHERE id = ?");
  const setStartedStmt = db.prepare("UPDATE jobs SET startedAt = ? WHERE id = ?");
  const setFinishedStmt = db.prepare(
    "UPDATE jobs SET finishedAt = ?, durationMs = ?, status = ?, error = ? WHERE id = ?",
  );
  const upsertInputStmt = db.prepare(
    [
      "INSERT INTO job_inputs (jobId, userId, tagsCsv, inputMode, inputPaths, dbPath)",
      "VALUES (@jobId, @userId, @tagsCsv, @inputMode, @inputPaths, @dbPath)",
      "ON CONFLICT(jobId) DO UPDATE SET",
      "userId = excluded.userId,",
      "tagsCsv = excluded.tagsCsv,",
      "inputMode = excluded.inputMode,",
      "inputPaths = excluded.inputPaths,",
      "dbPath = excluded.dbPath",
    ].join(" "),
  );
  const getInputStmt = db.prepare("SELECT * FROM job_inputs WHERE jobId = ?");
  const upsertOutputStmt = db.prepare(
    [
      "INSERT INTO job_outputs (jobId, convertedCount, previewPath, sqlPath, backupPath, appliedToDb)",
      "VALUES (@jobId, @convertedCount, @previewPath, @sqlPath, @backupPath, @appliedToDb)",
      "ON CONFLICT(jobId) DO UPDATE SET",
      "convertedCount = excluded.convertedCount,",
      "previewPath = excluded.previewPath,",
      "sqlPath = excluded.sqlPath,",
      "backupPath = excluded.backupPath,",
      "appliedToDb = excluded.appliedToDb",
    ].join(" "),
  );
  const getOutputStmt = db.prepare("SELECT * FROM job_outputs WHERE jobId = ?");
  const addLogStmt = db.prepare(
    "INSERT INTO job_logs (jobId, ts, level, step, message) VALUES (@jobId, @ts, @level, @step, @message)",
  );
  const listLogsStmt = db.prepare("SELECT * FROM job_logs WHERE jobId = ? ORDER BY id ASC");
  const listLogsAfterStmt = db.prepare("SELECT * FROM job_logs WHERE jobId = ? AND id > ? ORDER BY id ASC");

  const buildListJobsSql = (filters: JobFilters): { sql: string; values: unknown[] } => {
    const where: string[] = [];
    const values: unknown[] = [];
    if (filters.status) {
      where.push("status = ?");
      values.push(filters.status);
    }
    if (filters.source) {
      where.push("source = ?");
      values.push(filters.source);
    }
    if (filters.mode) {
      where.push("mode = ?");
      values.push(filters.mode);
    }
    if (typeof filters.fromTs === "number") {
      where.push("createdAt >= ?");
      values.push(filters.fromTs);
    }
    if (typeof filters.toTs === "number") {
      where.push("createdAt <= ?");
      values.push(filters.toTs);
    }

    const sqlParts = ["SELECT * FROM jobs"];
    if (where.length > 0) {
      sqlParts.push(`WHERE ${where.join(" AND ")}`);
    }
    sqlParts.push("ORDER BY createdAt DESC");
    sqlParts.push("LIMIT ? OFFSET ?");
    values.push(filters.limit ?? 100, filters.offset ?? 0);
    return {
      sql: sqlParts.join(" "),
      values,
    };
  };

  const createJob = (job: JobRecord): void => {
    createJobStmt.run(job);
  };

  const getJobById = (id: string): JobRecord | null => {
    return mapJobRow(getJobStmt.get(id) as Record<string, unknown> | undefined);
  };

  const listJobs = (filters: JobFilters = {}): JobRecord[] => {
    const query = buildListJobsSql(filters);
    const stmt = db.prepare(query.sql);
    const rows = stmt.all(...query.values) as Record<string, unknown>[];
    return rows.map((row) => mapJobRow(row)).filter((row): row is JobRecord => row !== null);
  };

  const updateJobState = (id: string, status: JobStatus, error: string | null): void => {
    setStateStmt.run(status, error, id);
  };

  const markJobStarted = (id: string, startedAt: number): void => {
    setStartedStmt.run(startedAt, id);
  };

  const markJobFinished = (
    id: string,
    finishedAt: number,
    durationMs: number,
    status: JobStatus,
    error: string | null,
  ): void => {
    setFinishedStmt.run(finishedAt, durationMs, status, error, id);
  };

  const upsertJobInput = (input: JobInputRecord): void => {
    upsertInputStmt.run(input);
  };

  const getJobInput = (jobId: string): JobInputRecord | null => {
    return mapJobInputRow(getInputStmt.get(jobId) as Record<string, unknown> | undefined);
  };

  const upsertJobOutput = (output: JobOutputRecord): void => {
    upsertOutputStmt.run(output);
  };

  const patchJobOutput = (jobId: string, patch: Partial<JobOutputRecord>): void => {
    const existing = getJobOutput(jobId);
    const baseline: JobOutputRecord =
      existing ?? {
        jobId,
        convertedCount: 0,
        previewPath: null,
        sqlPath: null,
        backupPath: null,
        appliedToDb: 0,
      };
    upsertJobOutput({
      ...baseline,
      ...patch,
      jobId,
    });
  };

  const getJobOutput = (jobId: string): JobOutputRecord | null => {
    return mapJobOutputRow(getOutputStmt.get(jobId) as Record<string, unknown> | undefined);
  };

  const appendJobLog = (log: Omit<JobLogRecord, "id">): number => {
    const result = addLogStmt.run(log);
    return Number(result.lastInsertRowid);
  };

  const listJobLogs = (jobId: string, afterId?: number): JobLogRecord[] => {
    const rows = (typeof afterId === "number"
      ? listLogsAfterStmt.all(jobId, afterId)
      : listLogsStmt.all(jobId)) as Record<string, unknown>[];
    return rows.map(mapLogRow);
  };

  return {
    createJob,
    getJobById,
    listJobs,
    updateJobState,
    markJobStarted,
    markJobFinished,
    upsertJobInput,
    getJobInput,
    upsertJobOutput,
    patchJobOutput,
    getJobOutput,
    appendJobLog,
    listJobLogs,
  };
};
