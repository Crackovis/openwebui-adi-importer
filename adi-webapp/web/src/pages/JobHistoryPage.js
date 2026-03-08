import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "../api/client";
const initialFilters = {
    status: "",
    source: "",
    mode: "",
};
const formatTimestamp = (value) => {
    return new Date(value).toLocaleString();
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
export const JobHistoryPage = () => {
    const [filters, setFilters] = useState(initialFilters);
    const [jobs, setJobs] = useState([]);
    const [error, setError] = useState(null);
    useEffect(() => {
        const loadJobs = async () => {
            const params = new URLSearchParams();
            if (filters.status)
                params.set("status", filters.status);
            if (filters.source)
                params.set("source", filters.source);
            if (filters.mode)
                params.set("mode", filters.mode);
            params.set("limit", "200");
            try {
                setError(null);
                const data = await apiGet(`/api/jobs?${params.toString()}`);
                setJobs(data);
            }
            catch (loadError) {
                setError(loadError instanceof Error ? loadError.message : "Failed to load jobs.");
            }
        };
        void loadJobs();
    }, [filters]);
    return (_jsxs("section", { className: "page", children: [_jsxs("div", { className: "panel", children: [_jsx("h2", { children: "Job History" }), _jsx("p", { children: "Filter by state, source, or action to locate specific import runs." })] }), _jsxs("div", { className: "panel form-grid", children: [_jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "status", children: "Status" }), _jsxs("select", { id: "status", value: filters.status, onChange: (event) => setFilters((current) => ({
                                    ...current,
                                    status: event.target.value,
                                })), children: [_jsx("option", { value: "", children: "All" }), _jsx("option", { value: "queued", children: "queued" }), _jsx("option", { value: "precheck", children: "precheck" }), _jsx("option", { value: "converting", children: "converting" }), _jsx("option", { value: "preview_ready", children: "preview_ready" }), _jsx("option", { value: "sql_ready", children: "sql_ready" }), _jsx("option", { value: "db_importing", children: "db_importing" }), _jsx("option", { value: "completed", children: "completed" }), _jsx("option", { value: "failed_precheck", children: "failed_precheck" }), _jsx("option", { value: "failed_convert", children: "failed_convert" }), _jsx("option", { value: "failed_sql", children: "failed_sql" }), _jsx("option", { value: "failed_db", children: "failed_db" }), _jsx("option", { value: "cancelled", children: "cancelled" })] })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "source", children: "Source" }), _jsxs("select", { id: "source", value: filters.source, onChange: (event) => setFilters((current) => ({
                                    ...current,
                                    source: event.target.value,
                                })), children: [_jsx("option", { value: "", children: "All" }), _jsx("option", { value: "chatgpt", children: "chatgpt" }), _jsx("option", { value: "claude", children: "claude" }), _jsx("option", { value: "grok", children: "grok" }), _jsx("option", { value: "aistudio", children: "aistudio" })] })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "mode", children: "Action" }), _jsxs("select", { id: "mode", value: filters.mode, onChange: (event) => setFilters((current) => ({
                                    ...current,
                                    mode: event.target.value,
                                })), children: [_jsx("option", { value: "", children: "All" }), _jsx("option", { value: "convert_only", children: "convert_only" }), _jsx("option", { value: "sql", children: "sql" }), _jsx("option", { value: "direct_db", children: "direct_db" })] })] })] }), error ? _jsx("div", { className: "panel error-text", children: error }) : null, _jsx("div", { className: "panel table-wrap", children: _jsxs("table", { children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Job" }), _jsx("th", { children: "Created" }), _jsx("th", { children: "Source" }), _jsx("th", { children: "Action" }), _jsx("th", { children: "Status" }), _jsx("th", { children: "Open" })] }) }), _jsxs("tbody", { children: [jobs.map((job) => (_jsxs("tr", { children: [_jsx("td", { children: job.id.slice(0, 8) }), _jsx("td", { children: formatTimestamp(job.createdAt) }), _jsx("td", { children: job.source }), _jsx("td", { children: formatAction(job.mode) }), _jsx("td", { children: _jsx("span", { className: job.status.startsWith("failed_") ? "chip fail" : "chip", children: job.status }) }), _jsx("td", { children: _jsx(Link, { to: `/jobs/${job.id}`, children: "Open" }) })] }, job.id))), jobs.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 6, children: "No jobs match current filters." }) })) : null] })] }) })] }));
};
