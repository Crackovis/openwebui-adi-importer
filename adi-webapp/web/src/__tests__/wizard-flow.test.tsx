/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { apiPost, apiPostForm } from "../api/client";
import { ImportWizardPage } from "../pages/ImportWizardPage";

vi.mock("../api/client", () => ({
  apiPost: vi.fn(),
  apiPostForm: vi.fn(),
}));

describe("ImportWizardPage", () => {
  const mockedApiPost = vi.mocked(apiPost);
  const mockedApiPostForm = vi.mocked(apiPostForm);

  beforeEach(() => {
    mockedApiPost.mockReset();
    mockedApiPostForm.mockReset();
    mockedApiPost.mockResolvedValue({
      id: "job-123",
      status: "queued",
      createdAt: Date.now(),
    });
    mockedApiPostForm.mockResolvedValue({
      count: 1,
      files: [
        {
          originalName: "chat-1.json",
          storedName: "stored-chat-1.json",
          path: "C:\\uploads\\stored-chat-1.json",
          size: 128,
        },
      ],
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

  it("uploads selected files and uses uploaded paths in payload", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <ImportWizardPage />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Next" }));
    const fileInput = screen.getByLabelText("Upload files (recommended)");
    const file = new File(["{}"], "chat-1.json", { type: "application/json" });
    await user.upload(fileInput, file);

    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.type(screen.getByLabelText("OpenWebUI User ID"), "user-upload");

    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Run Import" }));

    expect(mockedApiPostForm).toHaveBeenCalledTimes(1);
    expect(mockedApiPostForm).toHaveBeenCalledWith("/api/upload/batch", expect.any(FormData));

    expect(mockedApiPost).toHaveBeenCalledTimes(1);
    const [, payload] = mockedApiPost.mock.calls[0] as [
      string,
      {
        inputPaths: string[];
        userId: string;
        mode: string;
      },
    ];

    expect(payload).toMatchObject({
      inputPaths: ["C:\\uploads\\stored-chat-1.json"],
      userId: "user-upload",
      mode: "sql",
    });
  });
});
