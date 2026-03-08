import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiGet } from "../api/client";
import { useJobStream } from "../features/job-stream/useJobStream";
import { retryJob } from "../features/jobs/retryJob";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8787";
const RETRY_CONFIRMATION_TEXT = "CONFIRM_DB_WRITE";
const terminalStatuses = new Set([
    "completed",
    "failed_precheck",
    "failed_convert",
    "failed_sql",
    "failed_db",
    "cancelled",
]);
const retryableStatuses = new Set(["failed_precheck", "failed_convert", "failed_sql", "failed_db"]);
const isTerminalStatus = (status) => {
    return terminalStatuses.has(status);
};
const isRetryableStatus = (status) => {
    return retryableStatuses.has(status);
};
const ACTION_LABELS = {
    convert_only: "Convert only",
    sql: "Generate SQL",
    direct_db: "Direct DB import",
};
const formatAction = (mode) => {
    if (mode === "convert_only" || mode === "sql" || mode === "direct_db") {
        return ACTION_LABELS[mode];
    }
    if (typeof mode === "string" && mode.trim().length > 0) {
        return `${mode} (legacy)`;
    }
    return "Generate SQL (legacy default)";
};
const actionOutputSummary = (mode) => {
    if (mode === "convert_only") {
        return "This action stops after conversion and preview artifact generation.";
    }
    if (mode === "sql") {
        return "This action runs conversion first, then generates a SQL artifact for manual DB application.";
    }
    if (mode === "direct_db") {
        return "This action runs conversion, generates SQL, then applies it directly to OpenWebUI after backup.";
    }
    return "This run completed with legacy action metadata. Check timeline logs for exact execution steps.";
};
const parseInputPaths = (raw) => {
    if (!raw) {
        return [];
    }
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    }
    catch {
        return [];
    }
};
const formatTime = (value) => {
    return new Date(value).toLocaleString();
};
const mergeLogs = (storedLogs, streamedLogs) => {
    const byId = new Map();
    for (const entry of storedLogs) {
        byId.set(entry.id, entry);
    }
    for (const entry of streamedLogs) {
        byId.set(entry.id, entry);
    }
    return [...byId.values()].sort((a, b) => a.id - b.id);
};
export const JobDetailPage = () => {
    const { id } = useParams();
    const [job, setJob] = useState(null);
    const [error, setError] = useState(null);
    const [retryConfirmation, setRetryConfirmation] = useState("");
    const [retrying, setRetrying] = useState(false);
    const [retryError, setRetryError] = useState(null);
    const [retryResult, setRetryResult] = useState(null);
    const stream = useJobStream(id, Boolean(id));
    useEffect(() => {
        if (!id) {
            return;
        }
        let isMounted = true;
        const load = async () => {
            try {
                const detail = await apiGet(`/api/jobs/${id}`);
                if (isMounted) {
                    setJob(detail);
                    setError(null);
                }
            }
            catch (loadError) {
                if (isMounted) {
                    setError(loadError instanceof Error ? loadError.message : "Failed to load job details.");
                }
            }
        };
        void load();
        const timer = setInterval(() => void load(), 3000);
        return () => {
            isMounted = false;
            clearInterval(timer);
        };
    }, [id]);
    useEffect(() => {
        setRetryConfirmation("");
        setRetryError(null);
        setRetryResult(null);
    }, [id]);
    const inputPaths = useMemo(() => parseInputPaths(job?.input?.inputPaths), [job?.input?.inputPaths]);
    const timeline = useMemo(() => mergeLogs(job?.timeline ?? [], stream.logs), [job?.timeline, stream.logs]);
    const status = stream.status ?? job?.status ?? null;
    const canRetry = job ? isRetryableStatus(job.status) : false;
    const directDbRetry = job?.mode === "direct_db";
    const retryDisabled = retrying ||
        !job ||
        (directDbRetry && retryConfirmation.trim() !== RETRY_CONFIRMATION_TEXT);
    const handleRetry = async () => {
        if (!job) {
            return;
        }
        setRetrying(true);
        setRetryError(null);
        setRetryResult(null);
        try {
            const result = await retryJob(job.id, {
                confirmationText: directDbRetry ? retryConfirmation.trim() : undefined,
            });
            setRetryResult(result);
        }
        catch (actionError) {
            setRetryError(actionError instanceof Error ? actionError.message : "Failed to queue retry.");
        }
        finally {
            setRetrying(false);
        }
    };
    return (_jsxs("section", { className: "page", children: [_jsxs("div", { className: "panel", children: [_jsx("h2", { children: "Job Detail" }), _jsx("p", { children: "Inspect timeline, artifacts, and import execution output." })] }), error ? _jsx("div", { className: "panel error-text", children: error }) : null, stream.streamError ? _jsx("div", { className: "panel error-text", children: stream.streamError }) : null, job ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "panel meta-grid", children: [_jsxs("article", { className: "meta-card", children: [_jsx("p", { className: "meta-label", children: "Job ID" }), _jsx("p", { className: "meta-value", children: job.id.slice(0, 8) })] }), _jsxs("article", { className: "meta-card", children: [_jsx("p", { className: "meta-label", children: "Status" }), _jsx("p", { className: "meta-value", children: status ?? job.status })] }), _jsxs("article", { className: "meta-card", children: [_jsx("p", { className: "meta-label", children: "Source" }), _jsx("p", { className: "meta-value", children: job.source })] }), _jsxs("article", { className: "meta-card", children: [_jsx("p", { className: "meta-label", children: "Action" }), _jsx("p", { className: "meta-value", children: formatAction(job.mode) })] })] }), _jsxs("div", { className: "panel", children: [_jsx("h3", { children: "Inputs" }), _jsxs("p", { children: ["User ID: ", job.input?.userId ?? "-"] }), _jsxs("p", { children: ["Input mode: ", job.input?.inputMode ?? "-"] }), _jsxs("p", { children: ["Tags CSV: ", job.input?.tagsCsv ?? "-"] }), _jsx("ul", { children: inputPaths.map((entry) => (_jsx("li", { children: entry }, entry))) })] }), _jsxs("div", { className: "panel", children: [_jsx("h3", { children: "Outputs" }), _jsx("p", { style: { color: "#a8b4c7" }, children: actionOutputSummary(job.mode) }), _jsxs("p", { children: ["Converted count: ", job.output?.convertedCount ?? 0] }), _jsxs("p", { children: ["Preview path: ", job.output?.previewPath ?? "-"] }), _jsxs("p", { children: ["Backup path: ", job.output?.backupPath ?? "-"] }), _jsxs("p", { children: ["Applied to DB: ", job.output?.appliedToDb ? "yes" : "no"] }), job.output?.previewPath ? (_jsx("p", { children: _jsx("a", { href: `${API_BASE_URL}/api/jobs/${job.id}/artifacts/preview`, target: "_blank", rel: "noreferrer", children: "Download Preview JSON" }) })) : null, job.output?.sqlPath ? (_jsx("a", { href: `${API_BASE_URL}/api/jobs/${job.id}/artifacts/sql`, target: "_blank", rel: "noreferrer", children: "Download SQL Artifact" })) : null] }), canRetry ? (_jsxs("div", { className: "panel", children: [_jsx("h3", { children: "Retry Failed Job" }), _jsx("p", { children: "Requeue this failed job with the same inputs and tags." }), directDbRetry ? (_jsxs("div", { className: "field", style: { marginTop: "0.8rem" }, children: [_jsxs("label", { htmlFor: "retry-confirm", children: ["Type ", RETRY_CONFIRMATION_TEXT, " to confirm retry"] }), _jsx("input", { id: "retry-confirm", value: retryConfirmation, onChange: (event) => setRetryConfirmation(event.target.value), placeholder: RETRY_CONFIRMATION_TEXT })] })) : null, _jsx("div", { className: "button-row", style: { marginTop: "0.8rem" }, children: _jsx("button", { type: "button", className: "warning", onClick: () => void handleRetry(), disabled: retryDisabled, children: retrying ? "Retrying..." : "Retry Job" }) }), retryError ? _jsx("p", { className: "error-text", style: { marginTop: "0.6rem" }, children: retryError }) : null, retryResult ? (_jsxs("p", { style: { marginTop: "0.6rem" }, children: ["Retry queued as ", _jsx(Link, { to: `/jobs/${retryResult.id}`, children: retryResult.id }), "."] })) : null] })) : null, _jsxs("div", { className: "panel table-wrap", children: [_jsxs("div", { className: "button-row", style: { justifyContent: "space-between", marginBottom: "0.6rem" }, children: [_jsx("h3", { children: "Timeline Logs" }), stream.connected && status && !isTerminalStatus(status) ? _jsx("span", { className: "chip", children: "Live" }) : null] }), _jsxs("table", { children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Time" }), _jsx("th", { children: "Level" }), _jsx("th", { children: "Step" }), _jsx("th", { children: "Message" })] }) }), _jsxs("tbody", { children: [timeline.map((log) => (_jsxs("tr", { children: [_jsx("td", { children: formatTime(log.ts) }), _jsx("td", { children: log.level }), _jsx("td", { children: log.step }), _jsx("td", { children: log.message })] }, log.id))), timeline.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 4, children: "No logs yet." }) })) : null] })] })] })] })) : (_jsx("div", { className: "panel", children: "Loading job details..." }))] }));
};
