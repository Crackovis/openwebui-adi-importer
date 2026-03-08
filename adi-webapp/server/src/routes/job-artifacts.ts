import fs from "node:fs";
import type { FastifyInstance } from "fastify";
import type { JobsRepository } from "../db/repositories/jobs-repository";
import { failure } from "../lib/api-response";

type JobArtifactsRouteDeps = {
  jobsRepository: JobsRepository;
};

export const registerJobArtifactsRoute = (app: FastifyInstance, deps: JobArtifactsRouteDeps): void => {
  app.get("/api/jobs/:id/artifacts/preview", async (request, reply) => {
    const params = request.params as { id: string };
    const output = deps.jobsRepository.getJobOutput(params.id);

    if (!output?.previewPath) {
      reply.code(404);
      return failure("PREVIEW_ARTIFACT_NOT_FOUND", "No preview JSON artifact found for this job.");
    }

    if (!fs.existsSync(output.previewPath)) {
      reply.code(404);
      return failure("PREVIEW_FILE_MISSING", "Preview artifact path is recorded, but file is missing.");
    }

    reply.header("Content-Type", "application/json; charset=utf-8");
    reply.header("Content-Disposition", `attachment; filename=job-${params.id}.preview.json`);
    return reply.send(fs.createReadStream(output.previewPath));
  });

  app.get("/api/jobs/:id/artifacts/sql", async (request, reply) => {
    const params = request.params as { id: string };
    const output = deps.jobsRepository.getJobOutput(params.id);

    if (!output?.sqlPath) {
      reply.code(404);
      return failure("SQL_ARTIFACT_NOT_FOUND", "No SQL artifact found for this job.");
    }

    if (!fs.existsSync(output.sqlPath)) {
      reply.code(404);
      return failure("SQL_FILE_MISSING", "SQL artifact path is recorded, but file is missing.");
    }

    reply.header("Content-Type", "application/sql; charset=utf-8");
    reply.header("Content-Disposition", `attachment; filename=job-${params.id}.sql`);
    return reply.send(fs.createReadStream(output.sqlPath));
  });
};
