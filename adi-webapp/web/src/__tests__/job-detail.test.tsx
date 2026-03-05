/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { apiGet } from "../api/client";
import { useJobStream } from "../features/job-stream/useJobStream";
import { JobDetailPage } from "../pages/JobDetailPage";
import type { JobDetail } from "../types";

vi.mock("../api/client", () => ({
  apiGet: vi.fn(),
}));

vi.mock("../features/job-stream/useJobStream", () => ({
  useJobStream: vi.fn(),
}));

vi.mock("../features/jobs/retryJob", () => ({
  retryJob: vi.fn(),
}));

const baseJobDetail: JobDetail = {
  id: "job-abc-123",
  source: "chatgpt",
  mode: "sql",
  status: "failed_sql",
  createdAt: Date.now(),
  startedAt: Date.now(),
  finishedAt: Date.now(),
  durationMs: 100,
  error: "SQL generation failed.",
  input: {
    jobId: "job-abc-123",
    userId: "user-42",
    tagsCsv: "project-alpha",
    inputMode: "files",
    inputPaths: JSON.stringify(["C:\\exports\\chat-1.json"]),
    dbPath: null,
  },
  output: {
    jobId: "job-abc-123",
    convertedCount: 1,
    previewPath: "C:/tmp/preview.json",
    sqlPath: "C:/tmp/job.sql",
    backupPath: null,
    appliedToDb: 0,
  },
  timeline: [
    {
      id: 1,
      jobId: "job-abc-123",
      ts: Date.now(),
      level: "info",
      step: "sql",
      message: "Stored timeline log",
    },
  ],
};

describe("JobDetailPage", () => {
  const mockedApiGet = vi.mocked(apiGet);
  const mockedUseJobStream = vi.mocked(useJobStream);

  beforeEach(() => {
    mockedApiGet.mockReset();
    mockedUseJobStream.mockReset();

    mockedApiGet.mockResolvedValue(baseJobDetail);
    mockedUseJobStream.mockReturnValue({
      logs: [
        {
          id: 2,
          jobId: "job-abc-123",
          ts: Date.now(),
          level: "info",
          step: "stream",
          message: "Live stream log entry",
        },
      ],
      status: "failed_sql",
      streamError: null,
      connected: true,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders job detail metadata and timeline logs", async () => {
    render(
      <MemoryRouter initialEntries={["/jobs/job-abc-123"]}>
        <Routes>
          <Route path="/jobs/:id" element={<JobDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Job Detail")).toBeTruthy();
    expect(await screen.findByText("Retry Failed Job")).toBeTruthy();
    expect(await screen.findByText(/User ID:\s*user-42/i)).toBeTruthy();
    expect(await screen.findByText("Stored timeline log")).toBeTruthy();
    expect(await screen.findByText("Live stream log entry")).toBeTruthy();
    expect(await screen.findByText("Download SQL Artifact")).toBeTruthy();
  });
});
