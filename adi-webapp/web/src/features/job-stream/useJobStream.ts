import { useEffect, useState } from "react";
import type { JobDetail, JobStatus } from "../../types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8787";

type JobLogEntry = JobDetail["timeline"][number];

type SnapshotEventData = {
  job: {
    status: JobStatus;
    error: string | null;
  };
  logs: JobLogEntry[];
};

type StatusEventData = {
  status: JobStatus;
  error: string | null;
};

type LogEventData = {
  log: JobLogEntry;
};

type JobStreamState = {
  logs: JobLogEntry[];
  status: JobStatus | null;
  streamError: string | null;
  connected: boolean;
};

const parseEventData = <T>(value: string): T | null => {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

const mergeLogsById = (current: JobLogEntry[], incoming: JobLogEntry[]): JobLogEntry[] => {
  const byId = new Map<number, JobLogEntry>();
  for (const log of current) {
    byId.set(log.id, log);
  }
  for (const log of incoming) {
    byId.set(log.id, log);
  }
  return [...byId.values()].sort((a, b) => a.id - b.id);
};

export const useJobStream = (jobId: string | undefined, enabled: boolean): JobStreamState => {
  const [logs, setLogs] = useState<JobLogEntry[]>([]);
  const [status, setStatus] = useState<JobStatus | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
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

    const handleSnapshot = (event: MessageEvent): void => {
      const payload = parseEventData<SnapshotEventData>(event.data);
      if (!payload) {
        return;
      }
      setLogs(payload.logs);
      setStatus(payload.job.status);
      setConnected(true);
    };

    const handleLog = (event: MessageEvent): void => {
      const payload = parseEventData<LogEventData>(event.data);
      if (!payload) {
        return;
      }
      setLogs((current) => mergeLogsById(current, [payload.log]));
    };

    const handleStatus = (event: MessageEvent): void => {
      const payload = parseEventData<StatusEventData>(event.data);
      if (!payload) {
        return;
      }
      setStatus(payload.status);
      setConnected(true);
    };

    const handleDone = (event: MessageEvent): void => {
      const payload = parseEventData<StatusEventData>(event.data);
      if (payload) {
        setStatus(payload.status);
      }
      if (!isClosed) {
        isClosed = true;
        setConnected(false);
        stream.close();
      }
    };

    const handleError = (): void => {
      if (!isClosed) {
        isClosed = true;
        setConnected(false);
        setStreamError("Live log stream disconnected.");
        stream.close();
      }
    };

    stream.addEventListener("snapshot", handleSnapshot as EventListener);
    stream.addEventListener("log", handleLog as EventListener);
    stream.addEventListener("status", handleStatus as EventListener);
    stream.addEventListener("done", handleDone as EventListener);
    stream.onerror = handleError;

    return () => {
      isClosed = true;
      stream.removeEventListener("snapshot", handleSnapshot as EventListener);
      stream.removeEventListener("log", handleLog as EventListener);
      stream.removeEventListener("status", handleStatus as EventListener);
      stream.removeEventListener("done", handleDone as EventListener);
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
