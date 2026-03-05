import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiPost } from "../api/client";
import type { JobMode, JobSource } from "../types";

const STEP_TITLES = ["Source", "Input", "Parameters", "Mode", "Review"];

type WizardForm = {
  source: JobSource;
  inputMode: "files" | "folder";
  inputText: string;
  userId: string;
  tagsText: string;
  mode: JobMode;
  dbPath: string;
  confirmationText: string;
};

type CreateJobResponse = {
  id: string;
  status: string;
  createdAt: number;
};

const initialForm: WizardForm = {
  source: "chatgpt",
  inputMode: "files",
  inputText: "",
  userId: "",
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
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdJob, setCreatedJob] = useState<CreateJobResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const inputPaths = useMemo(() => parseLines(form.inputText), [form.inputText]);
  const tags = useMemo(() => parseTags(form.tagsText), [form.tagsText]);

  const goNext = (): void => setStep((current) => Math.min(current + 1, STEP_TITLES.length - 1));
  const goBack = (): void => setStep((current) => Math.max(current - 1, 0));

  const runJob = async (): Promise<void> => {
    setSubmitting(true);
    setSubmitError(null);
    setCreatedJob(null);

    try {
      const payload =
        form.mode === "direct_db"
          ? {
              source: form.source,
              inputMode: form.inputMode,
              inputPaths,
              userId: form.userId,
              tags,
              mode: form.mode,
              dbPath: form.dbPath,
              confirmationText: form.confirmationText,
            }
          : {
              source: form.source,
              inputMode: form.inputMode,
              inputPaths,
              userId: form.userId,
              tags,
              mode: form.mode,
            };

      const created = await apiPost<CreateJobResponse, typeof payload>("/api/jobs", payload);
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
              <label htmlFor="user-id">OpenWebUI User ID</label>
              <input
                id="user-id"
                value={form.userId}
                onChange={(event) => setForm((current) => ({ ...current, userId: event.target.value }))}
                placeholder="uuid-from-webui-db"
              />
            </div>
            <div className="field">
              <label htmlFor="tags">Custom Tags (comma separated)</label>
              <input
                id="tags"
                value={form.tagsText}
                onChange={(event) => setForm((current) => ({ ...current, tagsText: event.target.value }))}
                placeholder="project-alpha, migration"
              />
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="form-grid">
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
                <div className="field">
                  <label htmlFor="db-path">Target webui.db path</label>
                  <input
                    id="db-path"
                    value={form.dbPath}
                    onChange={(event) => setForm((current) => ({ ...current, dbPath: event.target.value }))}
                    placeholder="C:\\open-webui\\webui.db"
                  />
                </div>
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
              <p className="meta-value">{form.userId || "-"}</p>
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
