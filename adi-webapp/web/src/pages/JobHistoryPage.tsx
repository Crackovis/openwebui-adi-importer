import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "../api/client";
import type { JobMode, JobSource, JobStatus, JobSummary } from "../types";

type Filters = {
  status: JobStatus | "";
  source: JobSource | "";
  mode: JobMode | "";
};

const initialFilters: Filters = {
  status: "",
  source: "",
  mode: "",
};

const formatTimestamp = (value: number): string => {
  return new Date(value).toLocaleString();
};

const ACTION_LABELS: Record<JobMode, string> = {
  convert_only: "Convert only",
  sql: "Generate SQL",
  direct_db: "Direct DB import",
};

const formatAction = (mode: unknown): string => {
  if (mode === "convert_only" || mode === "sql" || mode === "direct_db") {
    return ACTION_LABELS[mode];
  }
  if (typeof mode === "string" && mode.trim().length > 0) {
    return `${mode} (legacy)`;
  }
  return "Generate SQL (legacy default)";
};

export const JobHistoryPage = (): JSX.Element => {
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadJobs = async (): Promise<void> => {
      const params = new URLSearchParams();
      if (filters.status) params.set("status", filters.status);
      if (filters.source) params.set("source", filters.source);
      if (filters.mode) params.set("mode", filters.mode);
      params.set("limit", "200");

      try {
        setError(null);
        const data = await apiGet<JobSummary[]>(`/api/jobs?${params.toString()}`);
        setJobs(data);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load jobs.");
      }
    };

    void loadJobs();
  }, [filters]);

  return (
    <section className="page">
      <div className="panel">
        <h2>Job History</h2>
        <p>Filter by state, source, or action to locate specific import runs.</p>
      </div>

      <div className="panel form-grid">
        <div className="field">
          <label htmlFor="status">Status</label>
          <select
            id="status"
            value={filters.status}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                status: event.target.value as Filters["status"],
              }))
            }
          >
            <option value="">All</option>
            <option value="queued">queued</option>
            <option value="precheck">precheck</option>
            <option value="converting">converting</option>
            <option value="preview_ready">preview_ready</option>
            <option value="sql_ready">sql_ready</option>
            <option value="db_importing">db_importing</option>
            <option value="completed">completed</option>
            <option value="failed_precheck">failed_precheck</option>
            <option value="failed_convert">failed_convert</option>
            <option value="failed_sql">failed_sql</option>
            <option value="failed_db">failed_db</option>
            <option value="cancelled">cancelled</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="source">Source</label>
          <select
            id="source"
            value={filters.source}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                source: event.target.value as Filters["source"],
              }))
            }
          >
            <option value="">All</option>
            <option value="chatgpt">chatgpt</option>
            <option value="claude">claude</option>
            <option value="grok">grok</option>
            <option value="aistudio">aistudio</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="mode">Action</label>
          <select
            id="mode"
            value={filters.mode}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                mode: event.target.value as Filters["mode"],
              }))
            }
          >
            <option value="">All</option>
            <option value="convert_only">convert_only</option>
            <option value="sql">sql</option>
            <option value="direct_db">direct_db</option>
          </select>
        </div>
      </div>

      {error ? <div className="panel error-text">{error}</div> : null}

      <div className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>Job</th>
              <th>Created</th>
              <th>Source</th>
              <th>Action</th>
              <th>Status</th>
              <th>Open</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id}>
                <td>{job.id.slice(0, 8)}</td>
                <td>{formatTimestamp(job.createdAt)}</td>
                <td>{job.source}</td>
                <td>{formatAction(job.mode)}</td>
                <td>
                  <span className={job.status.startsWith("failed_") ? "chip fail" : "chip"}>{job.status}</span>
                </td>
                <td>
                  <Link to={`/jobs/${job.id}`}>Open</Link>
                </td>
              </tr>
            ))}
            {jobs.length === 0 ? (
              <tr>
                <td colSpan={6}>No jobs match current filters.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
};
