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
import { registerOpenWebUiDiscoveryRoute } from "./routes/openwebui-discovery";
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
import { createRuntimeSettingsResolver } from "./services/runtime-settings";
import { createSqlOrchestrator } from "./services/sql-orchestrator";

const ABSOLUTE_UPLOAD_FILE_SIZE_LIMIT_BYTES = 1_073_741_824;
const ABSOLUTE_UPLOAD_FILES_LIMIT = 1_000;

const startServer = async (): Promise<void> => {
  const env = loadEnv();
  ensureRuntimeDirectories(env);

  const db = createDbClient(env.appDbPath);
  const jobsRepository = createJobsRepository(db);
  const settingsRepository = createSettingsRepository(db);
  const getRuntimeSettings = createRuntimeSettingsResolver(env, settingsRepository);
  const jobLogService = createJobLogService(jobsRepository);
  const jobStateMachine = createJobStateMachine({
    jobsRepository,
    jobLogService,
  });

  const pythonAdapter = createPythonAdapter({
    getRuntimeOptions: () => {
      const runtimeSettings = getRuntimeSettings();
      return {
        pythonBin: runtimeSettings.pythonBin,
        importerRoot: runtimeSettings.importerRoot,
        timeoutMs: runtimeSettings.subprocessTimeoutMs,
      };
    },
    pathMapping: env.pathMapping,
  });

  const precheckService = createPrecheckService({
    env,
    pythonAdapter,
    getRuntimeSettings,
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

  await app.register(multipart, {
    limits: {
      fileSize: Math.max(env.maxInputTotalBytes, ABSOLUTE_UPLOAD_FILE_SIZE_LIMIT_BYTES),
      files: Math.max(env.maxInputFiles, ABSOLUTE_UPLOAD_FILES_LIMIT),
    },
  });

  registerHealthRoute(app, { env });
  registerSettingsRoute(app, {
    settingsRepository,
    getRuntimeSettings,
  });
  registerUploadRoute(app, {
    uploadsDir: env.uploadsDir,
    getRuntimeSettings,
  });
  registerOpenWebUiDiscoveryRoute(app, {
    precheckService,
  });
  registerJobsRoute(app, {
    jobsRepository,
    jobRunner,
    precheckService,
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
