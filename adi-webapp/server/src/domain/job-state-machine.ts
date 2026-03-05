import {
  JOB_STATUSES,
  type JobStatus,
} from "./job-types";
import type { JobsRepository } from "../db/repositories/jobs-repository";
import type { JobLogService } from "../services/job-log-service";

export class JobStateTransitionError extends Error {
  public readonly code: string;

  public constructor(code: string, message: string) {
    super(message);
    this.name = "JobStateTransitionError";
    this.code = code;
  }
}

const transitionMap: Record<JobStatus, JobStatus[]> = {
  queued: ["precheck", "cancelled"],
  precheck: ["converting", "failed_precheck", "cancelled"],
  converting: ["preview_ready", "failed_convert", "cancelled"],
  preview_ready: ["sql_ready", "failed_sql", "cancelled"],
  sql_ready: ["db_importing", "completed", "failed_sql", "cancelled"],
  db_importing: ["completed", "failed_db", "cancelled"],
  completed: [],
  failed_precheck: [],
  failed_convert: [],
  failed_sql: [],
  failed_db: [],
  cancelled: [],
};

export const isValidJobStatus = (value: string): value is JobStatus => {
  return JOB_STATUSES.includes(value as JobStatus);
};

export const canTransition = (from: JobStatus, to: JobStatus): boolean => {
  return transitionMap[from].includes(to);
};

type JobStateMachineDeps = {
  jobsRepository: JobsRepository;
  jobLogService: JobLogService;
};

export type JobStateMachine = {
  transition: (jobId: string, nextState: JobStatus, errorMessage?: string) => void;
};

const deriveErrorValue = (nextState: JobStatus, errorMessage?: string): string | null => {
  if (nextState.startsWith("failed_")) {
    return errorMessage ?? "Job failed.";
  }
  return null;
};

export const createJobStateMachine = (deps: JobStateMachineDeps): JobStateMachine => {
  const transition = (jobId: string, nextState: JobStatus, errorMessage?: string): void => {
    const currentJob = deps.jobsRepository.getJobById(jobId);
    if (!currentJob) {
      throw new JobStateTransitionError("JOB_NOT_FOUND", `Job ${jobId} was not found.`);
    }

    if (!canTransition(currentJob.status, nextState)) {
      throw new JobStateTransitionError(
        "INVALID_STATE_TRANSITION",
        `Cannot transition job ${jobId} from ${currentJob.status} to ${nextState}.`,
      );
    }

    const error = deriveErrorValue(nextState, errorMessage);
    deps.jobsRepository.updateJobState(jobId, nextState, error);
    deps.jobLogService.logStateTransition(jobId, currentJob.status, nextState);

    if (errorMessage) {
      deps.jobLogService.logError(jobId, "state_change", errorMessage);
    }
  };

  return {
    transition,
  };
};
