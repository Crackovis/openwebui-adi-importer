import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiGet } from "../api/client";
import { useJobStream } from "../features/job-stream/useJobStream";
import { retryJob, type RetryJobResponse } from "../features/jobs/retryJob";
import type { JobDetail, JobStatus } from "../types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8787";
const RETRY_CONFIRMATION_TEXT = "CONFIRM_DB_WRITE";

const terminalStatuses = new Set<JobStatus>([
  "completed",
  "failed_precheck",
  "failed_convert",
  "failed_sql",
  "failed_db",
  "cancelled",
]);

const retryableStatuses = new Set<JobStatus>(["failed_precheck", "failed_convert", "failed_sql", "failed_db"]);

const isTerminalStatus = (status: JobStatus): boolean => {
  return terminalStatuses.has(status);
};

const isRetryableStatus = (status: JobStatus): boolean => {
  return retryableStatuses.has(status);
};

const parseInputPaths = (raw: string | undefined): string[] => {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const formatTime = (value: number): string => {
  return new Date(value).toLocaleString();
};

const mergeLogs = (
  storedLogs: JobDetail["timeline"],
  streamedLogs: JobDetail["timeline"],
): JobDetail["timeline"] => {
  const byId = new Map<number, JobDetail["timeline"][number]>();
  for (const entry of storedLogs) {
    byId.set(entry.id, entry);
  }
  for (const entry of streamedLogs) {
    byId.set(entry.id, entry);
  }
  return [...byId.values()].sort((a, b) => a.id - b.id);
};

export const JobDetailPage = (): JSX.Element => {
  const { id } = useParams<{ id: string }>();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryConfirmation, setRetryConfirmation] = useState("");
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [retryResult, setRetryResult] = useState<RetryJobResponse | null>(null);

  const stream = useJobStream(id, Boolean(id));

  useEffect(() => {
    if (!id) {
      return;
    }

    let isMounted = true;
    const load = async (): Promise<void> => {
      try {
        const detail = await apiGet<JobDetail>(`/api/jobs/${id}`);
        if (isMounted) {
          setJob(detail);
          setError(null);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load job details.");
        }
      }
    };

    void load();
    const timer = setInterval(() => void load(), 3000);

    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [id]);

  useEffect(() => {
    setRetryConfirmation("");
    setRetryError(null);
    setRetryResult(null);
  }, [id]);

  const inputPaths = useMemo(() => parseInputPaths(job?.input?.inputPaths), [job?.input?.inputPaths]);
  const timeline = useMemo(
    () => mergeLogs(job?.timeline ?? [], stream.logs),
    [job?.timeline, stream.logs],
  );

  const status = stream.status ?? job?.status ?? null;
  const canRetry = job ? isRetryableStatus(job.status) : false;
  const directDbRetry = job?.mode === "direct_db";
  const retryDisabled =
    retrying ||
    !job ||
    (directDbRetry && retryConfirmation.trim() !== RETRY_CONFIRMATION_TEXT);

  const handleRetry = async (): Promise<void> => {
    if (!job) {
      return;
    }

    setRetrying(true);
    setRetryError(null);
    setRetryResult(null);

    try {
      const result = await retryJob(job.id, {
        confirmationText: directDbRetry ? retryConfirmation.trim() : undefined,
      });
      setRetryResult(result);
    } catch (actionError) {
      setRetryError(actionError instanceof Error ? actionError.message : "Failed to queue retry.");
    } finally {
      setRetrying(false);
    }
  };

  return (
    <section className="page">
      <div className="panel">
        <h2>Job Detail</h2>
        <p>Inspect timeline, artifacts, and import execution output.</p>
      </div>

      {error ? <div className="panel error-text">{error}</div> : null}
      {stream.streamError ? <div className="panel error-text">{stream.streamError}</div> : null}

      {job ? (
        <>
          <div className="panel meta-grid">
            <article className="meta-card">
              <p className="meta-label">Job ID</p>
              <p className="meta-value">{job.id.slice(0, 8)}</p>
            </article>
            <article className="meta-card">
              <p className="meta-label">Status</p>
              <p className="meta-value">{status ?? job.status}</p>
            </article>
            <article className="meta-card">
              <p className="meta-label">Source</p>
              <p className="meta-value">{job.source}</p>
            </article>
            <article className="meta-card">
              <p className="meta-label">Mode</p>
              <p className="meta-value">{job.mode}</p>
            </article>
          </div>

          <div className="panel">
            <h3>Inputs</h3>
            <p>User ID: {job.input?.userId ?? "-"}</p>
            <p>Input mode: {job.input?.inputMode ?? "-"}</p>
            <p>Tags CSV: {job.input?.tagsCsv ?? "-"}</p>
            <ul>
              {inputPaths.map((entry) => (
                <li key={entry}>{entry}</li>
              ))}
            </ul>
          </div>

          <div className="panel">
            <h3>Outputs</h3>
            <p>Converted count: {job.output?.convertedCount ?? 0}</p>
            <p>Preview path: {job.output?.previewPath ?? "-"}</p>
            <p>Backup path: {job.output?.backupPath ?? "-"}</p>
            <p>Applied to DB: {job.output?.appliedToDb ? "yes" : "no"}</p>
            {job.output?.sqlPath ? (
              <a href={`${API_BASE_URL}/api/jobs/${job.id}/artifacts/sql`} target="_blank" rel="noreferrer">
                Download SQL Artifact
              </a>
            ) : null}
          </div>

          {canRetry ? (
            <div className="panel">
              <h3>Retry Failed Job</h3>
              <p>Requeue this failed job with the same inputs and tags.</p>
              {directDbRetry ? (
                <div className="field" style={{ marginTop: "0.8rem" }}>
                  <label htmlFor="retry-confirm">Type {RETRY_CONFIRMATION_TEXT} to confirm retry</label>
                  <input
                    id="retry-confirm"
                    value={retryConfirmation}
                    onChange={(event) => setRetryConfirmation(event.target.value)}
                    placeholder={RETRY_CONFIRMATION_TEXT}
                  />
                </div>
              ) : null}

              <div className="button-row" style={{ marginTop: "0.8rem" }}>
                <button
                  type="button"
                  className="warning"
                  onClick={() => void handleRetry()}
                  disabled={retryDisabled}
                >
                  {retrying ? "Retrying..." : "Retry Job"}
                </button>
              </div>

              {retryError ? <p className="error-text" style={{ marginTop: "0.6rem" }}>{retryError}</p> : null}
              {retryResult ? (
                <p style={{ marginTop: "0.6rem" }}>
                  Retry queued as <Link to={`/jobs/${retryResult.id}`}>{retryResult.id}</Link>.
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="panel table-wrap">
            <div className="button-row" style={{ justifyContent: "space-between", marginBottom: "0.6rem" }}>
              <h3>Timeline Logs</h3>
              {stream.connected && status && !isTerminalStatus(status) ? <span className="chip">Live</span> : null}
            </div>
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Level</th>
                  <th>Step</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {timeline.map((log) => (
                  <tr key={log.id}>
                    <td>{formatTime(log.ts)}</td>
                    <td>{log.level}</td>
                    <td>{log.step}</td>
                    <td>{log.message}</td>
                  </tr>
                ))}
                {timeline.length === 0 ? (
                  <tr>
                    <td colSpan={4}>No logs yet.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="panel">Loading job details...</div>
      )}
    </section>
  );
};
