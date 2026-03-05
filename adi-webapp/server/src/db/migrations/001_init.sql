CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  mode TEXT NOT NULL,
  status TEXT NOT NULL,
  createdAt INTEGER NOT NULL,
  startedAt INTEGER,
  finishedAt INTEGER,
  durationMs INTEGER,
  error TEXT
);

CREATE TABLE IF NOT EXISTS job_inputs (
  jobId TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  tagsCsv TEXT NOT NULL,
  inputMode TEXT NOT NULL,
  inputPaths TEXT NOT NULL,
  dbPath TEXT,
  FOREIGN KEY (jobId) REFERENCES jobs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS job_outputs (
  jobId TEXT PRIMARY KEY,
  convertedCount INTEGER NOT NULL DEFAULT 0,
  previewPath TEXT,
  sqlPath TEXT,
  backupPath TEXT,
  appliedToDb INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (jobId) REFERENCES jobs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS job_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  jobId TEXT NOT NULL,
  ts INTEGER NOT NULL,
  level TEXT NOT NULL,
  step TEXT NOT NULL,
  message TEXT NOT NULL,
  FOREIGN KEY (jobId) REFERENCES jobs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_jobs_status_createdAt ON jobs(status, createdAt);
CREATE INDEX IF NOT EXISTS idx_jobs_source_createdAt ON jobs(source, createdAt);
CREATE INDEX IF NOT EXISTS idx_job_logs_jobId_ts ON job_logs(jobId, ts);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  valueJson TEXT NOT NULL,
  updatedAt INTEGER NOT NULL
);
