import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiPost, apiPostForm } from "../api/client";
import type { JobMode, JobSource } from "../types";

const STEP_TITLES = ["Source", "Input", "Parameters", "Mode", "Review"];

type WizardForm = {
  source: JobSource;
  inputMode: "files" | "folder";
  inputText: string;
  userId: string;
  openWebUiBaseUrl: string;
  openWebUiAuthToken: string;
  tagsText: string;
  mode: JobMode;
  dbPath: string;
  confirmationText: string;
};

type JobRequestBase = {
  source: JobSource;
  inputMode: "files" | "folder";
  inputPaths: string[];
  tags: string[];
  userId?: string;
  openWebUiBaseUrl?: string;
  openWebUiAuthToken?: string;
};

type SqlJobRequest = JobRequestBase & {
  mode: "sql";
};

type DirectDbJobRequest = JobRequestBase & {
  mode: "direct_db";
  confirmationText: string;
  dbPath?: string;
};

type CreateJobResponse = {
  id: string;
  status: string;
  createdAt: number;
};

type UploadBatchResponse = {
  count: number;
  files: Array<{
    originalName: string;
    storedName: string;
    path: string;
    size: number;
  }>;
};

type OpenWebUiDiscoveryRequest = {
  mode: JobMode;
  userId?: string;
  dbPath?: string;
  openWebUiBaseUrl?: string;
  openWebUiDataDir?: string;
  openWebUiAuthToken?: string;
  openWebUiApiKey?: string;
};

type OpenWebUiDiscoveryResponse = {
  ok: boolean;
  resolvedUserId?: string;
  resolvedOpenWebUiBaseUrl?: string;
  resolvedDbPath?: string;
  issues: Array<{
    code: string;
    message: string;
    path?: string;
  }>;
};

const initialForm: WizardForm = {
  source: "chatgpt",
  inputMode: "files",
  inputText: "",
  userId: "",
  openWebUiBaseUrl: "",
  openWebUiAuthToken: "",
  tagsText: "",
  mode: "sql",
  dbPath: "",
  confirmationText: "",
};

const parseLines = (value: string): string[] => {
  return value
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
};

const parseTags = (value: string): string[] => {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
};

