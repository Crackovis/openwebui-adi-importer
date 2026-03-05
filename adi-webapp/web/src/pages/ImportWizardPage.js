import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiPost, apiPostForm } from "../api/client";
const STEP_TITLES = ["Source", "Input", "Parameters", "Mode", "Review"];
const initialForm = {
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
const parseLines = (value) => {
    return value
        .split(/\r?\n/)
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
};
const parseTags = (value) => {
    return value
        .split(",")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
};
export const ImportWizardPage = () => {
    const [step, setStep] = useState(0);
    const [form, setForm] = useState(initialForm);
    const [showAdvancedOverrides, setShowAdvancedOverrides] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [discoveryResult, setDiscoveryResult] = useState(null);
    const [discoveryError, setDiscoveryError] = useState(null);
    const [discovering, setDiscovering] = useState(false);
    const [submitError, setSubmitError] = useState(null);
    const [createdJob, setCreatedJob] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const inputPaths = useMemo(() => parseLines(form.inputText), [form.inputText]);
    const tags = useMemo(() => parseTags(form.tagsText), [form.tagsText]);
    const goNext = () => setStep((current) => Math.min(current + 1, STEP_TITLES.length - 1));
    const goBack = () => setStep((current) => Math.max(current - 1, 0));
    const runDiscovery = async () => {
        setDiscovering(true);
        setDiscoveryError(null);
        try {
            const payload = {
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
            const result = await apiPost("/api/openwebui/discovery", payload);
            setDiscoveryResult(result);
        }
        catch (error) {
            setDiscoveryError(error instanceof Error ? error.message : "Failed to run OpenWebUI discovery.");
        }
        finally {
            setDiscovering(false);
        }
    };
    const runJob = async () => {
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
                const uploaded = await apiPostForm("/api/upload/batch", formData);
                resolvedInputPaths = uploaded.files.map((file) => file.path);
            }
            if (resolvedInputPaths.length === 0) {
                throw new Error("Provide at least one input file path or upload files.");
            }
            const optionalUserId = form.userId.trim();
            const optionalBaseUrl = form.openWebUiBaseUrl.trim();
            const optionalAuthToken = form.openWebUiAuthToken.trim();
            const optionalDbPath = form.dbPath.trim();
            const basePayload = {
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
            const payload = form.mode === "direct_db"
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
            const created = await apiPost("/api/jobs", payload);
            setCreatedJob(created);
        }
        catch (error) {
            setSubmitError(error instanceof Error ? error.message : "Failed to start job.");
        }
        finally {
            setSubmitting(false);
        }
    };
    return (_jsxs("section", { className: "page", children: [_jsxs("div", { className: "panel", children: [_jsx("h2", { children: "Import Wizard" }), _jsx("p", { children: "Guide each import from source selection to safe execution." })] }), _jsxs("div", { className: "panel", children: [_jsx("div", { className: "button-row", style: { marginBottom: "0.7rem" }, children: STEP_TITLES.map((title, index) => (_jsxs("span", { className: index === step ? "chip" : "chip fail", children: [index + 1, ". ", title] }, title))) }), step === 0 ? (_jsx("div", { className: "form-grid", children: _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "source", children: "Source" }), _jsxs("select", { id: "source", value: form.source, onChange: (event) => setForm((current) => ({ ...current, source: event.target.value })), children: [_jsx("option", { value: "chatgpt", children: "ChatGPT" }), _jsx("option", { value: "claude", children: "Claude" }), _jsx("option", { value: "grok", children: "Grok" }), _jsx("option", { value: "aistudio", children: "AI Studio" })] })] }) })) : null, step === 1 ? (_jsxs("div", { className: "form-grid", children: [_jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "input-mode", children: "Input Mode" }), _jsxs("select", { id: "input-mode", value: form.inputMode, onChange: (event) => setForm((current) => ({ ...current, inputMode: event.target.value })), children: [_jsx("option", { value: "files", children: "Files" }), _jsx("option", { value: "folder", children: "Folder" })] })] }), _jsxs("div", { className: "field", style: { gridColumn: "1 / -1" }, children: [_jsx("label", { htmlFor: "upload-files", children: "Upload files (recommended)" }), _jsx("input", { id: "upload-files", type: "file", multiple: true, onChange: (event) => setSelectedFiles(Array.from(event.target.files ?? [])) }), _jsxs("small", { style: { color: "#a8b4c7" }, children: ["Selected: ", selectedFiles.length, " file(s). If files are selected, uploaded paths are used."] })] }), _jsxs("div", { className: "field", style: { gridColumn: "1 / -1" }, children: [_jsx("label", { htmlFor: "paths", children: "Paths (one per line)" }), _jsx("textarea", { id: "paths", value: form.inputText, onChange: (event) => setForm((current) => ({ ...current, inputText: event.target.value })), placeholder: form.inputMode === "files" ? "C:\\exports\\chat-1.json" : "C:\\exports\\batch-folder" })] })] })) : null, step === 2 ? (_jsxs("div", { className: "form-grid", children: [_jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "tags", children: "Custom Tags (comma separated)" }), _jsx("input", { id: "tags", value: form.tagsText, onChange: (event) => setForm((current) => ({ ...current, tagsText: event.target.value })), placeholder: "project-alpha, migration" })] }), _jsx("div", { className: "field", style: { gridColumn: "1 / -1" }, children: _jsx("small", { style: { color: "#a8b4c7" }, children: "OpenWebUI user and database are auto-detected by default. Use advanced overrides only when auto-detection fails." }) }), _jsx("div", { className: "field", style: { gridColumn: "1 / -1" }, children: _jsxs("label", { htmlFor: "advanced-overrides", style: { display: "flex", alignItems: "center", gap: "0.5rem" }, children: [_jsx("input", { id: "advanced-overrides", type: "checkbox", checked: showAdvancedOverrides, onChange: (event) => setShowAdvancedOverrides(event.target.checked) }), "Use advanced OpenWebUI overrides"] }) }), showAdvancedOverrides ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "user-id", children: "OpenWebUI User ID Override (optional)" }), _jsx("input", { id: "user-id", value: form.userId, onChange: (event) => setForm((current) => ({ ...current, userId: event.target.value })), placeholder: "uuid-from-openwebui" })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "openwebui-url", children: "OpenWebUI Base URL Override (optional)" }), _jsx("input", { id: "openwebui-url", value: form.openWebUiBaseUrl, onChange: (event) => setForm((current) => ({ ...current, openWebUiBaseUrl: event.target.value })), placeholder: "http://127.0.0.1:42004" })] }), _jsxs("div", { className: "field", style: { gridColumn: "1 / -1" }, children: [_jsx("label", { htmlFor: "openwebui-token", children: "OpenWebUI Token/API key (optional)" }), _jsx("input", { id: "openwebui-token", type: "password", value: form.openWebUiAuthToken, onChange: (event) => setForm((current) => ({ ...current, openWebUiAuthToken: event.target.value })), placeholder: "Bearer token or sk-..." })] })] })) : null, _jsx("div", { className: "field", style: { gridColumn: "1 / -1" }, children: _jsx("button", { type: "button", className: "secondary", onClick: () => void runDiscovery(), disabled: discovering || submitting, children: discovering ? "Checking..." : "Test Auto-Detection" }) }), discoveryError ? (_jsx("div", { className: "field", style: { gridColumn: "1 / -1" }, children: _jsx("p", { className: "error-text", style: { marginTop: 0, marginBottom: 0 }, children: discoveryError }) })) : null, discoveryResult ? (_jsxs("div", { className: "field", style: { gridColumn: "1 / -1" }, children: [_jsxs("div", { className: "meta-grid", children: [_jsxs("article", { className: "meta-card", children: [_jsx("p", { className: "meta-label", children: "Discovery status" }), _jsx("p", { className: "meta-value", children: discoveryResult.ok ? "ready" : "needs override" })] }), _jsxs("article", { className: "meta-card", children: [_jsx("p", { className: "meta-label", children: "Resolved user" }), _jsx("p", { className: "meta-value", children: discoveryResult.resolvedUserId ?? "-" })] }), _jsxs("article", { className: "meta-card", children: [_jsx("p", { className: "meta-label", children: "Resolved OpenWebUI URL" }), _jsx("p", { className: "meta-value", children: discoveryResult.resolvedOpenWebUiBaseUrl ?? "-" })] }), _jsxs("article", { className: "meta-card", children: [_jsx("p", { className: "meta-label", children: "Resolved DB path" }), _jsx("p", { className: "meta-value", children: discoveryResult.resolvedDbPath ?? "-" })] })] }), discoveryResult.issues.length > 0 ? (_jsx("ul", { style: { marginTop: "0.6rem", marginBottom: 0, paddingLeft: "1rem", color: "#f3bd76" }, children: discoveryResult.issues.map((issue) => (_jsx("li", { children: issue.message }, `${issue.code}-${issue.path ?? "none"}`))) })) : null] })) : null] })) : null, step === 3 ? (_jsxs("div", { className: "form-grid", children: [_jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "mode", children: "Import Mode" }), _jsxs("select", { id: "mode", value: form.mode, onChange: (event) => setForm((current) => ({ ...current, mode: event.target.value })), children: [_jsx("option", { value: "sql", children: "SQL only" }), _jsx("option", { value: "direct_db", children: "Direct DB import" })] })] }), form.mode === "direct_db" ? (_jsxs(_Fragment, { children: [_jsx("div", { className: "field", style: { gridColumn: "1 / -1" }, children: _jsx("small", { style: { color: "#a8b4c7" }, children: "Direct DB mode tries automatic database path detection first." }) }), showAdvancedOverrides ? (_jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "db-path", children: "Target webui.db path override (optional)" }), _jsx("input", { id: "db-path", value: form.dbPath, onChange: (event) => setForm((current) => ({ ...current, dbPath: event.target.value })), placeholder: "C:\\\\open-webui\\\\webui.db" })] })) : null, _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "confirm", children: "Type CONFIRM_DB_WRITE" }), _jsx("input", { id: "confirm", value: form.confirmationText, onChange: (event) => setForm((current) => ({ ...current, confirmationText: event.target.value })), placeholder: "CONFIRM_DB_WRITE" })] })] })) : null] })) : null, step === 4 ? (_jsxs("div", { className: "meta-grid", children: [_jsxs("article", { className: "meta-card", children: [_jsx("p", { className: "meta-label", children: "Source" }), _jsx("p", { className: "meta-value", children: form.source })] }), _jsxs("article", { className: "meta-card", children: [_jsx("p", { className: "meta-label", children: "Input count" }), _jsx("p", { className: "meta-value", children: inputPaths.length })] }), _jsxs("article", { className: "meta-card", children: [_jsx("p", { className: "meta-label", children: "User ID" }), _jsx("p", { className: "meta-value", children: form.userId.trim() ? "manual override" : "auto-detect" })] }), _jsxs("article", { className: "meta-card", children: [_jsx("p", { className: "meta-label", children: "Mode" }), _jsx("p", { className: "meta-value", children: form.mode })] })] })) : null, _jsxs("div", { className: "button-row", style: { marginTop: "1rem" }, children: [_jsx("button", { type: "button", className: "secondary", onClick: goBack, disabled: step === 0 || submitting, children: "Back" }), step < STEP_TITLES.length - 1 ? (_jsx("button", { type: "button", onClick: goNext, disabled: submitting, children: "Next" })) : (_jsx("button", { type: "button", onClick: () => void runJob(), disabled: submitting, children: submitting ? "Starting..." : "Run Import" }))] }), submitError ? _jsx("p", { className: "error-text", style: { marginTop: "0.6rem" }, children: submitError }) : null, createdJob ? (_jsxs("p", { style: { marginTop: "0.6rem" }, children: ["Job created: ", _jsx(Link, { to: `/jobs/${createdJob.id}`, children: createdJob.id })] })) : null] })] }));
};
