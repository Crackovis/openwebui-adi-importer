/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { apiPost } from "../api/client";
import { ImportWizardPage } from "../pages/ImportWizardPage";

vi.mock("../api/client", () => ({
  apiPost: vi.fn(),
}));

describe("ImportWizardPage", () => {
  const mockedApiPost = vi.mocked(apiPost);

  beforeEach(() => {
    mockedApiPost.mockReset();
    mockedApiPost.mockResolvedValue({
      id: "job-123",
      status: "queued",
      createdAt: Date.now(),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("submits a SQL import payload through the wizard flow", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <ImportWizardPage />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.type(screen.getByLabelText("Paths (one per line)"), "C:\\exports\\chat-1.json");

    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.type(screen.getByLabelText("OpenWebUI User ID"), "user-123");
    await user.type(screen.getByLabelText("Custom Tags (comma separated)"), "project-alpha, migration");

    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Run Import" }));

    expect(mockedApiPost).toHaveBeenCalledTimes(1);
    const [requestPath, payload] = mockedApiPost.mock.calls[0] as [
      string,
      {
        source: string;
        inputMode: string;
        inputPaths: string[];
        userId: string;
        tags: string[];
        mode: string;
      },
    ];

    expect(requestPath).toBe("/api/jobs");
    expect(payload).toMatchObject({
      source: "chatgpt",
      inputMode: "files",
      inputPaths: ["C:\\exports\\chat-1.json"],
      userId: "user-123",
      tags: ["project-alpha", "migration"],
      mode: "sql",
    });

    expect(await screen.findByText("Job created:")).toBeTruthy();
    expect(screen.getByRole("link", { name: "job-123" })).toBeTruthy();
  });
});
