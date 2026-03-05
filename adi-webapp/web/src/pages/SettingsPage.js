import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { apiGet, apiPut } from "../api/client";
const defaultSettings = {
    pythonBin: "python",
    importerRoot: "../openwebui-importer",
    maxInputFiles: 200,
    maxInputTotalBytes: 104857600,
    subprocessTimeoutMs: 120000,
};
export const SettingsPage = () => {
    const [form, setForm] = useState(defaultSettings);
    const [error, setError] = useState(null);
    const [saved, setSaved] = useState(false);
    useEffect(() => {
        const loadSettings = async () => {
            try {
                const data = await apiGet("/api/settings");
                setForm(data);
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
    return (_jsxs("section", { className: "page", children: [_jsxs("div", { className: "panel", children: [_jsx("h2", { children: "Settings" }), _jsx("p", { children: "Configure runtime paths and safety limits." })] }), _jsxs("div", { className: "panel form-grid", children: [_jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "python-bin", children: "Python Binary" }), _jsx("input", { id: "python-bin", value: form.pythonBin, onChange: (event) => setForm((current) => ({ ...current, pythonBin: event.target.value })) })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "importer-root", children: "Importer Root" }), _jsx("input", { id: "importer-root", value: form.importerRoot, onChange: (event) => setForm((current) => ({ ...current, importerRoot: event.target.value })) })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "max-files", children: "Max Input Files" }), _jsx("input", { id: "max-files", type: "number", value: form.maxInputFiles, onChange: (event) => setForm((current) => ({ ...current, maxInputFiles: Number(event.target.value) || 0 })) })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "max-bytes", children: "Max Input Bytes" }), _jsx("input", { id: "max-bytes", type: "number", value: form.maxInputTotalBytes, onChange: (event) => setForm((current) => ({ ...current, maxInputTotalBytes: Number(event.target.value) || 0 })) })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "timeout", children: "Subprocess Timeout (ms)" }), _jsx("input", { id: "timeout", type: "number", value: form.subprocessTimeoutMs, onChange: (event) => setForm((current) => ({ ...current, subprocessTimeoutMs: Number(event.target.value) || 0 })) })] })] }), _jsxs("div", { className: "panel button-row", children: [_jsx("button", { type: "button", onClick: () => void save(), children: "Save Settings" }), saved ? _jsx("span", { className: "chip", children: "Saved" }) : null, error ? _jsx("span", { className: "error-text", children: error }) : null] })] }));
};
