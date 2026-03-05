import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
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
    pathMapping: [],
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
    openWebUiBaseUrl: undefined,
    openWebUiDiscoveryUrls: [],
    openWebUiDataDir: undefined,
    openWebUiDatabaseUrl: undefined,
    openWebUiAuthToken: undefined,
    openWebUiApiKey: undefined,
    openWebUiDiscoveryTimeoutMs: 1000,
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

const createFetchResponse = (ok: boolean, payload: unknown): Response => {
  return {
    ok,
    json: async () => payload,
  } as Response;
};

describe("createPrecheckService", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

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

  it("resolves user identity from OpenWebUI candidates when userId is omitted", async () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "adi-precheck-identity-"));
    try {
      const env = createTestEnv(rootDir);
      env.openWebUiDiscoveryUrls = ["http://candidate-1:3000", "http://candidate-2:3000"];
      env.openWebUiAuthToken = "test-token";
      writeImporterScripts(env.importerRoot);

      const inputFile = path.join(rootDir, "inputs", "chat-1.json");
      fs.mkdirSync(path.dirname(inputFile), { recursive: true });
      fs.writeFileSync(inputFile, "{}", "utf8");

      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(createFetchResponse(false, {}))
        .mockResolvedValueOnce(createFetchResponse(true, { id: "resolved-user" }));
      vi.stubGlobal("fetch", fetchMock);

      const service = createPrecheckService({
        env,
        pythonAdapter: createPythonAdapterMock(),
      });

      const result = await service.run({
        source: "chatgpt",
        inputMode: "files",
        inputPaths: [inputFile],
        mode: "sql",
        tags: [],
      });

      expect(result.ok).toBe(true);
      expect(result.resolvedUserId).toBe("resolved-user");
      expect(result.resolvedOpenWebUiBaseUrl).toBe("http://candidate-2:3000");
      expect(result.checks.userIdPresent).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it("preserves explicit userId override without identity lookup", async () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "adi-precheck-user-override-"));
    try {
      const env = createTestEnv(rootDir);
      writeImporterScripts(env.importerRoot);

      const inputFile = path.join(rootDir, "inputs", "chat-1.json");
      fs.mkdirSync(path.dirname(inputFile), { recursive: true });
      fs.writeFileSync(inputFile, "{}", "utf8");

      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);

      const service = createPrecheckService({
        env,
        pythonAdapter: createPythonAdapterMock(),
      });

      const result = await service.run({
        source: "chatgpt",
        inputMode: "files",
        inputPaths: [inputFile],
        userId: "explicit-user",
        mode: "sql",
        tags: [],
      });

      expect(result.ok).toBe(true);
      expect(result.resolvedUserId).toBe("explicit-user");
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it("infers Direct DB path from OPENWEBUI_DATA_DIR when dbPath is omitted", async () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "adi-precheck-db-infer-"));
    try {
      const env = createTestEnv(rootDir);
      writeImporterScripts(env.importerRoot);

      const inputFile = path.join(rootDir, "inputs", "chat-1.json");
      fs.mkdirSync(path.dirname(inputFile), { recursive: true });
      fs.writeFileSync(inputFile, "{}", "utf8");

      const openWebUiDataDir = path.join(rootDir, "openwebui-data");
      fs.mkdirSync(openWebUiDataDir, { recursive: true });
      const inferredDbPath = path.join(openWebUiDataDir, "webui.db");
      fs.writeFileSync(inferredDbPath, "sqlite", "utf8");
      env.openWebUiDataDir = openWebUiDataDir;

      const service = createPrecheckService({
        env,
        pythonAdapter: createPythonAdapterMock(),
      });

      const result = await service.run({
        source: "chatgpt",
        inputMode: "files",
        inputPaths: [inputFile],
        userId: "explicit-user",
        mode: "direct_db",
        tags: [],
      });

      expect(result.ok).toBe(true);
      expect(result.resolvedDbPath).toBe(inferredDbPath);
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it("returns actionable non-sensitive identity error when lookup fails", async () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "adi-precheck-identity-fail-"));
    try {
      const env = createTestEnv(rootDir);
      env.openWebUiDiscoveryUrls = ["http://candidate-1:3000"];
      env.openWebUiAuthToken = "super-secret-token";
      writeImporterScripts(env.importerRoot);

      const inputFile = path.join(rootDir, "inputs", "chat-1.json");
      fs.mkdirSync(path.dirname(inputFile), { recursive: true });
      fs.writeFileSync(inputFile, "{}", "utf8");

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(createFetchResponse(false, {})));

      const service = createPrecheckService({
        env,
        pythonAdapter: createPythonAdapterMock(),
      });

      const result = await service.run({
        source: "chatgpt",
        inputMode: "files",
        inputPaths: [inputFile],
        mode: "sql",
        tags: [],
      });

      const identityIssue = result.issues.find((issue) => issue.code === "USER_ID_UNRESOLVED");
      expect(result.ok).toBe(false);
      expect(identityIssue?.message).toContain("Provide userId explicitly");
      expect(identityIssue?.message).not.toContain("super-secret-token");
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it("discovers OpenWebUI identity through discovery endpoint service method", async () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "adi-precheck-discovery-identity-"));
    try {
      const env = createTestEnv(rootDir);
      env.openWebUiDiscoveryUrls = ["http://candidate-1:3000"];
      writeImporterScripts(env.importerRoot);

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(createFetchResponse(true, { id: "discovered-user" })));

      const service = createPrecheckService({
        env,
        pythonAdapter: createPythonAdapterMock(),
      });

      const result = await service.discoverOpenWebUi({
        mode: "sql",
      });

      expect(result.ok).toBe(true);
      expect(result.resolvedUserId).toBe("discovered-user");
      expect(result.resolvedOpenWebUiBaseUrl).toBe("http://candidate-1:3000");
      expect(result.issues).toEqual([]);
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it("discovers OpenWebUI db path for direct_db mode through discovery method", async () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "adi-precheck-discovery-db-"));
    try {
      const env = createTestEnv(rootDir);
      writeImporterScripts(env.importerRoot);

      const openWebUiDataDir = path.join(rootDir, "openwebui-data");
      fs.mkdirSync(openWebUiDataDir, { recursive: true });
      const inferredDbPath = path.join(openWebUiDataDir, "webui.db");
      fs.writeFileSync(inferredDbPath, "sqlite", "utf8");

      const service = createPrecheckService({
        env,
        pythonAdapter: createPythonAdapterMock(),
      });

      const result = await service.discoverOpenWebUi({
        mode: "direct_db",
        userId: "explicit-user",
        openWebUiDataDir,
      });

      expect(result.ok).toBe(true);
      expect(result.resolvedUserId).toBe("explicit-user");
      expect(result.resolvedDbPath).toBe(inferredDbPath);
      expect(result.issues).toEqual([]);
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });
});
