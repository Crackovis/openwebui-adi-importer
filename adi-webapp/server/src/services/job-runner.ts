import { DB_IMPORT_CONFIRMATION_TEXT } from "../schemas/db-import-schema";
import type { EnvConfig } from "../config/env";
import type { JobMode, JobSource, JobStatus } from "../domain/job-types";
import type {
  JobInputRecord,
  JobsRepository,
} from "../db/repositories/jobs-repository";
import type { JobStateMachine } from "../domain/job-state-machine";
import type { JobLogService } from "./job-log-service";
import type { PrecheckService } from "./precheck-service";
import type { ConversionOrchestrator } from "./conversion-orchestrator";
import type { SqlOrchestrator } from "./sql-orchestrator";
import type { DbBackupService } from "./db-backup-service";
import { DbImportError, type DbImportService } from "./db-import-service";

export type JobExecutionRequest = {
  jobId: string;
  source: JobSource;
  mode: JobMode;
  inputMode: "files" | "folder";
  inputPaths: string[];
  userId: string;
  tags: string[];
  dbPath?: string;
  confirmationText?: string;
};

type JobRunnerDeps = {
  env: EnvConfig;
  jobsRepository: JobsRepository;
  jobStateMachine: JobStateMachine;
  jobLogService: JobLogService;
  precheckService: PrecheckService;
  conversionOrchestrator: ConversionOrchestrator;
  sqlOrchestrator: SqlOrchestrator;
  dbBackupService: DbBackupService;
  dbImportService: DbImportService;
};

class JobRunError extends Error {
  public readonly failState: JobStatus;

  public constructor(failState: JobStatus, message: string) {
    super(message);
    this.name = "JobRunError";
    this.failState = failState;
  }
}

const tagsToCsv = (tags: string[]): string => {
  return tags.join(",");
};

const toJobInputRecord = (request: JobExecutionRequest): JobInputRecord => {
  return {
    jobId: request.jobId,
    userId: request.userId,
    tagsCsv: tagsToCsv(request.tags),
    inputMode: request.inputMode,
    inputPaths: JSON.stringify(request.inputPaths),
    dbPath: request.dbPath ?? null,
  };
};

const runFailureTransition = (
  deps: JobRunnerDeps,
  jobId: string,
  failState: JobStatus,
  message: string,
): void => {
  try {
    deps.jobStateMachine.transition(jobId, failState, message);
  } catch {
    deps.jobsRepository.updateJobState(jobId, failState, message);
    deps.jobLogService.logError(jobId, "state_change", `Forced state update to ${failState}: ${message}`);
  }
};

export type JobRunner = {
  enqueue: (request: JobExecutionRequest) => void;
  runNow: (request: JobExecutionRequest) => Promise<void>;
};

