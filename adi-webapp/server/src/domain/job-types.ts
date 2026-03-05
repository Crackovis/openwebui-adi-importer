export const JOB_SOURCES = ["chatgpt", "claude", "grok", "aistudio"] as const;
export type JobSource = (typeof JOB_SOURCES)[number];

export const JOB_MODES = ["sql", "direct_db"] as const;
export type JobMode = (typeof JOB_MODES)[number];

export const JOB_STATUSES = [
  "queued",
  "precheck",
  "converting",
  "preview_ready",
  "sql_ready",
  "db_importing",
  "completed",
  "failed_precheck",
  "failed_convert",
  "failed_sql",
  "failed_db",
  "cancelled",
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];
