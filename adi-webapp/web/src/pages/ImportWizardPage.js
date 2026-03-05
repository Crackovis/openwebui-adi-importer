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
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [submitError, setSubmitError] = useState(null);
    const [createdJob, setCreatedJob] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const inputPaths = useMemo(() => parseLines(form.inputText), [form.inputText]);
    const tags = useMemo(() => parseTags(form.tagsText), [form.tagsText]);
    const goNext = () => setStep((current) => Math.min(current + 1, STEP_TITLES.length - 1));
    const goBack = () => setStep((current) => Math.max(current - 1, 0));
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
            const payload = form.mode === "direct_db"
                ? {
                    source: form.source,
                    inputMode: form.inputMode,
                    inputPaths: resolvedInputPaths,
                    userId: form.userId,
                    tags,
                    mode: form.mode,
                    dbPath: form.dbPath,
                    confirmationText: form.confirmationText,
                }
                : {
                    source: form.source,
                    inputMode: form.inputMode,
                    inputPaths: resolvedInputPaths,
                    userId: form.userId,
                    tags,
                    mode: form.mode,
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
    return (_jsxs("section", { className: "page", children: [_jsxs("div", { className: "panel", children: [_jsx("h2", { children: "Import Wizard" }), _jsx("p", { children: "Guide each import from source selection to safe execution." })] }), _jsxs("div", { className: "panel", children: [_jsx("div", { className: "button-row", style: { marginBottom: "0.7rem" }, children: STEP_TITLES.map((title, index) => (_jsxs("span", { className: index === step ? "chip" : "chip fail", children: [index + 1, ". ", title] }, title))) }), step === 0 ? (_jsx("div", { className: "form-grid", children: _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "source", children: "Source" }), _jsxs("select", { id: "source", value: form.source, onChange: (event) => setForm((current) => ({ ...current, source: event.target.value })), children: [_jsx("option", { value: "chatgpt", children: "ChatGPT" }), _jsx("option", { value: "claude", children: "Claude" }), _jsx("option", { value: "grok", children: "Grok" }), _jsx("option", { value: "aistudio", children: "AI Studio" })] })] }) })) : null, step === 1 ? (_jsxs("div", { className: "form-grid", children: [_jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "input-mode", children: "Input Mode" }), _jsxs("select", { id: "input-mode", value: form.inputMode, onChange: (event) => setForm((current) => ({ ...current, inputMode: event.target.value })), children: [_jsx("option", { value: "files", children: "Files" }), _jsx("option", { value: "folder", children: "Folder" })] })] }), _jsxs("div", { className: "field", style: { gridColumn: "1 / -1" }, children: [_jsx("label", { htmlFor: "upload-files", children: "Upload files (recommended)" }), _jsx("input", { id: "upload-files", type: "file", multiple: true, onChange: (event) => setSelectedFiles(Array.from(event.target.files ?? [])) }), _jsxs("small", { style: { color: "#a8b4c7" }, children: ["Selected: ", selectedFiles.length, " file(s). If files are selected, uploaded paths are used."] })] }), _jsxs("div", { className: "field", style: { gridColumn: "1 / -1" }, children: [_jsx("label", { htmlFor: "paths", children: "Paths (one per line)" }), _jsx("textarea", { id: "paths", value: form.inputText, onChange: (event) => setForm((current) => ({ ...current, inputText: event.target.value })), placeholder: form.inputMode === "files" ? "C:\\exports\\chat-1.json" : "C:\\exports\\batch-folder" })] })] })) : null, step === 2 ? (_jsxs("div", { className: "form-grid", children: [_jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "user-id", children: "OpenWebUI User ID" }), _jsx("input", { id: "user-id", value: form.userId, onChange: (event) => setForm((current) => ({ ...current, userId: event.target.value })), placeholder: "uuid-from-webui-db" })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "tags", children: "Custom Tags (comma separated)" }), _jsx("input", { id: "tags", value: form.tagsText, onChange: (event) => setForm((current) => ({ ...current, tagsText: event.target.value })), placeholder: "project-alpha, migration" })] })] })) : null, step === 3 ? (_jsxs("div", { className: "form-grid", children: [_jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "mode", children: "Import Mode" }), _jsxs("select", { id: "mode", value: form.mode, onChange: (event) => setForm((current) => ({ ...current, mode: event.target.value })), children: [_jsx("option", { value: "sql", children: "SQL only" }), _jsx("option", { value: "direct_db", children: "Direct DB import" })] })] }), form.mode === "direct_db" ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "db-path", children: "Target webui.db path" }), _jsx("input", { id: "db-path", value: form.dbPath, onChange: (event) => setForm((current) => ({ ...current, dbPath: event.target.value })), placeholder: "C:\\\\open-webui\\\\webui.db" })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "confirm", children: "Type CONFIRM_DB_WRITE" }), _jsx("input", { id: "confirm", value: form.confirmationText, onChange: (event) => setForm((current) => ({ ...current, confirmationText: event.target.value })), placeholder: "CONFIRM_DB_WRITE" })] })] })) : null] })) : null, step === 4 ? (_jsxs("div", { className: "meta-grid", children: [_jsxs("article", { className: "meta-card", children: [_jsx("p", { className: "meta-label", children: "Source" }), _jsx("p", { className: "meta-value", children: form.source })] }), _jsxs("article", { className: "meta-card", children: [_jsx("p", { className: "meta-label", children: "Input count" }), _jsx("p", { className: "meta-value", children: inputPaths.length })] }), _jsxs("article", { className: "meta-card", children: [_jsx("p", { className: "meta-label", children: "User ID" }), _jsx("p", { className: "meta-value", children: form.userId || "-" })] }), _jsxs("article", { className: "meta-card", children: [_jsx("p", { className: "meta-label", children: "Mode" }), _jsx("p", { className: "meta-value", children: form.mode })] })] })) : null, _jsxs("div", { className: "button-row", style: { marginTop: "1rem" }, children: [_jsx("button", { type: "button", className: "secondary", onClick: goBack, disabled: step === 0 || submitting, children: "Back" }), step < STEP_TITLES.length - 1 ? (_jsx("button", { type: "button", onClick: goNext, disabled: submitting, children: "Next" })) : (_jsx("button", { type: "button", onClick: () => void runJob(), disabled: submitting, children: submitting ? "Starting..." : "Run Import" }))] }), submitError ? _jsx("p", { className: "error-text", style: { marginTop: "0.6rem" }, children: submitError }) : null, createdJob ? (_jsxs("p", { style: { marginTop: "0.6rem" }, children: ["Job created: ", _jsx(Link, { to: `/jobs/${createdJob.id}`, children: createdJob.id })] })) : null] })] }));
};
