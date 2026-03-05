export type ApiError = {
  code: string;
  message: string;
};

export type ApiResponse<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      error: ApiError;
    };

export type JobStatus =
  | "queued"
  | "precheck"
  | "converting"
  | "preview_ready"
  | "sql_ready"
  | "db_importing"
  | "completed"
  | "failed_precheck"
  | "failed_convert"
  | "failed_sql"
  | "failed_db"
  | "cancelled";

export type JobSource = "chatgpt" | "claude" | "grok" | "aistudio";
export type JobMode = "sql" | "direct_db";

export type JobSummary = {
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

export type JobDetail = JobSummary & {
  input: {
    jobId: string;
    userId: string;
    tagsCsv: string;
    inputMode: "files" | "folder";
    inputPaths: string;
    dbPath: string | null;
  } | null;
  output: {
    jobId: string;
    convertedCount: number;
    previewPath: string | null;
    sqlPath: string | null;
    backupPath: string | null;
    appliedToDb: number;
  } | null;
  timeline: Array<{
    id: number;
    jobId: string;
    ts: number;
    level: "debug" | "info" | "warning" | "error";
    step: string;
    message: string;
  }>;
};
