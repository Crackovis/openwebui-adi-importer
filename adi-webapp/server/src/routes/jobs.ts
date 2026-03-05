import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { JobsRepository } from "../db/repositories/jobs-repository";
import { failure, success } from "../lib/api-response";
import {
  createJobRequestSchema,
  listJobsQuerySchema,
} from "../schemas/jobs-schema";
import type { JobRunner } from "../services/job-runner";
import type { PrecheckService } from "../services/precheck-service";

type JobsRouteDeps = {
  jobsRepository: JobsRepository;
  jobRunner: JobRunner;
  precheckService: PrecheckService;
};

export const registerJobsRoute = (app: FastifyInstance, deps: JobsRouteDeps): void => {
  app.post("/api/jobs", async (request, reply) => {
    const parsed = createJobRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400);
      return failure("JOB_VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid job payload.");
    }

    const payload = parsed.data;
    const precheck = await deps.precheckService.run({
      source: payload.source,
      inputMode: payload.inputMode,
      inputPaths: payload.inputPaths,
      userId: payload.userId,
      mode: payload.mode,
      tags: payload.tags,
      dbPath: payload.mode === "direct_db" ? payload.dbPath : undefined,
      openWebUiBaseUrl: payload.openWebUiBaseUrl,
      openWebUiDataDir: payload.openWebUiDataDir,
      openWebUiAuthToken: payload.openWebUiAuthToken,
      openWebUiApiKey: payload.openWebUiApiKey,
    });
    if (!precheck.ok) {
      reply.code(400);
      return failure("JOB_PRECHECK_FAILED", precheck.issues[0]?.message ?? "Pre-check failed.");
    }

    const resolvedUserId = precheck.resolvedUserId ?? payload.userId;
    if (!resolvedUserId) {
      reply.code(400);
      return failure("JOB_PRECHECK_FAILED", "Unable to resolve OpenWebUI user identity.");
    }

    const resolvedDbPath = payload.mode === "direct_db" ? (precheck.resolvedDbPath ?? payload.dbPath) : undefined;
    if (payload.mode === "direct_db" && !resolvedDbPath) {
      reply.code(400);
      return failure("JOB_PRECHECK_FAILED", "Unable to resolve OpenWebUI database path for Direct DB mode.");
    }

    const jobId = randomUUID();
    const createdAt = Date.now();

    deps.jobsRepository.createJob({
      id: jobId,
      source: payload.source,
      mode: payload.mode,
      status: "queued",
      createdAt,
      startedAt: null,
      finishedAt: null,
      durationMs: null,
      error: null,
    });

    deps.jobRunner.enqueue({
      jobId,
      source: payload.source,
      mode: payload.mode,
      inputMode: payload.inputMode,
      inputPaths: payload.inputPaths,
      userId: resolvedUserId,
      tags: payload.tags,
      dbPath: resolvedDbPath,
      confirmationText: payload.mode === "direct_db" ? payload.confirmationText : undefined,
    });

    return success({
      id: jobId,
      status: "queued",
      createdAt,
    });
  });

  app.get("/api/jobs", async (request, reply) => {
    const parsed = listJobsQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      reply.code(400);
      return failure("JOB_QUERY_INVALID", parsed.error.issues[0]?.message ?? "Invalid query params.");
    }

    const jobs = deps.jobsRepository.listJobs(parsed.data);
    return success(jobs);
  });

  app.get("/api/jobs/:id", async (request, reply) => {
    const params = request.params as { id: string };
    const job = deps.jobsRepository.getJobById(params.id);

    if (!job) {
      reply.code(404);
      return failure("JOB_NOT_FOUND", `Job ${params.id} was not found.`);
    }

    const input = deps.jobsRepository.getJobInput(params.id);
    const output = deps.jobsRepository.getJobOutput(params.id);
    const logs = deps.jobsRepository.listJobLogs(params.id);

    return success({
      ...job,
      input,
      output,
      timeline: logs,
    });
  });
};
