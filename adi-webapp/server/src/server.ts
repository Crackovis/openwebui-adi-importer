import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import Fastify from "fastify";
import { ensureRuntimeDirectories, loadEnv } from "./config/env";
import { createDbClient } from "./db/client";
import { createJobStateMachine } from "./domain/job-state-machine";
import { registerJobsRoute } from "./routes/jobs";
import { registerHealthRoute } from "./routes/health";
import { registerJobArtifactsRoute } from "./routes/job-artifacts";
import { registerJobRetryRoute } from "./routes/job-retry";
import { registerJobStreamRoute } from "./routes/job-stream";
import { registerSettingsRoute } from "./routes/settings";
import { registerUploadRoute } from "./routes/upload";
import { createJobsRepository } from "./db/repositories/jobs-repository";
import { createSettingsRepository } from "./db/repositories/settings-repository";
import { createConversionOrchestrator } from "./services/conversion-orchestrator";
import { createDbBackupService } from "./services/db-backup-service";
import { createDbImportService } from "./services/db-import-service";
import { createJobLogService } from "./services/job-log-service";
import { createJobRunner } from "./services/job-runner";
import { createPrecheckService } from "./services/precheck-service";
import { createPythonAdapter } from "./services/python-adapter";
import { createSqlOrchestrator } from "./services/sql-orchestrator";

const startServer = async (): Promise<void> => {
  const env = loadEnv();
  ensureRuntimeDirectories(env);

  const db = createDbClient(env.appDbPath);
  const jobsRepository = createJobsRepository(db);
  const settingsRepository = createSettingsRepository(db);
  const jobLogService = createJobLogService(jobsRepository);
  const jobStateMachine = createJobStateMachine({
    jobsRepository,
    jobLogService,
  });

  const pythonAdapter = createPythonAdapter({
    pythonBin: env.pythonBin,
    importerRoot: env.importerRoot,
    timeoutMs: env.subprocessTimeoutMs,
    pathMapping: env.pathMapping,
  });

  const precheckService = createPrecheckService({
    env,
    pythonAdapter,
  });
  const conversionOrchestrator = createConversionOrchestrator({
    pythonAdapter,
  });
  const sqlOrchestrator = createSqlOrchestrator(pythonAdapter);
  const dbBackupService = createDbBackupService(env.backupsDir);
  const dbImportService = createDbImportService();

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

  const app = Fastify({
    logger: true,
  });

  await app.register(cors, {
    origin: true,
    methods: ["GET", "PUT", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept"],
  });

  registerHealthRoute(app, { env });
  registerSettingsRoute(app, {
    env,
    settingsRepository,
  });
  registerJobsRoute(app, {
    jobsRepository,
    jobRunner,
  });
  registerJobStreamRoute(app, {
    jobsRepository,
  });
  registerJobRetryRoute(app, {
    jobsRepository,
    jobRunner,
    jobLogService,
  });
  registerJobArtifactsRoute(app, {
    jobsRepository,
  });

  await app.listen({
    host: env.serverHost,
    port: env.serverPort,
  });
};

void startServer();
