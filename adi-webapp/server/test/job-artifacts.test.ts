import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { JobsRepository } from "../src/db/repositories/jobs-repository";
import { registerJobArtifactsRoute } from "../src/routes/job-artifacts";

describe("registerJobArtifactsRoute", () => {
  let tempDir = "";

  afterEach(() => {
    if (tempDir) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      tempDir = "";
    }
  });

  it("downloads preview JSON artifact when present", async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "adi-artifacts-preview-"));
    const previewPath = path.join(tempDir, "job-1.preview.json");
    fs.writeFileSync(previewPath, JSON.stringify({ hello: "world" }), "utf8");

    const jobsRepository = {
      getJobOutput: vi.fn().mockReturnValue({
        jobId: "job-1",
        convertedCount: 1,
        previewPath,
        sqlPath: null,
        backupPath: null,
        appliedToDb: 0,
      }),
    } as unknown as JobsRepository;

    const app = Fastify();
    registerJobArtifactsRoute(app, { jobsRepository });

    const response = await app.inject({
      method: "GET",
      url: "/api/jobs/job-1/artifacts/preview",
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("application/json");
    expect(response.headers["content-disposition"]).toContain("job-job-1.preview.json");
    expect(response.body).toContain("hello");

    await app.close();
  });
});
