import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "../api/client";
import type { JobSummary } from "../types";

type HealthData = {
  status: string;
  uptimeSeconds: number;
  now: string;
  nodeEnv: string;
  importerRoot: string;
};

export const DashboardPage = (): JSX.Element => {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async (): Promise<void> => {
      try {
        setError(null);
        const [healthData, jobsData] = await Promise.all([
          apiGet<HealthData>("/api/health"),
          apiGet<JobSummary[]>("/api/jobs?limit=50"),
        ]);
        setHealth(healthData);
        setJobs(jobsData);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load dashboard.");
      }
    };
    void load();
  }, []);

  const totals = useMemo(() => {
    return {
      total: jobs.length,
      running: jobs.filter((job) => ["queued", "precheck", "converting", "db_importing"].includes(job.status)).length,
      failed: jobs.filter((job) => job.status.startsWith("failed_")).length,
      completed: jobs.filter((job) => job.status === "completed").length,
    };
  }, [jobs]);

  return (
    <section className="page">
      <div className="panel">
        <h2>System Snapshot</h2>
        <p>Track runtime health and import throughput at a glance.</p>
      </div>

      {error ? <div className="panel error-text">{error}</div> : null}

      <div className="panel meta-grid">
        <article className="meta-card">
          <p className="meta-label">Total Jobs</p>
          <p className="meta-value">{totals.total}</p>
        </article>
        <article className="meta-card">
          <p className="meta-label">Running</p>
          <p className="meta-value">{totals.running}</p>
        </article>
        <article className="meta-card">
          <p className="meta-label">Completed</p>
          <p className="meta-value">{totals.completed}</p>
        </article>
        <article className="meta-card">
          <p className="meta-label">Failed</p>
          <p className="meta-value">{totals.failed}</p>
        </article>
      </div>

      <div className="panel">
        <h3>Health</h3>
        {health ? (
          <div className="meta-grid" style={{ marginTop: "0.7rem" }}>
            <article className="meta-card">
              <p className="meta-label">API Status</p>
              <p className="meta-value">{health.status}</p>
            </article>
            <article className="meta-card">
              <p className="meta-label">Node Env</p>
              <p className="meta-value">{health.nodeEnv}</p>
            </article>
            <article className="meta-card">
              <p className="meta-label">Uptime</p>
              <p className="meta-value">{health.uptimeSeconds}s</p>
            </article>
          </div>
        ) : (
          <p>Loading health details...</p>
        )}
      </div>

      <div className="panel">
        <div className="button-row" style={{ justifyContent: "space-between" }}>
          <h3>Recent Jobs</h3>
          <Link to="/wizard">
            <button type="button">New Import</button>
          </Link>
        </div>
        <div className="table-wrap" style={{ marginTop: "0.6rem" }}>
          <table>
            <thead>
              <tr>
                <th>Job ID</th>
                <th>Source</th>
                <th>Mode</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {jobs.slice(0, 8).map((job) => (
                <tr key={job.id}>
                  <td>{job.id.slice(0, 8)}</td>
                  <td>{job.source}</td>
                  <td>{job.mode}</td>
                  <td>
                    <span className={job.status.startsWith("failed_") ? "chip fail" : "chip"}>{job.status}</span>
                  </td>
                  <td>
                    <Link to={`/jobs/${job.id}`}>View</Link>
                  </td>
                </tr>
              ))}
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={5}>No jobs yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};
