import fs from "node:fs";
import path from "node:path";
import type { EnvConfig } from "../config/env";
import {
  collectDirectoryFiles,
  ensureReadableDirectory,
  ensureReadableFile,
  ensureWritableDirectory,
  PathSafetyError,
  resolveSafePath,
  translateHostPathToContainer,
} from "../lib/path-safety";
import {
  getBatchScriptPath,
  getConverterScriptPath,
  getCreateSqlScriptPath,
  getSourceExtensions,
  isJobSource,
} from "./script-registry";
import type { PythonAdapter } from "./python-adapter";
import {
  precheckRequestSchema,
  type PrecheckIssue,
  type PrecheckRequest,
  type PrecheckResult,
} from "../schemas/precheck-schema";

type PrecheckServiceDeps = {
  env: EnvConfig;
  pythonAdapter: PythonAdapter;
};

type InputStats = {
  files: string[];
  totalBytes: number;
};

const toIssue = (code: string, message: string, inputPath?: string): PrecheckIssue => {
  return inputPath
    ? {
        code,
        message,
        path: inputPath,
      }
    : { code, message };
};

const translatePathsForContainer = (
  filePaths: string[],
  pathMapping: Array<{ host: string; container: string }>
): string[] => {
  return filePaths.map(f => translateHostPathToContainer(f, pathMapping));
};

const checkScriptPath = (scriptPath: string, issues: PrecheckIssue[]): void => {
  if (!fs.existsSync(scriptPath)) {
    issues.push(toIssue("SCRIPT_NOT_FOUND", "Required Python script was not found.", scriptPath));
    return;
  }
  try {
    fs.accessSync(scriptPath, fs.constants.R_OK);
  } catch {
    issues.push(toIssue("SCRIPT_UNREADABLE", "Required Python script is not readable.", scriptPath));
  }
};

const normalizeInputPaths = (basePath: string, inputs: string[], issues: PrecheckIssue[]): string[] => {
  return inputs.flatMap((inputPath) => {
    try {
      return [resolveSafePath(basePath, inputPath)];
    } catch (error) {
      if (error instanceof PathSafetyError) {
        issues.push(toIssue(error.code, error.message, inputPath));
      } else {
        issues.push(toIssue("PATH_INVALID", "Unable to resolve input path.", inputPath));
      }
      return [];
    }
  });
};

const collectInputFiles = (
  request: PrecheckRequest,
  normalizedInputs: string[],
  maxFiles: number,
  issues: PrecheckIssue[],
  pathMapping: Array<{ host: string; container: string }>,
): string[] => {
  if (request.inputMode === "files") {
    return normalizedInputs.flatMap((filePath) => {
      // Translate path for container access
      const containerPath = translateHostPathToContainer(filePath, pathMapping);
      try {
        ensureReadableFile(containerPath);
        return [filePath]; // Return original path for later translation
      } catch (error) {
        const code = error instanceof PathSafetyError ? error.code : "INPUT_UNREADABLE";
        const message = error instanceof Error ? error.message : "Input file is not readable.";
        issues.push(toIssue(code, message, filePath));
        return [];
      }
    });
  }

  if (normalizedInputs.length !== 1) {
    issues.push(toIssue("FOLDER_INPUT_INVALID", "Folder mode expects exactly one folder path."));
    return [];
  }

  const folderPath = normalizedInputs[0];
  const containerFolderPath = translateHostPathToContainer(folderPath, pathMapping);
  try {
    ensureReadableDirectory(containerFolderPath);
    return collectDirectoryFiles(containerFolderPath, maxFiles);
  } catch (error) {
    const code = error instanceof PathSafetyError ? error.code : "FOLDER_UNREADABLE";
    const message = error instanceof Error ? error.message : "Input folder is not readable.";
    issues.push(toIssue(code, message, folderPath));
    return [];
  }
};

const computeStats = (
  files: string[],
  maxBytes: number,
  issues: PrecheckIssue[],
  pathMapping: Array<{ host: string; container: string }>,
): InputStats => {
  let totalBytes = 0;

  for (const filePath of files) {
    const containerPath = translateHostPathToContainer(filePath, pathMapping);
    try {
      const stats = fs.statSync(containerPath);
      totalBytes += stats.size;
    } catch {
      issues.push(toIssue("INPUT_STAT_FAILED", "Unable to read file size.", filePath));
    }
  }

  if (totalBytes > maxBytes) {
    issues.push(toIssue("INPUT_TOO_LARGE", `Input total size exceeds ${maxBytes} bytes.`));
  }

  return {
    files,
    totalBytes,
  };
};

