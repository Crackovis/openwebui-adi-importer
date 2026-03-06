import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { apiGet, apiPut } from "../api/client";
const sizeUnitOptions = [
    { value: "bytes", label: "Bytes" },
    { value: "kib", label: "KiB" },
    { value: "mib", label: "MiB" },
    { value: "gib", label: "GiB" },
];
const timeUnitOptions = [
    { value: "ms", label: "ms" },
    { value: "s", label: "s" },
    { value: "min", label: "min" },
];
const sizeUnitFactors = {
    bytes: 1,
    kib: 1024,
    mib: 1024 * 1024,
    gib: 1024 * 1024 * 1024,
};
const timeUnitFactors = {
    ms: 1,
    s: 1000,
    min: 60_000,
};
const pickSizeUnit = (bytes) => {
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
const pickTimeUnit = (milliseconds) => {
    if (milliseconds >= timeUnitFactors.min) {
        return "min";
    }
    if (milliseconds >= timeUnitFactors.s) {
        return "s";
    }
    return "ms";
};
const toDisplayValue = (baseValue, factor) => {
    if (!Number.isFinite(baseValue) || baseValue <= 0) {
        return 0;
    }
    return Number((baseValue / factor).toFixed(2));
};
const toBaseValue = (displayValue, factor) => {
    if (!Number.isFinite(displayValue) || displayValue <= 0) {
        return 0;
    }
    return Math.round(displayValue * factor);
};
const buildSizeState = (bytes) => {
    const unit = pickSizeUnit(bytes);
    return { unit, value: toDisplayValue(bytes, sizeUnitFactors[unit]) };
};
const buildTimeState = (milliseconds) => {
    const unit = pickTimeUnit(milliseconds);
    return { unit, value: toDisplayValue(milliseconds, timeUnitFactors[unit]) };
};
const defaultSettings = {
    pythonBin: "python",
    importerRoot: "../openwebui-importer",
    maxInputFiles: 200,
    maxInputTotalBytes: 104857600,
    subprocessTimeoutMs: 120000,
};
const formatMib = (bytes) => {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
};
export const SettingsPage = () => {
    const [form, setForm] = useState(defaultSettings);
    const [maxInputSizeUnit, setMaxInputSizeUnit] = useState(() => pickSizeUnit(defaultSettings.maxInputTotalBytes));
    const [maxInputSizeValue, setMaxInputSizeValue] = useState(() => toDisplayValue(defaultSettings.maxInputTotalBytes, sizeUnitFactors[pickSizeUnit(defaultSettings.maxInputTotalBytes)]));
    const [timeoutUnit, setTimeoutUnit] = useState(() => pickTimeUnit(defaultSettings.subprocessTimeoutMs));
    const [timeoutValue, setTimeoutValue] = useState(() => toDisplayValue(defaultSettings.subprocessTimeoutMs, timeUnitFactors[pickTimeUnit(defaultSettings.subprocessTimeoutMs)]));
    const [error, setError] = useState(null);
    const [saved, setSaved] = useState(false);
    useEffect(() => {
        const loadSettings = async () => {
            try {
                const data = await apiGet("/api/settings");
                setForm(data);
                const sizeState = buildSizeState(data.maxInputTotalBytes);
                setMaxInputSizeUnit(sizeState.unit);
                setMaxInputSizeValue(sizeState.value);
                const timeState = buildTimeState(data.subprocessTimeoutMs);
                setTimeoutUnit(timeState.unit);
                setTimeoutValue(timeState.value);
                setError(null);
            }
            catch (loadError) {
                setError(loadError instanceof Error ? loadError.message : "Failed to load settings.");
            }
        };
        void loadSettings();
    }, []);
    const save = async () => {
        try {
            setSaved(false);
            await apiPut("/api/settings", form);
            setSaved(true);
            setError(null);
        }
        catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : "Failed to save settings.");
        }
    };
    return (_jsxs("section", { className: "page", children: [_jsxs("div", { className: "panel", children: [_jsx("h2", { children: "Settings" }), _jsx("p", { children: "Configure runtime paths and safety limits." })] }), _jsxs("div", { className: "panel form-grid", children: [_jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "python-bin", children: "Python Binary" }), _jsx("input", { id: "python-bin", value: form.pythonBin, onChange: (event) => setForm((current) => ({ ...current, pythonBin: event.target.value })) })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "importer-root", children: "Importer Root" }), _jsx("input", { id: "importer-root", value: form.importerRoot, onChange: (event) => setForm((current) => ({ ...current, importerRoot: event.target.value })) })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "max-files", children: "Max Input Files (count)" }), _jsx("input", { id: "max-files", type: "number", value: form.maxInputFiles, min: 1, step: 1, onChange: (event) => setForm((current) => ({ ...current, maxInputFiles: Number(event.target.value) || 0 })) }), _jsx("small", { style: { color: "#a8b4c7" }, children: "Applies to upload and pre-check file count." })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "max-bytes", children: "Max Input Size" }), _jsxs("div", { className: "input-row", children: [_jsx("input", { id: "max-bytes", type: "number", value: maxInputSizeValue, min: 1, step: maxInputSizeUnit === "bytes" ? 1 : 0.1, onChange: (event) => {
                                            const nextValue = Number(event.target.value);
                                            setMaxInputSizeValue(nextValue);
                                            setForm((current) => ({
                                                ...current,
                                                maxInputTotalBytes: toBaseValue(nextValue, sizeUnitFactors[maxInputSizeUnit]),
                                            }));
                                        } }), _jsx("select", { id: "max-bytes-unit", value: maxInputSizeUnit, onChange: (event) => {
                                            const nextUnit = event.target.value;
                                            setMaxInputSizeUnit(nextUnit);
                                            setMaxInputSizeValue(toDisplayValue(form.maxInputTotalBytes, sizeUnitFactors[nextUnit]));
                                        }, children: sizeUnitOptions.map((option) => (_jsx("option", { value: option.value, children: option.label }, option.value))) })] }), _jsxs("small", { style: { color: "#a8b4c7" }, children: ["Stored as ", form.maxInputTotalBytes, " bytes (current limit: ", formatMib(form.maxInputTotalBytes), ")."] })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "timeout", children: "Subprocess Timeout" }), _jsxs("div", { className: "input-row", children: [_jsx("input", { id: "timeout", type: "number", value: timeoutValue, min: 1, step: timeoutUnit === "ms" ? 1 : 0.1, onChange: (event) => {
                                            const nextValue = Number(event.target.value);
                                            setTimeoutValue(nextValue);
                                            setForm((current) => ({
                                                ...current,
                                                subprocessTimeoutMs: toBaseValue(nextValue, timeUnitFactors[timeoutUnit]),
                                            }));
                                        } }), _jsx("select", { id: "timeout-unit", value: timeoutUnit, onChange: (event) => {
                                            const nextUnit = event.target.value;
                                            setTimeoutUnit(nextUnit);
                                            setTimeoutValue(toDisplayValue(form.subprocessTimeoutMs, timeUnitFactors[nextUnit]));
                                        }, children: timeUnitOptions.map((option) => (_jsx("option", { value: option.value, children: option.label }, option.value))) })] }), _jsxs("small", { style: { color: "#a8b4c7" }, children: ["Stored as ", form.subprocessTimeoutMs, " ms."] })] })] }), _jsxs("div", { className: "panel button-row", children: [_jsx("button", { type: "button", onClick: () => void save(), children: "Save Settings" }), saved ? _jsx("span", { className: "chip", children: "Saved" }) : null, error ? _jsx("span", { className: "error-text", children: error }) : null] })] }));
};
