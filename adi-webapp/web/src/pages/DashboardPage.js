import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "../api/client";
export const DashboardPage = () => {
    const [health, setHealth] = useState(null);
    const [jobs, setJobs] = useState([]);
    const [error, setError] = useState(null);
    useEffect(() => {
        const load = async () => {
            try {
                setError(null);
                const [healthData, jobsData] = await Promise.all([
                    apiGet("/api/health"),
                    apiGet("/api/jobs?limit=50"),
                ]);
                setHealth(healthData);
                setJobs(jobsData);
            }
            catch (loadError) {
                setError(loadError instanceof Error ? loadError.message : "Failed to load dashboard.");
            }
        };
        void load();
    }, []);
    const totals = useMemo(() => {
        return {
            total: jobs.length,
            running: jobs.filter((job) => ["queued", "precheck", "converting", "db_importing"].includes(job.status)).length,
            failed: jobs.filter((job) => job.status.startsWith("failed_")).length,
            completed: jobs.filter((job) => job.status === "completed").length,
        };
    }, [jobs]);
    return (_jsxs("section", { className: "page", children: [_jsxs("div", { className: "panel", children: [_jsx("h2", { children: "System Snapshot" }), _jsx("p", { children: "Track runtime health and import throughput at a glance." })] }), error ? _jsx("div", { className: "panel error-text", children: error }) : null, _jsxs("div", { className: "panel meta-grid", children: [_jsxs("article", { className: "meta-card", children: [_jsx("p", { className: "meta-label", children: "Total Jobs" }), _jsx("p", { className: "meta-value", children: totals.total })] }), _jsxs("article", { className: "meta-card", children: [_jsx("p", { className: "meta-label", children: "Running" }), _jsx("p", { className: "meta-value", children: totals.running })] }), _jsxs("article", { className: "meta-card", children: [_jsx("p", { className: "meta-label", children: "Completed" }), _jsx("p", { className: "meta-value", children: totals.completed })] }), _jsxs("article", { className: "meta-card", children: [_jsx("p", { className: "meta-label", children: "Failed" }), _jsx("p", { className: "meta-value", children: totals.failed })] })] }), _jsxs("div", { className: "panel", children: [_jsx("h3", { children: "Health" }), health ? (_jsxs("div", { className: "meta-grid", style: { marginTop: "0.7rem" }, children: [_jsxs("article", { className: "meta-card", children: [_jsx("p", { className: "meta-label", children: "API Status" }), _jsx("p", { className: "meta-value", children: health.status })] }), _jsxs("article", { className: "meta-card", children: [_jsx("p", { className: "meta-label", children: "Node Env" }), _jsx("p", { className: "meta-value", children: health.nodeEnv })] }), _jsxs("article", { className: "meta-card", children: [_jsx("p", { className: "meta-label", children: "Uptime" }), _jsxs("p", { className: "meta-value", children: [health.uptimeSeconds, "s"] })] })] })) : (_jsx("p", { children: "Loading health details..." }))] }), _jsxs("div", { className: "panel", children: [_jsxs("div", { className: "button-row", style: { justifyContent: "space-between" }, children: [_jsx("h3", { children: "Recent Jobs" }), _jsx(Link, { to: "/wizard", children: _jsx("button", { type: "button", children: "New Import" }) })] }), _jsx("div", { className: "table-wrap", style: { marginTop: "0.6rem" }, children: _jsxs("table", { children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Job ID" }), _jsx("th", { children: "Source" }), _jsx("th", { children: "Mode" }), _jsx("th", { children: "Status" }), _jsx("th", { children: "Action" })] }) }), _jsxs("tbody", { children: [jobs.slice(0, 8).map((job) => (_jsxs("tr", { children: [_jsx("td", { children: job.id.slice(0, 8) }), _jsx("td", { children: job.source }), _jsx("td", { children: job.mode }), _jsx("td", { children: _jsx("span", { className: job.status.startsWith("failed_") ? "chip fail" : "chip", children: job.status }) }), _jsx("td", { children: _jsx(Link, { to: `/jobs/${job.id}`, children: "View" }) })] }, job.id))), jobs.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 5, children: "No jobs yet." }) })) : null] })] }) })] })] }));
};
