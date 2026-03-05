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

  it("submits a SQL import payload in auto-detect mode", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <ImportWizardPage />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.type(screen.getByLabelText("Paths (one per line)"), "C:\\exports\\chat-1.json");

    await user.click(screen.getByRole("button", { name: "Next" }));
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
        userId?: string;
        tags: string[];
        mode: string;
      },
    ];

    expect(requestPath).toBe("/api/jobs");
    expect(payload).toMatchObject({
      source: "chatgpt",
      inputMode: "files",
      inputPaths: ["C:\\exports\\chat-1.json"],
      tags: ["project-alpha", "migration"],
      mode: "sql",
    });
    expect(payload).not.toHaveProperty("userId");

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
        userId?: string;
        mode: string;
      },
    ];

    expect(payload).toMatchObject({
      inputPaths: ["C:\\uploads\\stored-chat-1.json"],
      mode: "sql",
    });
    expect(payload).not.toHaveProperty("userId");
  });

  it("runs OpenWebUI auto-detection preview from the wizard", async () => {
    const user = userEvent.setup();
    mockedApiPost.mockResolvedValueOnce({
      ok: true,
      resolvedUserId: "resolved-user",
      resolvedOpenWebUiBaseUrl: "http://127.0.0.1:42004",
      resolvedDbPath: "C:\\open-webui\\webui.db",
      issues: [],
    });

    render(
      <MemoryRouter>
        <ImportWizardPage />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Test Auto-Detection" }));

    expect(mockedApiPost).toHaveBeenCalledTimes(1);
    const [requestPath, payload] = mockedApiPost.mock.calls[0] as [
      string,
      {
        mode: string;
      },
    ];

    expect(requestPath).toBe("/api/openwebui/discovery");
    expect(payload).toMatchObject({ mode: "sql" });
    expect(await screen.findByText("resolved-user")).toBeTruthy();
    expect(screen.getByText("http://127.0.0.1:42004")).toBeTruthy();
  });

  it("sends advanced overrides for direct_db mode when enabled", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <ImportWizardPage />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.type(screen.getByLabelText("Paths (one per line)"), "C:\\exports\\chat-1.json");

    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByLabelText("Use advanced OpenWebUI overrides"));
    await user.type(screen.getByLabelText("OpenWebUI User ID Override (optional)"), "advanced-user");
    await user.type(screen.getByLabelText("OpenWebUI Base URL Override (optional)"), "http://127.0.0.1:42004");
    await user.type(screen.getByLabelText("OpenWebUI Token/API key (optional)"), "sk-test-key");

    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.selectOptions(screen.getByLabelText("Import Mode"), "direct_db");
    await user.type(screen.getByLabelText("Target webui.db path override (optional)"), "C:\\open-webui\\webui.db");
    await user.type(screen.getByLabelText("Type CONFIRM_DB_WRITE"), "CONFIRM_DB_WRITE");

    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Run Import" }));

    expect(mockedApiPost).toHaveBeenCalledTimes(1);
    const [, payload] = mockedApiPost.mock.calls[0] as [
      string,
      {
        mode: string;
        userId?: string;
        openWebUiBaseUrl?: string;
        openWebUiAuthToken?: string;
        dbPath?: string;
        confirmationText?: string;
      },
    ];

    expect(payload).toMatchObject({
      mode: "direct_db",
      userId: "advanced-user",
      openWebUiBaseUrl: "http://127.0.0.1:42004",
      openWebUiAuthToken: "sk-test-key",
      dbPath: "C:\\open-webui\\webui.db",
      confirmationText: "CONFIRM_DB_WRITE",
    });
  });
});
