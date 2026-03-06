import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { createPythonAdapter, PythonAdapterError } from "../src/services/python-adapter";

type MockChildProcess = EventEmitter & {
  stdout: EventEmitter;
  stderr: EventEmitter;
  kill: (signal?: NodeJS.Signals | number) => boolean;
};

const createMockChildProcess = (): MockChildProcess => {
  const child = new EventEmitter() as MockChildProcess;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = vi.fn(() => true);
  return child;
};

describe("createPythonAdapter", () => {
  it("runs converter with argument array and returns process output", async () => {
    const calls: Array<{ command: string; args: string[]; options: Record<string, unknown> }> = [];

    const spawnProcess = vi.fn((command: string, args: string[], options: Record<string, unknown>) => {
      calls.push({ command, args, options });
      const child = createMockChildProcess();
      process.nextTick(() => {
        child.stdout.emit("data", Buffer.from("converter-ok", "utf8"));
        child.stderr.emit("data", Buffer.from("", "utf8"));
        child.emit("close", 0);
      });
      return child as unknown as ReturnType<typeof import("node:child_process").spawn>;
    });

    const adapter = createPythonAdapter({
      pythonBin: "python",
      importerRoot: "/opt/openwebui-importer",
      timeoutMs: 1000,
      spawnProcess: spawnProcess as unknown as typeof import("node:child_process").spawn,
    });

    const result = await adapter.runConverter({
      source: "chatgpt",
      files: ["/tmp/chat-1.json"],
      userId: "user-1",
      outputDir: "/tmp/out",
    });

    expect(spawnProcess).toHaveBeenCalledTimes(1);
    expect(calls[0]?.command).toBe("python");
    expect(calls[0]?.args[0]).toContain("convert_chatgpt.py");
    expect(calls[0]?.args).toEqual([
      expect.stringContaining("convert_chatgpt.py"),
      "--userid",
      "user-1",
      "--output-dir",
      "/tmp/out",
      "/tmp/chat-1.json",
    ]);
    expect(calls[0]?.options).toMatchObject({ shell: false, windowsHide: true });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("converter-ok");
  });

  it("throws PROCESS_EXIT_NON_ZERO when subprocess fails", async () => {
    const spawnProcess = vi.fn(() => {
      const child = createMockChildProcess();
      process.nextTick(() => {
        child.stderr.emit("data", Buffer.from("boom", "utf8"));
        child.emit("close", 2);
      });
      return child as unknown as ReturnType<typeof import("node:child_process").spawn>;
    });

    const adapter = createPythonAdapter({
      pythonBin: "python",
      importerRoot: "/opt/openwebui-importer",
      timeoutMs: 1000,
      spawnProcess: spawnProcess as unknown as typeof import("node:child_process").spawn,
    });

    await expect(adapter.probePython()).rejects.toBeInstanceOf(PythonAdapterError);
    await expect(adapter.probePython()).rejects.toMatchObject({
      code: "PROCESS_EXIT_NON_ZERO",
    });
  });

  it("uses dynamic runtime options when provided", async () => {
    const calls: Array<{ command: string; args: string[] }> = [];
    const runtime = {
      pythonBin: "python-a",
      importerRoot: "/opt/importer-a",
      timeoutMs: 1000,
    };

    const spawnProcess = vi.fn((command: string, args: string[]) => {
      calls.push({ command, args });
      const child = createMockChildProcess();
      process.nextTick(() => {
        child.emit("close", 0);
      });
      return child as unknown as ReturnType<typeof import("node:child_process").spawn>;
    });

    const adapter = createPythonAdapter({
      getRuntimeOptions: () => runtime,
      spawnProcess: spawnProcess as unknown as typeof import("node:child_process").spawn,
    });

    await adapter.runConverter({
      source: "chatgpt",
      files: ["/tmp/chat-1.json"],
      userId: "user-1",
      outputDir: "/tmp/out",
    });

    runtime.pythonBin = "python-b";
    runtime.importerRoot = "/opt/importer-b";

    await adapter.runCreateSql({
      inputs: ["/tmp/chat-1.json"],
      outputFile: "/tmp/out.sql",
      tags: ["imported-chatgpt"],
    });

    expect(calls[0]?.command).toBe("python-a");
    expect(calls[0]?.args[0]).toContain("importer-a");
    expect(calls[1]?.command).toBe("python-b");
    expect(calls[1]?.args[0]).toContain("importer-b");
  });
});
