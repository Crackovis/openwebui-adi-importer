import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EnvConfig } from "../src/config/env";
import { createDbClient, type DbClient } from "../src/db/client";
import { createJobsRepository, type JobsRepository } from "../src/db/repositories/jobs-repository";
import { createJobStateMachine } from "../src/domain/job-state-machine";
import { createJobLogService } from "../src/services/job-log-service";
import { createJobRunner, type JobExecutionRequest } from "../src/services/job-runner";
import type { PrecheckService } from "../src/services/precheck-service";
import type { ConversionOrchestrator } from "../src/services/conversion-orchestrator";
import type { SqlOrchestrator } from "../src/services/sql-orchestrator";
import type { DbBackupService } from "../src/services/db-backup-service";
import type { DbImportService } from "../src/services/db-import-service";

const createTestEnv = (rootDir: string): EnvConfig => {
  return {
    nodeEnv: "test",
    serverHost: "127.0.0.1",
    serverPort: 8787,
    apiBaseUrl: "http://localhost:8787",
    pythonBin: "python",
    importerRoot: path.join(rootDir, "importer"),
    pathMapping: [],
    appDbPath: path.join(rootDir, "app.db"),
    uploadsDir: path.join(rootDir, "uploads"),
    workDir: path.join(rootDir, "work"),
    previewDir: path.join(rootDir, "preview"),
    sqlDir: path.join(rootDir, "sql"),
    backupsDir: path.join(rootDir, "backups"),
    maxInputFiles: 20,
    maxInputTotalBytes: 1024 * 1024,
    subprocessTimeoutMs: 1000,
    sseHeartbeatMs: 1000,
    openWebUiBaseUrl: undefined,
    openWebUiDiscoveryUrls: [],
    openWebUiDataDir: undefined,
    openWebUiDatabaseUrl: undefined,
    openWebUiAuthToken: undefined,
    openWebUiApiKey: undefined,
    openWebUiDiscoveryTimeoutMs: 1000,
  };
};

const createQueuedJob = (jobsRepository: JobsRepository, jobId: string): void => {
  jobsRepository.createJob({
    id: jobId,
    source: "chatgpt",
    mode: "sql",
    status: "queued",
    createdAt: Date.now(),
    startedAt: null,
    finishedAt: null,
    durationMs: null,
    error: null,
  });
};

