import { describe, expect, it, vi } from "vitest";
import type { JobRecord, JobsRepository } from "../src/db/repositories/jobs-repository";
import type { JobStatus } from "../src/domain/job-types";
import {
  createJobStateMachine,
  JobStateTransitionError,
} from "../src/domain/job-state-machine";
import type { JobLogService } from "../src/services/job-log-service";

const createRepositoryMock = (job: JobRecord): JobsRepository => {
  const state = { current: job };

  return {
    createJob: vi.fn(),
    getJobById: vi.fn((id: string) => {
      return state.current.id === id ? state.current : null;
    }),
    listJobs: vi.fn(),
    updateJobState: vi.fn((id: string, status: JobStatus, error: string | null) => {
      if (state.current.id === id) {
        state.current = {
          ...state.current,
          status,
          error,
        };
      }
    }),
    markJobStarted: vi.fn(),
    markJobFinished: vi.fn(),
    upsertJobInput: vi.fn(),
    getJobInput: vi.fn(),
    upsertJobOutput: vi.fn(),
    patchJobOutput: vi.fn(),
    getJobOutput: vi.fn(),
    appendJobLog: vi.fn(),
    listJobLogs: vi.fn(),
  };
};

const createLogServiceMock = (): JobLogService => {
  return {
    log: vi.fn(),
    logInfo: vi.fn(),
    logWarning: vi.fn(),
    logError: vi.fn(),
    logStateTransition: vi.fn(),
  };
};

const baseJob: JobRecord = {
  id: "job-1",
  source: "chatgpt",
  mode: "sql",
  status: "queued",
  createdAt: Date.now(),
  startedAt: null,
  finishedAt: null,
  durationMs: null,
  error: null,
};

describe("createJobStateMachine", () => {
  it("applies a valid transition and logs it", () => {
    const jobsRepository = createRepositoryMock(baseJob);
    const jobLogService = createLogServiceMock();
    const machine = createJobStateMachine({
      jobsRepository,
      jobLogService,
    });

    machine.transition("job-1", "precheck");

    expect(jobsRepository.updateJobState).toHaveBeenCalledWith("job-1", "precheck", null);
    expect(jobLogService.logStateTransition).toHaveBeenCalledWith("job-1", "queued", "precheck");
  });

  it("throws when transition is not allowed", () => {
    const jobsRepository = createRepositoryMock(baseJob);
    const jobLogService = createLogServiceMock();
    const machine = createJobStateMachine({
      jobsRepository,
      jobLogService,
    });

    expect(() => machine.transition("job-1", "completed")).toThrowError(JobStateTransitionError);
    expect(jobsRepository.updateJobState).not.toHaveBeenCalled();
  });

  it("stores error details when transitioning to a failure state", () => {
    const convertingJob: JobRecord = {
      ...baseJob,
      status: "converting",
    };
    const jobsRepository = createRepositoryMock(convertingJob);
    const jobLogService = createLogServiceMock();
    const machine = createJobStateMachine({
      jobsRepository,
      jobLogService,
    });

    machine.transition("job-1", "failed_convert", "conversion crashed");

    expect(jobsRepository.updateJobState).toHaveBeenCalledWith("job-1", "failed_convert", "conversion crashed");
    expect(jobLogService.logError).toHaveBeenCalledWith("job-1", "state_change", "conversion crashed");
  });
});