const validateExtensions = (
  source: string,
  files: string[],
  issues: PrecheckIssue[],
  pathMapping: Array<{ host: string; container: string }>,
): void => {
  if (!isJobSource(source)) {
    issues.push(toIssue("SOURCE_NOT_ALLOWED", "Source is not allowed."));
    return;
  }

  const allowed = getSourceExtensions(source);
  for (const filePath of files) {
    const containerPath = translateHostPathToContainer(filePath, pathMapping);
    const extension = path.extname(containerPath).toLowerCase();
    if (!allowed.includes(extension)) {
      issues.push(
        toIssue(
          "INPUT_EXTENSION_INVALID",
          `File extension ${extension || "<none>"} is not valid for source ${source}.`,
          filePath,
        ),
      );
    }
  }
};

const validateOutputDirectories = (env: EnvConfig, issues: PrecheckIssue[]): void => {
  const outputDirs = [env.workDir, env.previewDir, env.sqlDir, env.backupsDir, env.uploadsDir];
  for (const outputDir of outputDirs) {
    try {
      ensureWritableDirectory(outputDir);
    } catch {
      issues.push(toIssue("OUTPUT_NOT_WRITABLE", "Output directory is not writable.", outputDir));
    }
  }
};

const validateDirectDbInput = (request: PrecheckRequest, basePath: string, issues: PrecheckIssue[]): void => {
  if (request.mode !== "direct_db") {
    return;
  }
  if (!request.dbPath) {
    issues.push(toIssue("DB_PATH_REQUIRED", "dbPath is required in Direct DB mode."));
    return;
  }
  try {
    const resolvedDbPath = resolveSafePath(basePath, request.dbPath);
    ensureReadableFile(resolvedDbPath);
  } catch (error) {
    const code = error instanceof PathSafetyError ? error.code : "DB_PATH_INVALID";
    const message = error instanceof Error ? error.message : "dbPath is invalid or not readable.";
    issues.push(toIssue(code, message, request.dbPath));
  }
};

const buildResult = (issues: PrecheckIssue[], files: string[], totalBytes: number): PrecheckResult => {
  const hasIssueCode = (codePrefix: string): boolean => {
    return issues.some((issue) => issue.code.startsWith(codePrefix));
  };

  const checks = {
    pythonAvailable: !hasIssueCode("PYTHON_"),
    scriptPaths: !hasIssueCode("SCRIPT_"),
    inputsReadable: !hasIssueCode("INPUT_") && !hasIssueCode("FOLDER_") && !hasIssueCode("PATH_"),
    extensionsValid: !hasIssueCode("SOURCE_") && !hasIssueCode("INPUT_EXTENSION"),
    userIdPresent: !hasIssueCode("USER_"),
    outputWritable: !hasIssueCode("OUTPUT_"),
  };

  return {
    ok: issues.length === 0,
    checks,
    resolvedInputFiles: files,
    fileCount: files.length,
    totalBytes,
    issues,
  };
};

export type PrecheckService = {
  run: (input: unknown) => Promise<PrecheckResult>;
};

export const createPrecheckService = (deps: PrecheckServiceDeps): PrecheckService => {
  const appRoot = path.resolve(process.cwd(), "..");

  const run = async (input: unknown): Promise<PrecheckResult> => {
    const parsed = precheckRequestSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        checks: {
          pythonAvailable: false,
          scriptPaths: false,
          inputsReadable: false,
          extensionsValid: false,
          userIdPresent: false,
          outputWritable: false,
        },
        resolvedInputFiles: [],
        fileCount: 0,
        totalBytes: 0,
        issues: [toIssue("PRECHECK_INPUT_INVALID", parsed.error.issues[0]?.message ?? "Invalid precheck input.")],
      };
    }

    const request = parsed.data;
    const issues: PrecheckIssue[] = [];

    if (!request.userId.trim()) {
      issues.push(toIssue("USER_ID_REQUIRED", "userId is required."));
    }

    try {
      await deps.pythonAdapter.probePython();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Python is unavailable.";
      issues.push(toIssue("PYTHON_UNAVAILABLE", message));
    }

    checkScriptPath(getConverterScriptPath(deps.env.importerRoot, request.source), issues);
    checkScriptPath(getCreateSqlScriptPath(deps.env.importerRoot), issues);
    checkScriptPath(getBatchScriptPath(deps.env.importerRoot), issues);

    const normalizedInputs = normalizeInputPaths(appRoot, request.inputPaths, issues);
    const collectedFiles = collectInputFiles(
      request,
      normalizedInputs,
      deps.env.maxInputFiles,
      issues,
      deps.env.pathMapping,
    );
    if (collectedFiles.length > deps.env.maxInputFiles) {
      issues.push(toIssue("INPUT_TOO_MANY_FILES", `Input exceeds ${deps.env.maxInputFiles} files.`));
    }

    validateExtensions(request.source, collectedFiles, issues, deps.env.pathMapping);
    validateOutputDirectories(deps.env, issues);
    validateDirectDbInput(request, appRoot, issues);

    const stats = computeStats(collectedFiles, deps.env.maxInputTotalBytes, issues, deps.env.pathMapping);
    return buildResult(issues, stats.files, stats.totalBytes);
  };

  return {
    run,
  };
};
