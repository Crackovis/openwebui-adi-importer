import { spawn } from "node:child_process";
import type { JobSource } from "../domain/job-types";
import {
  getBatchScriptPath,
  getConverterScriptPath,
  getCreateSqlScriptPath,
} from "./script-registry";
import { translateHostPathToContainer } from "../lib/path-safety";

export type ProcessResult = {
  command: string;
  args: string[];
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
};

export type AdapterErrorCode = "PROCESS_EXIT_NON_ZERO" | "PROCESS_TIMEOUT" | "PROCESS_SPAWN_ERROR";

export class PythonAdapterError extends Error {
  public readonly code: AdapterErrorCode;
  public readonly details: Record<string, unknown>;

  public constructor(code: AdapterErrorCode, message: string, details: Record<string, unknown>) {
    super(message);
    this.name = "PythonAdapterError";
    this.code = code;
    this.details = details;
  }
}

type SpawnDeps = {
  spawnProcess?: typeof spawn;
};

export type PythonAdapterOptions = {
  pythonBin: string;
  importerRoot: string;
  timeoutMs: number;
  pathMapping?: Array<{ host: string; container: string }>;
} & SpawnDeps;

export type RunConverterInput = {
  source: JobSource;
  files: string[];
  userId: string;
  outputDir: string;
};

export type RunCreateSqlInput = {
  inputs: string[];
  outputFile: string;
  tags: string[];
};

export type RunBatchInput = {
  source: JobSource;
  inputDir: string;
  userId: string;
  outputDir: string;
  sqlOutput?: string;
};

const runCommand = async (
  command: string,
  args: string[],
  timeoutMs: number,
  spawnProcess: typeof spawn,
): Promise<ProcessResult> => {
  const startedAt = Date.now();
  return new Promise<ProcessResult>((resolve, reject) => {
    const child = spawnProcess(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(
        new PythonAdapterError("PROCESS_SPAWN_ERROR", "Unable to start Python process.", {
          command,
          args,
          reason: error.message,
        }),
      );
    });

    child.on("close", (exitCode) => {
      clearTimeout(timer);
      const durationMs = Date.now() - startedAt;

      if (timedOut) {
        reject(
          new PythonAdapterError("PROCESS_TIMEOUT", "Python process timed out.", {
            command,
            args,
            timeoutMs,
            stdout,
            stderr,
          }),
        );
        return;
      }

      if (typeof exitCode !== "number" || exitCode !== 0) {
        reject(
          new PythonAdapterError("PROCESS_EXIT_NON_ZERO", "Python process exited with an error.", {
            command,
            args,
            exitCode,
            stdout,
            stderr,
          }),
        );
        return;
      }

      resolve({
        command,
        args,
        exitCode,
        stdout,
        stderr,
        durationMs,
      });
    });
  });
};

export type PythonAdapter = {
  probePython: () => Promise<ProcessResult>;
  runConverter: (input: RunConverterInput) => Promise<ProcessResult>;
  runCreateSql: (input: RunCreateSqlInput) => Promise<ProcessResult>;
  runBatch: (input: RunBatchInput) => Promise<ProcessResult>;
};

export const createPythonAdapter = (options: PythonAdapterOptions): PythonAdapter => {
  const spawnProcess = options.spawnProcess ?? spawn;
  const pathMapping = options.pathMapping ?? [];

  const probePython = (): Promise<ProcessResult> => {
    return runCommand(options.pythonBin, ["--version"], options.timeoutMs, spawnProcess);
  };

  const runConverter = async (input: RunConverterInput): Promise<ProcessResult> => {
    const scriptPath = getConverterScriptPath(options.importerRoot, input.source);
    const translatedFiles = input.files.map(f => translateHostPathToContainer(f, pathMapping));
    const translatedOutputDir = translateHostPathToContainer(input.outputDir, pathMapping);
    
    const args = [
      scriptPath,
      "--userid",
      input.userId,
      "--output-dir",
      translatedOutputDir,
      ...translatedFiles,
    ];
    return runCommand(options.pythonBin, args, options.timeoutMs, spawnProcess);
  };

  const runCreateSql = async (input: RunCreateSqlInput): Promise<ProcessResult> => {
    const scriptPath = getCreateSqlScriptPath(options.importerRoot);
    const translatedInputs = input.inputs.map(f => translateHostPathToContainer(f, pathMapping));
    const translatedOutputFile = translateHostPathToContainer(input.outputFile, pathMapping);
    
    const tagsArg = input.tags.join(",");
    const args = [scriptPath, ...translatedInputs, "--tags", tagsArg, "--output", translatedOutputFile];
    return runCommand(options.pythonBin, args, options.timeoutMs, spawnProcess);
  };

  const runBatch = async (input: RunBatchInput): Promise<ProcessResult> => {
    const scriptPath = getBatchScriptPath(options.importerRoot);
    const translatedInputDir = translateHostPathToContainer(input.inputDir, pathMapping);
    const translatedOutputDir = translateHostPathToContainer(input.outputDir, pathMapping);
    const translatedSqlOutput = input.sqlOutput ? translateHostPathToContainer(input.sqlOutput, pathMapping) : undefined;
    
    const args = [
      scriptPath,
      "--input-dir",
      translatedInputDir,
      "--type",
      input.source,
      "--user-id",
      input.userId,
      "--output-dir",
      translatedOutputDir,
    ];
    if (translatedSqlOutput) {
      args.push("--sql-output", translatedSqlOutput);
    }
    return runCommand(options.pythonBin, args, options.timeoutMs, spawnProcess);
  };

  return {
    probePython,
    runConverter,
    runCreateSql,
    runBatch,
  };
};