export const createJobRunner = (deps: JobRunnerDeps): JobRunner => {
  const runNow = async (request: JobExecutionRequest): Promise<void> => {
    const startedAt = Date.now();
    deps.jobsRepository.markJobStarted(request.jobId, startedAt);

    try {
      deps.jobStateMachine.transition(request.jobId, "precheck");
      deps.jobLogService.logInfo(request.jobId, "precheck", "Running pre-check validation.");

      const precheck = await deps.precheckService.run({
        source: request.source,
        inputMode: request.inputMode,
        inputPaths: request.inputPaths,
        userId: request.userId,
        mode: request.mode,
        tags: request.tags,
        dbPath: request.dbPath,
      });

      if (!precheck.ok) {
        const reason = precheck.issues[0]?.message ?? "Pre-check failed.";
        throw new JobRunError("failed_precheck", reason);
      }

      const effectiveUserId = precheck.resolvedUserId ?? request.userId;
      if (!effectiveUserId) {
        throw new JobRunError("failed_precheck", "Unable to resolve OpenWebUI user identity.");
      }
      const effectiveDbPath =
        request.mode === "direct_db" ? (precheck.resolvedDbPath ?? request.dbPath) : undefined;

      if (effectiveUserId !== request.userId || effectiveDbPath !== request.dbPath) {
        deps.jobsRepository.upsertJobInput(
          toJobInputRecord({
            ...request,
            userId: effectiveUserId,
            dbPath: effectiveDbPath,
          }),
        );
      }

      deps.jobStateMachine.transition(request.jobId, "converting");
      deps.jobLogService.logInfo(request.jobId, "convert", "Starting conversion process.");

      const conversion = await deps.conversionOrchestrator.run({
        source: request.source,
        userId: effectiveUserId,
        inputFiles: precheck.resolvedInputFiles,
        customTags: request.tags,
        jobId: request.jobId,
        workDir: deps.env.workDir,
        previewDir: deps.env.previewDir,
      });

      if (conversion.convertedCount === 0) {
        throw new JobRunError("failed_convert", "No conversations were converted.");
      }

      deps.jobsRepository.patchJobOutput(request.jobId, {
        convertedCount: conversion.convertedCount,
        previewPath: conversion.preview.previewPath,
      });

      deps.jobStateMachine.transition(request.jobId, "preview_ready");
      deps.jobLogService.logInfo(request.jobId, "preview", "Preview artifact generated.");

      const sqlOutput = await deps.sqlOrchestrator.generate({
        jobId: request.jobId,
        normalizedInputPath: conversion.normalizedDir,
        sqlDir: deps.env.sqlDir,
        tags: conversion.effectiveTags,
      });

      deps.jobsRepository.patchJobOutput(request.jobId, {
        sqlPath: sqlOutput.sqlPath,
      });

      deps.jobStateMachine.transition(request.jobId, "sql_ready");
      deps.jobLogService.logInfo(request.jobId, "sql", "SQL artifact generated.");

      if (request.mode === "direct_db") {
        if (!effectiveDbPath) {
          throw new JobRunError("failed_db", "Direct DB mode requires dbPath.");
        }
        if (request.confirmationText !== DB_IMPORT_CONFIRMATION_TEXT) {
          throw new JobRunError("failed_db", "Explicit confirmation is required for Direct DB mode.");
        }

        deps.jobStateMachine.transition(request.jobId, "db_importing");
        deps.jobLogService.logWarning(
          request.jobId,
          "db_import",
          "Direct DB import started. Backup will be created before write.",
        );

        const backupPath = deps.dbBackupService.createBackup(effectiveDbPath, request.jobId);
        deps.jobsRepository.patchJobOutput(request.jobId, {
          backupPath,
        });

        try {
          deps.dbImportService.applySql({
            dbPath: effectiveDbPath,
            sqlPath: sqlOutput.sqlPath,
            confirmationText: request.confirmationText,
          });
        } catch (error) {
          if (error instanceof DbImportError) {
            throw new JobRunError("failed_db", `${error.code}: ${error.message}`);
          }

          const message = error instanceof Error ? error.message : "Direct DB import failed.";
          throw new JobRunError("failed_db", message);
        }

        deps.jobsRepository.patchJobOutput(request.jobId, {
          appliedToDb: 1,
        });
      }

      deps.jobStateMachine.transition(request.jobId, "completed");
      deps.jobLogService.logInfo(request.jobId, "job", "Job completed successfully.");

      const finishedAt = Date.now();
      deps.jobsRepository.markJobFinished(
        request.jobId,
        finishedAt,
        finishedAt - startedAt,
        "completed",
        null,
      );
    } catch (error) {
      const failState = error instanceof JobRunError ? error.failState : "failed_convert";
      const message = error instanceof Error ? error.message : "Job failed.";
      runFailureTransition(deps, request.jobId, failState, message);

      const finishedAt = Date.now();
      deps.jobsRepository.markJobFinished(
        request.jobId,
        finishedAt,
        finishedAt - startedAt,
        failState,
        message,
      );
    }
  };

  const enqueue = (request: JobExecutionRequest): void => {
    deps.jobsRepository.upsertJobInput(toJobInputRecord(request));
    deps.jobLogService.logInfo(request.jobId, "queue", "Job enqueued.");
    setImmediate(() => {
      void runNow(request);
    });
  };

  return {
    enqueue,
    runNow,
  };
};
