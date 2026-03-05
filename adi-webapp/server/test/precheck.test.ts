import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { EnvConfig } from "../src/config/env";
import { createPrecheckService } from "../src/services/precheck-service";
import type { PythonAdapter } from "../src/services/python-adapter";

const createTestEnv = (rootDir: string): EnvConfig => {
  return {
    nodeEnv: "test",
    serverHost: "127.0.0.1",
    serverPort: 8787,
    apiBaseUrl: "http://localhost:8787",
    pythonBin: "python",
    importerRoot: path.join(rootDir, "importer"),
    appDbPath: path.join(rootDir, "app.db"),
    uploadsDir: path.join(rootDir, "uploads"),
    workDir: path.join(rootDir, "work"),
    previewDir: path.join(rootDir, "preview"),
    sqlDir: path.join(rootDir, "sql"),
    backupsDir: path.join(rootDir, "backups"),
    maxInputFiles: 10,
    maxInputTotalBytes: 1024 * 1024,
    subprocessTimeoutMs: 1000,
    sseHeartbeatMs: 1000,
  };
};

const writeImporterScripts = (importerRoot: string): void => {
  fs.mkdirSync(path.join(importerRoot, "scripts"), { recursive: true });
  fs.writeFileSync(path.join(importerRoot, "convert_chatgpt.py"), "# test script\n", "utf8");
  fs.writeFileSync(path.join(importerRoot, "create_sql.py"), "# test script\n", "utf8");
  fs.writeFileSync(path.join(importerRoot, "scripts", "run_batch.py"), "# test script\n", "utf8");
};

const createPythonAdapterMock = (): PythonAdapter => {
  return {
    probePython: vi.fn().mockResolvedValue({
      command: "python",
      args: ["--version"],
      exitCode: 0,
      stdout: "Python 3.11",
      stderr: "",
      durationMs: 5,
    }),
    runConverter: vi.fn(),
    runCreateSql: vi.fn(),
    runBatch: vi.fn(),
  };
};

describe("createPrecheckService", () => {
  it("returns ok for valid files input", async () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "adi-precheck-ok-"));
    try {
      const env = createTestEnv(rootDir);
      writeImporterScripts(env.importerRoot);
      const inputFile = path.join(rootDir, "inputs", "chat-1.json");
      fs.mkdirSync(path.dirname(inputFile), { recursive: true });
      fs.writeFileSync(inputFile, "{}", "utf8");

      const pythonAdapter = createPythonAdapterMock();
      const service = createPrecheckService({
        env,
        pythonAdapter,
      });

      const result = await service.run({
        source: "chatgpt",
        inputMode: "files",
        inputPaths: [inputFile],
        userId: "user-1",
        mode: "sql",
        tags: ["alpha"],
      });

      expect(result.ok).toBe(true);
      expect(result.fileCount).toBe(1);
      expect(result.resolvedInputFiles).toEqual([inputFile]);
      expect(result.issues).toEqual([]);
      expect(pythonAdapter.probePython).toHaveBeenCalledTimes(1);
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it("reports extension validation failure for unsupported source file", async () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "adi-precheck-ext-"));
    try {
      const env = createTestEnv(rootDir);
      writeImporterScripts(env.importerRoot);
      const inputFile = path.join(rootDir, "inputs", "chat-1.txt");
      fs.mkdirSync(path.dirname(inputFile), { recursive: true });
      fs.writeFileSync(inputFile, "plain text", "utf8");

      const service = createPrecheckService({
        env,
        pythonAdapter: createPythonAdapterMock(),
      });

      const result = await service.run({
        source: "chatgpt",
        inputMode: "files",
        inputPaths: [inputFile],
        userId: "user-2",
        mode: "sql",
        tags: [],
      });

      expect(result.ok).toBe(false);
      expect(result.issues.some((issue) => issue.code === "INPUT_EXTENSION_INVALID")).toBe(true);
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });
});
