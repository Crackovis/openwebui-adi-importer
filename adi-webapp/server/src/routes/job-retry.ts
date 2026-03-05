import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { JobsRepository } from "../db/repositories/jobs-repository";
import type { JobStatus } from "../domain/job-types";
import { failure, success } from "../lib/api-response";
import { DB_IMPORT_CONFIRMATION_TEXT } from "../schemas/db-import-schema";
import type { JobRunner } from "../services/job-runner";
import type { JobLogService } from "../services/job-log-service";

type JobRetryRouteDeps = {
  jobsRepository: JobsRepository;
  jobRunner: JobRunner;
  jobLogService: JobLogService;
};

const retryBodySchema = z
  .object({
    confirmationText: z.string().optional(),
  })
  .strict();

const retryableStatuses = new Set<JobStatus>([
  "failed_precheck",
  "failed_convert",
  "failed_sql",
  "failed_db",
]);

const isRetryable = (status: JobStatus): boolean => {
  return retryableStatuses.has(status);
};

const parseInputPaths = (raw: string): string[] | null => {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return null;
    }
    return parsed
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
  } catch {
    return null;
  }
};

const parseTagsCsv = (raw: string): string[] => {
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
};

export const registerJobRetryRoute = (app: FastifyInstance, deps: JobRetryRouteDeps): void => {
  app.post("/api/jobs/:id/retry", async (request, reply) => {
    const params = request.params as { id: string };
    const body = request.body ?? {};
    const bodyParse = retryBodySchema.safeParse(body);

    if (!bodyParse.success) {
      reply.code(400);
      return failure("JOB_RETRY_INVALID", bodyParse.error.issues[0]?.message ?? "Invalid retry payload.");
    }

    const originalJob = deps.jobsRepository.getJobById(params.id);
    if (!originalJob) {
      reply.code(404);
      return failure("JOB_NOT_FOUND", `Job ${params.id} was not found.`);
    }

    if (!isRetryable(originalJob.status)) {
      reply.code(409);
      return failure("JOB_RETRY_NOT_ALLOWED", `Job ${params.id} is not in a retryable failed state.`);
    }

    const input = deps.jobsRepository.getJobInput(params.id);
    if (!input) {
      reply.code(409);
      return failure("JOB_RETRY_INPUT_MISSING", `Job ${params.id} cannot be retried because input is missing.`);
    }

    const parsedInputPaths = parseInputPaths(input.inputPaths);
    if (!parsedInputPaths || parsedInputPaths.length === 0) {
      reply.code(409);
      return failure(
        "JOB_RETRY_INPUT_INVALID",
        `Job ${params.id} has invalid stored input paths and cannot be retried.`,
      );
    }

    const confirmationText = bodyParse.data.confirmationText;
    if (originalJob.mode === "direct_db") {
      if (!input.dbPath) {
        reply.code(409);
        return failure("JOB_RETRY_DB_PATH_MISSING", "Retry for Direct DB mode requires a stored dbPath.");
      }
      if (confirmationText !== DB_IMPORT_CONFIRMATION_TEXT) {
        reply.code(400);
        return failure(
          "JOB_RETRY_CONFIRMATION_REQUIRED",
          `Retry for Direct DB mode requires confirmation text: ${DB_IMPORT_CONFIRMATION_TEXT}`,
        );
      }
    }

    const retriedJobId = randomUUID();
    const createdAt = Date.now();

    deps.jobsRepository.createJob({
      id: retriedJobId,
      source: originalJob.source,
      mode: originalJob.mode,
      status: "queued",
      createdAt,
      startedAt: null,
      finishedAt: null,
      durationMs: null,
      error: null,
    });

    deps.jobRunner.enqueue({
      jobId: retriedJobId,
      source: originalJob.source,
      mode: originalJob.mode,
      inputMode: input.inputMode,
      inputPaths: parsedInputPaths,
      userId: input.userId,
      tags: parseTagsCsv(input.tagsCsv),
      dbPath: input.dbPath ?? undefined,
      confirmationText,
    });

    deps.jobLogService.logInfo(
      params.id,
      "retry",
      `Retry requested for failed job. Requeued as ${retriedJobId}.`,
    );

    return success({
      id: retriedJobId,
      status: "queued",
      retriedFrom: params.id,
    });
  });
};