export const ImportWizardPage = (): JSX.Element => {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<WizardForm>(initialForm);
  const [showAdvancedOverrides, setShowAdvancedOverrides] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [discoveryResult, setDiscoveryResult] = useState<OpenWebUiDiscoveryResponse | null>(null);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);
  const [discovering, setDiscovering] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdJob, setCreatedJob] = useState<CreateJobResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const inputPaths = useMemo(() => parseLines(form.inputText), [form.inputText]);
  const tags = useMemo(() => parseTags(form.tagsText), [form.tagsText]);

  const goNext = (): void => setStep((current) => Math.min(current + 1, STEP_TITLES.length - 1));
  const goBack = (): void => setStep((current) => Math.max(current - 1, 0));

  const runDiscovery = async (): Promise<void> => {
    setDiscovering(true);
    setDiscoveryError(null);

    try {
      const payload: OpenWebUiDiscoveryRequest = {
        mode: form.mode,
      };

      const optionalUserId = form.userId.trim();
      const optionalBaseUrl = form.openWebUiBaseUrl.trim();
      const optionalAuthToken = form.openWebUiAuthToken.trim();
      const optionalDbPath = form.dbPath.trim();

      if (optionalUserId) {
        payload.userId = optionalUserId;
      }
      if (optionalBaseUrl) {
        payload.openWebUiBaseUrl = optionalBaseUrl;
      }
      if (optionalAuthToken) {
        payload.openWebUiAuthToken = optionalAuthToken;
      }
      if (optionalDbPath) {
        payload.dbPath = optionalDbPath;
      }

      const result = await apiPost<OpenWebUiDiscoveryResponse, OpenWebUiDiscoveryRequest>(
        "/api/openwebui/discovery",
        payload,
      );
      setDiscoveryResult(result);
    } catch (error) {
      setDiscoveryError(error instanceof Error ? error.message : "Failed to run OpenWebUI discovery.");
    } finally {
      setDiscovering(false);
    }
  };

  const runJob = async (): Promise<void> => {
    setSubmitting(true);
    setSubmitError(null);
    setCreatedJob(null);

    try {
      let resolvedInputPaths = inputPaths;

      if (selectedFiles.length > 0) {
        const formData = new FormData();
        for (const file of selectedFiles) {
          formData.append("files", file);
        }

        const uploaded = await apiPostForm<UploadBatchResponse>("/api/upload/batch", formData);
        resolvedInputPaths = uploaded.files.map((file) => file.path);
      }

      if (resolvedInputPaths.length === 0) {
        throw new Error("Provide at least one input file path or upload files.");
      }

      const optionalUserId = form.userId.trim();
      const optionalBaseUrl = form.openWebUiBaseUrl.trim();
      const optionalAuthToken = form.openWebUiAuthToken.trim();
      const optionalDbPath = form.dbPath.trim();

      const basePayload: JobRequestBase = {
        source: form.source,
        inputMode: form.inputMode,
        inputPaths: resolvedInputPaths,
        tags,
      };
      if (optionalUserId) {
        basePayload.userId = optionalUserId;
      }
      if (optionalBaseUrl) {
        basePayload.openWebUiBaseUrl = optionalBaseUrl;
      }
      if (optionalAuthToken) {
        basePayload.openWebUiAuthToken = optionalAuthToken;
      }

      const payload: SqlJobRequest | DirectDbJobRequest =
        form.mode === "direct_db"
          ? {
              ...basePayload,
              mode: "direct_db",
              confirmationText: form.confirmationText,
              ...(optionalDbPath ? { dbPath: optionalDbPath } : {}),
            }
          : {
              ...basePayload,
              mode: "sql",
            };

      const created = await apiPost<CreateJobResponse, SqlJobRequest | DirectDbJobRequest>("/api/jobs", payload);
      setCreatedJob(created);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to start job.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="page">
      <div className="panel">
        <h2>Import Wizard</h2>
        <p>Guide each import from source selection to safe execution.</p>
        <p style={{ marginTop: "0.5rem", color: "#a8b4c7" }}>
          The pipeline first converts ChatGPT, Claude, Grok, or AI Studio exports into OpenWebUI-style JSON, then
          continues with SQL generation or direct DB import.
        </p>
      </div>

      <div className="panel">
        <div className="button-row" style={{ marginBottom: "0.7rem" }}>
          {STEP_TITLES.map((title, index) => (
            <span className={index === step ? "chip" : "chip fail"} key={title}>
              {index + 1}. {title}
            </span>
          ))}
        </div>

        {step === 0 ? (
          <div className="form-grid">
            <div className="field">
              <label htmlFor="source">Source</label>
              <select
                id="source"
                value={form.source}
                onChange={(event) => setForm((current) => ({ ...current, source: event.target.value as JobSource }))}
              >
                <option value="chatgpt">ChatGPT</option>
                <option value="claude">Claude</option>
                <option value="grok">Grok</option>
                <option value="aistudio">AI Studio</option>
              </select>
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="form-grid">
            <div className="field">
              <label htmlFor="input-mode">Input Mode</label>
              <select
                id="input-mode"
                value={form.inputMode}
                onChange={(event) =>
                  setForm((current) => ({ ...current, inputMode: event.target.value as "files" | "folder" }))
                }
              >
                <option value="files">Files</option>
                <option value="folder">Folder</option>
              </select>
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="upload-files">Upload files (recommended)</label>
              <input
                id="upload-files"
                type="file"
                multiple
                onChange={(event) => setSelectedFiles(Array.from(event.target.files ?? []))}
              />
              <small style={{ color: "#a8b4c7" }}>
                Selected: {selectedFiles.length} file(s). If files are selected, uploaded paths are used.
              </small>
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="paths">Paths (one per line)</label>
              <textarea
                id="paths"
                value={form.inputText}
                onChange={(event) => setForm((current) => ({ ...current, inputText: event.target.value }))}
                placeholder={form.inputMode === "files" ? "C:\\exports\\chat-1.json" : "C:\\exports\\batch-folder"}
              />
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="form-grid">
            <div className="field">
              <label htmlFor="tags">Custom Tags (comma separated)</label>
              <input
                id="tags"
                value={form.tagsText}
                onChange={(event) => setForm((current) => ({ ...current, tagsText: event.target.value }))}
                placeholder="project-alpha, migration"
              />
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <small style={{ color: "#a8b4c7" }}>
                OpenWebUI user and database are auto-detected by default. Use advanced overrides only when auto-detection fails.
              </small>
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="advanced-overrides" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <input
                  id="advanced-overrides"
                  type="checkbox"
                  checked={showAdvancedOverrides}
                  onChange={(event) => setShowAdvancedOverrides(event.target.checked)}
                />
                Use advanced OpenWebUI overrides
              </label>
            </div>

            {showAdvancedOverrides ? (
              <>
                <div className="field">
                  <label htmlFor="user-id">OpenWebUI User ID Override (optional)</label>
                  <input
                    id="user-id"
                    value={form.userId}
                    onChange={(event) => setForm((current) => ({ ...current, userId: event.target.value }))}
                    placeholder="uuid-from-openwebui"
                  />
                </div>
                <div className="field">
                  <label htmlFor="openwebui-url">OpenWebUI Base URL Override (optional)</label>
                  <input
                    id="openwebui-url"
                    value={form.openWebUiBaseUrl}
                    onChange={(event) => setForm((current) => ({ ...current, openWebUiBaseUrl: event.target.value }))}
                    placeholder="http://127.0.0.1:42004"
                  />
                </div>
                <div className="field" style={{ gridColumn: "1 / -1" }}>
                  <label htmlFor="openwebui-token">OpenWebUI Token/API key (optional)</label>
                  <input
                    id="openwebui-token"
                    type="password"
                    value={form.openWebUiAuthToken}
                    onChange={(event) => setForm((current) => ({ ...current, openWebUiAuthToken: event.target.value }))}
                    placeholder="Bearer token or sk-..."
                  />
                </div>
              </>
            ) : null}

            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <button
                type="button"
                className="secondary"
                onClick={() => void runDiscovery()}
                disabled={discovering || submitting}
              >
                {discovering ? "Checking..." : "Test Auto-Detection"}
              </button>
            </div>

            {discoveryError ? (
              <div className="field" style={{ gridColumn: "1 / -1" }}>
                <p className="error-text" style={{ marginTop: 0, marginBottom: 0 }}>
                  {discoveryError}
                </p>
              </div>
            ) : null}

            {discoveryResult ? (
              <div className="field" style={{ gridColumn: "1 / -1" }}>
                <div className="meta-grid">
                  <article className="meta-card">
                    <p className="meta-label">Discovery status</p>
                    <p className="meta-value">{discoveryResult.ok ? "ready" : "needs override"}</p>
                  </article>
                  <article className="meta-card">
                    <p className="meta-label">Resolved user</p>
                    <p className="meta-value">{discoveryResult.resolvedUserId ?? "-"}</p>
                  </article>
                  <article className="meta-card">
                    <p className="meta-label">Resolved OpenWebUI URL</p>
                    <p className="meta-value">{discoveryResult.resolvedOpenWebUiBaseUrl ?? "-"}</p>
                  </article>
                  <article className="meta-card">
                    <p className="meta-label">Resolved DB path</p>
                    <p className="meta-value">{discoveryResult.resolvedDbPath ?? "-"}</p>
                  </article>
                </div>
                {discoveryResult.issues.length > 0 ? (
                  <ul style={{ marginTop: "0.6rem", marginBottom: 0, paddingLeft: "1rem", color: "#f3bd76" }}>
                    {discoveryResult.issues.map((issue) => (
                      <li key={`${issue.code}-${issue.path ?? "none"}`}>{issue.message}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {step === 3 ? (
          <div className="form-grid">
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <small style={{ color: "#a8b4c7" }}>
                Both modes run conversion first and keep preview artifacts for inspection.
              </small>
            </div>
            <div className="field">
              <label htmlFor="mode">Import Mode</label>
              <select
                id="mode"
                value={form.mode}
                onChange={(event) => setForm((current) => ({ ...current, mode: event.target.value as JobMode }))}
              >
                <option value="sql">SQL only</option>
                <option value="direct_db">Direct DB import</option>
              </select>
            </div>

            {form.mode === "direct_db" ? (
              <>
                <div className="field" style={{ gridColumn: "1 / -1" }}>
                  <small style={{ color: "#a8b4c7" }}>
                    Direct DB mode tries automatic database path detection first.
                  </small>
                </div>
                {showAdvancedOverrides ? (
                  <div className="field">
                    <label htmlFor="db-path">Target webui.db path override (optional)</label>
                    <input
                      id="db-path"
                      value={form.dbPath}
                      onChange={(event) => setForm((current) => ({ ...current, dbPath: event.target.value }))}
                      placeholder="C:\\open-webui\\webui.db"
                    />
                  </div>
                ) : null}
                <div className="field">
                  <label htmlFor="confirm">Type CONFIRM_DB_WRITE</label>
                  <input
                    id="confirm"
                    value={form.confirmationText}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, confirmationText: event.target.value }))
                    }
                    placeholder="CONFIRM_DB_WRITE"
                  />
                </div>
              </>
            ) : null}
          </div>
        ) : null}

        {step === 4 ? (
          <div className="meta-grid">
            <article className="meta-card">
              <p className="meta-label">Source</p>
              <p className="meta-value">{form.source}</p>
            </article>
            <article className="meta-card">
              <p className="meta-label">Input count</p>
              <p className="meta-value">{inputPaths.length}</p>
            </article>
            <article className="meta-card">
              <p className="meta-label">User ID</p>
              <p className="meta-value">{form.userId.trim() ? "manual override" : "auto-detect"}</p>
            </article>
            <article className="meta-card">
              <p className="meta-label">Mode</p>
              <p className="meta-value">{form.mode}</p>
            </article>
          </div>
        ) : null}

        <div className="button-row" style={{ marginTop: "1rem" }}>
          <button type="button" className="secondary" onClick={goBack} disabled={step === 0 || submitting}>
            Back
          </button>
          {step < STEP_TITLES.length - 1 ? (
            <button type="button" onClick={goNext} disabled={submitting}>
              Next
            </button>
          ) : (
            <button type="button" onClick={() => void runJob()} disabled={submitting}>
              {submitting ? "Starting..." : "Run Import"}
            </button>
          )}
        </div>

        {submitError ? <p className="error-text" style={{ marginTop: "0.6rem" }}>{submitError}</p> : null}
        {createdJob ? (
          <p style={{ marginTop: "0.6rem" }}>
            Job created: <Link to={`/jobs/${createdJob.id}`}>{createdJob.id}</Link>
          </p>
        ) : null}
      </div>
    </section>
  );
};