describe("SQL mode integration", () => {
  let rootDir = "";
  let db: DbClient;
  let jobsRepository: JobsRepository;

  beforeEach(() => {
    rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "adi-sql-integration-"));
    db = createDbClient(path.join(rootDir, "app.db"));
    jobsRepository = createJobsRepository(db);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(rootDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("completes SQL mode happy path and persists outputs", async () => {
    const jobId = "job-sql-happy";
    createQueuedJob(jobsRepository, jobId);

    const env = createTestEnv(rootDir);
    const jobLogService = createJobLogService(jobsRepository);
    const jobStateMachine = createJobStateMachine({
      jobsRepository,
      jobLogService,
    });

    const precheckService: PrecheckService = {
      discoverOpenWebUi: vi.fn(),
      run: vi.fn().mockResolvedValue({
        ok: true,
        checks: {
          pythonAvailable: true,
          scriptPaths: true,
          inputsReadable: true,
          extensionsValid: true,
          userIdPresent: true,
          outputWritable: true,
        },
        resolvedInputFiles: [path.join(rootDir, "inputs", "chat-1.json")],
        fileCount: 1,
        totalBytes: 20,
        issues: [],
      }),
    };

    const conversionOrchestrator: ConversionOrchestrator = {
      run: vi.fn().mockResolvedValue({
        effectiveTags: ["imported-chatgpt", "batch-job-sql"],
        convertedFiles: [path.join(rootDir, "normalized", "chat-1.json")],
        failedFiles: [],
        convertedCount: 1,
        normalizedDir: path.join(rootDir, "normalized"),
        rawOutputDir: path.join(rootDir, "raw", "chatgpt"),
        preview: {
          previewPath: path.join(rootDir, "preview", "job-sql-happy.preview.json"),
          data: {
            conversationCount: 1,
            sampleTitles: ["Sample"],
            sampleMessages: [{ title: "Sample", snippet: "Hello" }],
            effectiveTags: ["imported-chatgpt", "batch-job-sql"],
            generatedAt: new Date("2026-03-05T12:00:00.000Z").toISOString(),
          },
        },
      }),
    };

    const sqlOrchestrator: SqlOrchestrator = {
      generate: vi.fn().mockResolvedValue({
        sqlPath: path.join(rootDir, "sql", "job-sql-happy.sql"),
        stdout: "ok",
        stderr: "",
      }),
    };

    const dbBackupService: DbBackupService = {
      createBackup: vi.fn(),
    };
    const dbImportService: DbImportService = {
      applySql: vi.fn(),
      expectedConfirmationText: "CONFIRM_DB_WRITE",
    };

    const jobRunner = createJobRunner({
      env,
      jobsRepository,
      jobStateMachine,
      jobLogService,
      precheckService,
      conversionOrchestrator,
      sqlOrchestrator,
      dbBackupService,
      dbImportService,
    });

    const request: JobExecutionRequest = {
      jobId,
      source: "chatgpt",
      mode: "sql",
      inputMode: "files",
      inputPaths: [path.join(rootDir, "inputs", "chat-1.json")],
      userId: "user-1",
      tags: ["project-alpha"],
    };

    await jobRunner.runNow(request);

    const job = jobsRepository.getJobById(jobId);
    const output = jobsRepository.getJobOutput(jobId);

    expect(job?.status).toBe("completed");
    expect(job?.error).toBeNull();
    expect(output).toMatchObject({
      convertedCount: 1,
      sqlPath: path.join(rootDir, "sql", "job-sql-happy.sql"),
      appliedToDb: 0,
    });
    expect(dbBackupService.createBackup).not.toHaveBeenCalled();
    expect(dbImportService.applySql).not.toHaveBeenCalled();
  });

  it("propagates precheck failure message to job error state", async () => {
    const jobId = "job-sql-failed";
    createQueuedJob(jobsRepository, jobId);

    const env = createTestEnv(rootDir);
    const jobLogService = createJobLogService(jobsRepository);
    const jobStateMachine = createJobStateMachine({
      jobsRepository,
      jobLogService,
    });

    const failureMessage = "Input file extension is invalid for source chatgpt.";

    const precheckService: PrecheckService = {
      discoverOpenWebUi: vi.fn(),
      run: vi.fn().mockResolvedValue({
        ok: false,
        checks: {
          pythonAvailable: true,
          scriptPaths: true,
          inputsReadable: true,
          extensionsValid: false,
          userIdPresent: true,
          outputWritable: true,
        },
        resolvedInputFiles: [],
        fileCount: 0,
        totalBytes: 0,
        issues: [{ code: "INPUT_EXTENSION_INVALID", message: failureMessage }],
      }),
    };

    const conversionOrchestrator: ConversionOrchestrator = {
      run: vi.fn(),
    };
    const sqlOrchestrator: SqlOrchestrator = {
      generate: vi.fn(),
    };
    const dbBackupService: DbBackupService = {
      createBackup: vi.fn(),
    };
    const dbImportService: DbImportService = {
      applySql: vi.fn(),
      expectedConfirmationText: "CONFIRM_DB_WRITE",
    };

    const jobRunner = createJobRunner({
      env,
      jobsRepository,
      jobStateMachine,
      jobLogService,
      precheckService,
      conversionOrchestrator,
      sqlOrchestrator,
      dbBackupService,
      dbImportService,
    });

    await jobRunner.runNow({
      jobId,
      source: "chatgpt",
      mode: "sql",
      inputMode: "files",
      inputPaths: [path.join(rootDir, "inputs", "chat-2.txt")],
      userId: "user-2",
      tags: [],
    });

    const job = jobsRepository.getJobById(jobId);
    const logs = jobsRepository.listJobLogs(jobId);

    expect(job?.status).toBe("failed_precheck");
    expect(job?.error).toBe(failureMessage);
    expect(logs.some((entry) => entry.level === "error" && entry.message.includes(failureMessage))).toBe(true);
    expect(conversionOrchestrator.run).not.toHaveBeenCalled();
    expect(sqlOrchestrator.generate).not.toHaveBeenCalled();
  });

  it("uses resolved precheck identity and dbPath for direct_db mode", async () => {
    const jobId = "job-direct-db-resolved";
    createQueuedJob(jobsRepository, jobId);

    const env = createTestEnv(rootDir);
    const jobLogService = createJobLogService(jobsRepository);
    const jobStateMachine = createJobStateMachine({
      jobsRepository,
      jobLogService,
    });

    const resolvedDbPath = path.join(rootDir, "openwebui", "webui.db");

    const precheckService: PrecheckService = {
      discoverOpenWebUi: vi.fn(),
      run: vi.fn().mockResolvedValue({
        ok: true,
        checks: {
          pythonAvailable: true,
          scriptPaths: true,
          inputsReadable: true,
          extensionsValid: true,
          userIdPresent: true,
          outputWritable: true,
        },
        resolvedUserId: "resolved-user",
        resolvedDbPath,
        resolvedInputFiles: [path.join(rootDir, "inputs", "chat-1.json")],
        fileCount: 1,
        totalBytes: 20,
        issues: [],
      }),
    };

    const conversionOrchestrator: ConversionOrchestrator = {
      run: vi.fn().mockResolvedValue({
        effectiveTags: ["imported-chatgpt"],
        convertedFiles: [path.join(rootDir, "normalized", "chat-1.json")],
        failedFiles: [],
        convertedCount: 1,
        normalizedDir: path.join(rootDir, "normalized"),
        rawOutputDir: path.join(rootDir, "raw", "chatgpt"),
        preview: {
          previewPath: path.join(rootDir, "preview", "job-direct-db-resolved.preview.json"),
          data: {
            conversationCount: 1,
            sampleTitles: ["Sample"],
            sampleMessages: [{ title: "Sample", snippet: "Hello" }],
            effectiveTags: ["imported-chatgpt"],
            generatedAt: new Date("2026-03-05T12:00:00.000Z").toISOString(),
          },
        },
      }),
    };

    const sqlOrchestrator: SqlOrchestrator = {
      generate: vi.fn().mockResolvedValue({
        sqlPath: path.join(rootDir, "sql", "job-direct-db-resolved.sql"),
        stdout: "ok",
        stderr: "",
      }),
    };

    const dbBackupService: DbBackupService = {
      createBackup: vi.fn().mockReturnValue(path.join(rootDir, "backups", "job-direct-db-resolved.sqlite")),
    };
    const dbImportService: DbImportService = {
      applySql: vi.fn(),
      expectedConfirmationText: "CONFIRM_DB_WRITE",
    };

    const jobRunner = createJobRunner({
      env,
      jobsRepository,
      jobStateMachine,
      jobLogService,
      precheckService,
      conversionOrchestrator,
      sqlOrchestrator,
      dbBackupService,
      dbImportService,
    });

    await jobRunner.runNow({
      jobId,
      source: "chatgpt",
      mode: "direct_db",
      inputMode: "files",
      inputPaths: [path.join(rootDir, "inputs", "chat-1.json")],
      userId: "request-user",
      tags: [],
      confirmationText: "CONFIRM_DB_WRITE",
    });

    const conversionCall = vi.mocked(conversionOrchestrator.run).mock.calls[0]?.[0];
    const persistedInput = jobsRepository.getJobInput(jobId);
    const job = jobsRepository.getJobById(jobId);

    expect(conversionCall?.userId).toBe("resolved-user");
    expect(dbBackupService.createBackup).toHaveBeenCalledWith(resolvedDbPath, jobId);
    expect(dbImportService.applySql).toHaveBeenCalledWith(
      expect.objectContaining({
        dbPath: resolvedDbPath,
      }),
    );
    expect(persistedInput?.userId).toBe("resolved-user");
    expect(persistedInput?.dbPath).toBe(resolvedDbPath);
    expect(job?.status).toBe("completed");
  });
});
