import { useEffect, useState } from "react";
import { apiGet, apiPut } from "../api/client";

type SettingsForm = {
  pythonBin: string;
  importerRoot: string;
  maxInputFiles: number;
  maxInputTotalBytes: number;
  subprocessTimeoutMs: number;
};

type SizeUnit = "bytes" | "kib" | "mib" | "gib";
type TimeUnit = "ms" | "s" | "min";

const sizeUnitOptions: Array<{ value: SizeUnit; label: string }> = [
  { value: "bytes", label: "Bytes" },
  { value: "kib", label: "KiB" },
  { value: "mib", label: "MiB" },
  { value: "gib", label: "GiB" },
];

const timeUnitOptions: Array<{ value: TimeUnit; label: string }> = [
  { value: "ms", label: "ms" },
  { value: "s", label: "s" },
  { value: "min", label: "min" },
];

const sizeUnitFactors: Record<SizeUnit, number> = {
  bytes: 1,
  kib: 1024,
  mib: 1024 * 1024,
  gib: 1024 * 1024 * 1024,
};

const timeUnitFactors: Record<TimeUnit, number> = {
  ms: 1,
  s: 1000,
  min: 60_000,
};

const pickSizeUnit = (bytes: number): SizeUnit => {
  if (bytes >= sizeUnitFactors.gib) {
    return "gib";
  }
  if (bytes >= sizeUnitFactors.mib) {
    return "mib";
  }
  if (bytes >= sizeUnitFactors.kib) {
    return "kib";
  }
  return "bytes";
};

const pickTimeUnit = (milliseconds: number): TimeUnit => {
  if (milliseconds >= timeUnitFactors.min) {
    return "min";
  }
  if (milliseconds >= timeUnitFactors.s) {
    return "s";
  }
  return "ms";
};

const toDisplayValue = (baseValue: number, factor: number): number => {
  if (!Number.isFinite(baseValue) || baseValue <= 0) {
    return 0;
  }
  return Number((baseValue / factor).toFixed(2));
};

const toBaseValue = (displayValue: number, factor: number): number => {
  if (!Number.isFinite(displayValue) || displayValue <= 0) {
    return 0;
  }
  return Math.round(displayValue * factor);
};

const buildSizeState = (bytes: number): { value: number; unit: SizeUnit } => {
  const unit = pickSizeUnit(bytes);
  return { unit, value: toDisplayValue(bytes, sizeUnitFactors[unit]) };
};

const buildTimeState = (milliseconds: number): { value: number; unit: TimeUnit } => {
  const unit = pickTimeUnit(milliseconds);
  return { unit, value: toDisplayValue(milliseconds, timeUnitFactors[unit]) };
};

const defaultSettings: SettingsForm = {
  pythonBin: "python",
  importerRoot: "../openwebui-importer",
  maxInputFiles: 200,
  maxInputTotalBytes: 104857600,
  subprocessTimeoutMs: 120000,
};

const formatMib = (bytes: number): string => {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
};

export const SettingsPage = (): JSX.Element => {
  const [form, setForm] = useState<SettingsForm>(defaultSettings);
  const [maxInputSizeUnit, setMaxInputSizeUnit] = useState<SizeUnit>(() =>
    pickSizeUnit(defaultSettings.maxInputTotalBytes)
  );
  const [maxInputSizeValue, setMaxInputSizeValue] = useState<number>(() =>
    toDisplayValue(
      defaultSettings.maxInputTotalBytes,
      sizeUnitFactors[pickSizeUnit(defaultSettings.maxInputTotalBytes)]
    )
  );
  const [timeoutUnit, setTimeoutUnit] = useState<TimeUnit>(() => pickTimeUnit(defaultSettings.subprocessTimeoutMs));
  const [timeoutValue, setTimeoutValue] = useState<number>(() =>
    toDisplayValue(defaultSettings.subprocessTimeoutMs, timeUnitFactors[pickTimeUnit(defaultSettings.subprocessTimeoutMs)])
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const loadSettings = async (): Promise<void> => {
      try {
        const data = await apiGet<SettingsForm>("/api/settings");
        setForm(data);
        const sizeState = buildSizeState(data.maxInputTotalBytes);
        setMaxInputSizeUnit(sizeState.unit);
        setMaxInputSizeValue(sizeState.value);
        const timeState = buildTimeState(data.subprocessTimeoutMs);
        setTimeoutUnit(timeState.unit);
        setTimeoutValue(timeState.value);
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
          <label htmlFor="max-files">Max Input Files (count)</label>
          <input
            id="max-files"
            type="number"
            value={form.maxInputFiles}
            min={1}
            step={1}
            onChange={(event) =>
              setForm((current) => ({ ...current, maxInputFiles: Number(event.target.value) || 0 }))
            }
          />
          <small style={{ color: "#a8b4c7" }}>Applies to upload and pre-check file count.</small>
        </div>

        <div className="field">
          <label htmlFor="max-bytes">Max Input Size</label>
          <div className="input-row">
            <input
              id="max-bytes"
              type="number"
              value={maxInputSizeValue}
              min={1}
              step={maxInputSizeUnit === "bytes" ? 1 : 0.1}
              onChange={(event) => {
                const nextValue = Number(event.target.value);
                setMaxInputSizeValue(nextValue);
                setForm((current) => ({
                  ...current,
                  maxInputTotalBytes: toBaseValue(nextValue, sizeUnitFactors[maxInputSizeUnit]),
                }));
              }}
            />
            <select
              id="max-bytes-unit"
              value={maxInputSizeUnit}
              onChange={(event) => {
                const nextUnit = event.target.value as SizeUnit;
                setMaxInputSizeUnit(nextUnit);
                setMaxInputSizeValue(toDisplayValue(form.maxInputTotalBytes, sizeUnitFactors[nextUnit]));
              }}
            >
              {sizeUnitOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <small style={{ color: "#a8b4c7" }}>
            Stored as {form.maxInputTotalBytes} bytes (current limit: {formatMib(form.maxInputTotalBytes)}).
          </small>
        </div>

        <div className="field">
          <label htmlFor="timeout">Subprocess Timeout</label>
          <div className="input-row">
            <input
              id="timeout"
              type="number"
              value={timeoutValue}
              min={1}
              step={timeoutUnit === "ms" ? 1 : 0.1}
              onChange={(event) => {
                const nextValue = Number(event.target.value);
                setTimeoutValue(nextValue);
                setForm((current) => ({
                  ...current,
                  subprocessTimeoutMs: toBaseValue(nextValue, timeUnitFactors[timeoutUnit]),
                }));
              }}
            />
            <select
              id="timeout-unit"
              value={timeoutUnit}
              onChange={(event) => {
                const nextUnit = event.target.value as TimeUnit;
                setTimeoutUnit(nextUnit);
                setTimeoutValue(toDisplayValue(form.subprocessTimeoutMs, timeUnitFactors[nextUnit]));
              }}
            >
              {timeUnitOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <small style={{ color: "#a8b4c7" }}>Stored as {form.subprocessTimeoutMs} ms.</small>
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
