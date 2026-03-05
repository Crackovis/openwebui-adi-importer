import { useEffect, useState } from "react";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8787";
const parseEventData = (value) => {
    try {
        return JSON.parse(value);
    }
    catch {
        return null;
    }
};
const mergeLogsById = (current, incoming) => {
    const byId = new Map();
    for (const log of current) {
        byId.set(log.id, log);
    }
    for (const log of incoming) {
        byId.set(log.id, log);
    }
    return [...byId.values()].sort((a, b) => a.id - b.id);
};
export const useJobStream = (jobId, enabled) => {
    const [logs, setLogs] = useState([]);
    const [status, setStatus] = useState(null);
    const [streamError, setStreamError] = useState(null);
    const [connected, setConnected] = useState(false);
    useEffect(() => {
        if (!jobId || !enabled) {
            setConnected(false);
            return;
        }
        setConnected(false);
        setStreamError(null);
        const stream = new EventSource(`${API_BASE_URL}/api/jobs/${jobId}/stream`);
        let isClosed = false;
        const handleSnapshot = (event) => {
            const payload = parseEventData(event.data);
            if (!payload) {
                return;
            }
            setLogs(payload.logs);
            setStatus(payload.job.status);
            setConnected(true);
        };
        const handleLog = (event) => {
            const payload = parseEventData(event.data);
            if (!payload) {
                return;
            }
            setLogs((current) => mergeLogsById(current, [payload.log]));
        };
        const handleStatus = (event) => {
            const payload = parseEventData(event.data);
            if (!payload) {
                return;
            }
            setStatus(payload.status);
            setConnected(true);
        };
        const handleDone = (event) => {
            const payload = parseEventData(event.data);
            if (payload) {
                setStatus(payload.status);
            }
            if (!isClosed) {
                isClosed = true;
                setConnected(false);
                stream.close();
            }
        };
        const handleError = () => {
            if (!isClosed) {
                isClosed = true;
                setConnected(false);
                setStreamError("Live log stream disconnected.");
                stream.close();
            }
        };
        stream.addEventListener("snapshot", handleSnapshot);
        stream.addEventListener("log", handleLog);
        stream.addEventListener("status", handleStatus);
        stream.addEventListener("done", handleDone);
        stream.onerror = handleError;
        return () => {
            isClosed = true;
            stream.removeEventListener("snapshot", handleSnapshot);
            stream.removeEventListener("log", handleLog);
            stream.removeEventListener("status", handleStatus);
            stream.removeEventListener("done", handleDone);
            stream.close();
            setConnected(false);
        };
    }, [enabled, jobId]);
    return {
        logs,
        status,
        streamError,
        connected,
    };
};
