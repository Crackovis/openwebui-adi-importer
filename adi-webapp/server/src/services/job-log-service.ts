import type { JobStatus } from "../domain/job-types";
import type { JobsRepository, JobLogRecord } from "../db/repositories/jobs-repository";

export type LogLevel = JobLogRecord["level"];

type JobLogInput = {
  jobId: string;
  level: LogLevel;
  step: string;
  message: string;
};

export type JobLogService = {
  log: (input: JobLogInput) => number;
  logInfo: (jobId: string, step: string, message: string) => number;
  logWarning: (jobId: string, step: string, message: string) => number;
  logError: (jobId: string, step: string, message: string) => number;
  logStateTransition: (jobId: string, fromState: JobStatus, toState: JobStatus) => number;
};

export const createJobLogService = (jobsRepository: JobsRepository): JobLogService => {
  const log = (input: JobLogInput): number => {
    return jobsRepository.appendJobLog({
      jobId: input.jobId,
      ts: Date.now(),
      level: input.level,
      step: input.step,
      message: input.message,
    });
  };

  const logInfo = (jobId: string, step: string, message: string): number => {
    return log({
      jobId,
      level: "info",
      step,
      message,
    });
  };

  const logWarning = (jobId: string, step: string, message: string): number => {
    return log({
      jobId,
      level: "warning",
      step,
      message,
    });
  };

  const logError = (jobId: string, step: string, message: string): number => {
    return log({
      jobId,
      level: "error",
      step,
      message,
    });
  };

  const logStateTransition = (jobId: string, fromState: JobStatus, toState: JobStatus): number => {
    return log({
      jobId,
      level: "info",
      step: "state_change",
      message: `${fromState} -> ${toState}`,
    });
  };

  return {
    log,
    logInfo,
    logWarning,
    logError,
    logStateTransition,
  };
};
