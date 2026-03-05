import { useEffect, useState } from "react";
import { apiGet, apiPut } from "../api/client";

type SettingsForm = {
  pythonBin: string;
  importerRoot: string;
  maxInputFiles: number;
  maxInputTotalBytes: number;
  subprocessTimeoutMs: number;
};

const defaultSettings: SettingsForm = {
  pythonBin: "python",
  importerRoot: "../openwebui-importer",
  maxInputFiles: 200,
  maxInputTotalBytes: 104857600,
  subprocessTimeoutMs: 120000,
};

export const SettingsPage = (): JSX.Element => {
  const [form, setForm] = useState<SettingsForm>(defaultSettings);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const loadSettings = async (): Promise<void> => {
      try {
        const data = await apiGet<SettingsForm>("/api/settings");
        setForm(data);
        setError(null);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load settings.");
      }
    };
    void loadSettings();
  }, []);

  const save = async (): Promise<void> => {
    try {
      setSaved(false);
      await apiPut<SettingsForm, SettingsForm>("/api/settings", form);
      setSaved(true);
      setError(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save settings.");
    }
  };

  return (
    <section className="page">
      <div className="panel">
        <h2>Settings</h2>
        <p>Configure runtime paths and safety limits.</p>
      </div>

      <div className="panel form-grid">
        <div className="field">
          <label htmlFor="python-bin">Python Binary</label>
          <input
            id="python-bin"
            value={form.pythonBin}
            onChange={(event) => setForm((current) => ({ ...current, pythonBin: event.target.value }))}
          />
        </div>

        <div className="field">
          <label htmlFor="importer-root">Importer Root</label>
          <input
            id="importer-root"
            value={form.importerRoot}
            onChange={(event) => setForm((current) => ({ ...current, importerRoot: event.target.value }))}
          />
        </div>

        <div className="field">
          <label htmlFor="max-files">Max Input Files</label>
          <input
            id="max-files"
            type="number"
            value={form.maxInputFiles}
            onChange={(event) =>
              setForm((current) => ({ ...current, maxInputFiles: Number(event.target.value) || 0 }))
            }
          />
        </div>

        <div className="field">
          <label htmlFor="max-bytes">Max Input Bytes</label>
          <input
            id="max-bytes"
            type="number"
            value={form.maxInputTotalBytes}
            onChange={(event) =>
              setForm((current) => ({ ...current, maxInputTotalBytes: Number(event.target.value) || 0 }))
            }
          />
        </div>

        <div className="field">
          <label htmlFor="timeout">Subprocess Timeout (ms)</label>
          <input
            id="timeout"
            type="number"
            value={form.subprocessTimeoutMs}
            onChange={(event) =>
              setForm((current) => ({ ...current, subprocessTimeoutMs: Number(event.target.value) || 0 }))
            }
          />
        </div>
      </div>

      <div className="panel button-row">
        <button type="button" onClick={() => void save()}>
          Save Settings
        </button>
        {saved ? <span className="chip">Saved</span> : null}
        {error ? <span className="error-text">{error}</span> : null}
      </div>
    </section>
  );
};
