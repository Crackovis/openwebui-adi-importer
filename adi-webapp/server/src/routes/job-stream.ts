import type { ServerResponse } from "node:http";
import type { FastifyInstance } from "fastify";
import type { JobsRepository } from "../db/repositories/jobs-repository";
import type { JobStatus } from "../domain/job-types";
import { failure } from "../lib/api-response";

type JobStreamRouteDeps = {
  jobsRepository: JobsRepository;
  pollIntervalMs?: number;
  heartbeatIntervalMs?: number;
};

const terminalStatuses = new Set<JobStatus>([
  "completed",
  "failed_precheck",
  "failed_convert",
  "failed_sql",
  "failed_db",
  "cancelled",
]);

const isTerminalStatus = (status: JobStatus): boolean => {
  return terminalStatuses.has(status);
};

const writeSseEvent = (response: ServerResponse, event: string, payload: unknown): void => {
  response.write(`event: ${event}\n`);
  response.write(`data: ${JSON.stringify(payload)}\n\n`);
};

export const registerJobStreamRoute = (app: FastifyInstance, deps: JobStreamRouteDeps): void => {
  app.get("/api/jobs/:id/stream", async (request, reply) => {
    const params = request.params as { id: string };
    const existingJob = deps.jobsRepository.getJobById(params.id);

    if (!existingJob) {
      reply.code(404);
      return failure("JOB_NOT_FOUND", `Job ${params.id} was not found.`);
    }

    const pollIntervalMs = deps.pollIntervalMs ?? 1000;
    const heartbeatIntervalMs = deps.heartbeatIntervalMs ?? 15000;
    const origin = typeof request.headers.origin === "string" ? request.headers.origin : "*";

    reply.hijack();
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "Access-Control-Allow-Origin": origin,
      Vary: "Origin",
    });
    if (typeof reply.raw.flushHeaders === "function") {
      reply.raw.flushHeaders();
    }

    let closed = false;
    let pollTimer: NodeJS.Timeout | null = null;
    let heartbeatTimer: NodeJS.Timeout | null = null;
    let lastLogId = 0;
    let currentStatus = existingJob.status;
    let currentError = existingJob.error;

    const closeStream = (): void => {
      if (closed) {
        return;
      }
      closed = true;
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
      reply.raw.end();
    };

    const pollForUpdates = (): void => {
      if (closed) {
        return;
      }

      const newLogs = deps.jobsRepository.listJobLogs(params.id, lastLogId);
      for (const log of newLogs) {
        lastLogId = log.id;
        writeSseEvent(reply.raw, "log", { log });
      }

      const latestJob = deps.jobsRepository.getJobById(params.id);
      if (!latestJob) {
        writeSseEvent(reply.raw, "done", {
          status: "cancelled",
          error: "Job no longer exists.",
        });
        closeStream();
        return;
      }

      if (latestJob.status !== currentStatus || latestJob.error !== currentError) {
        currentStatus = latestJob.status;
        currentError = latestJob.error;
        writeSseEvent(reply.raw, "status", {
          status: latestJob.status,
          error: latestJob.error,
        });
      }

      if (isTerminalStatus(latestJob.status)) {
        writeSseEvent(reply.raw, "done", {
          status: latestJob.status,
          error: latestJob.error,
        });
        closeStream();
      }
    };

    const initialLogs = deps.jobsRepository.listJobLogs(params.id);
    if (initialLogs.length > 0) {
      lastLogId = initialLogs[initialLogs.length - 1].id;
    }

    writeSseEvent(reply.raw, "snapshot", {
      job: existingJob,
      logs: initialLogs,
    });
    writeSseEvent(reply.raw, "status", {
      status: existingJob.status,
      error: existingJob.error,
    });

    if (isTerminalStatus(existingJob.status)) {
      writeSseEvent(reply.raw, "done", {
        status: existingJob.status,
        error: existingJob.error,
      });
      closeStream();
      return;
    }

    pollTimer = setInterval(pollForUpdates, pollIntervalMs);
    heartbeatTimer = setInterval(() => {
      if (!closed) {
        reply.raw.write(`: keepalive ${Date.now()}\n\n`);
      }
    }, heartbeatIntervalMs);

    reply.raw.on("close", closeStream);
    reply.raw.on("error", closeStream);
  });
};
