import fs from "node:fs";
import os from "node:os";
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
  openWebUiDiscoveryRequestSchema,
  precheckRequestSchema,
  type OpenWebUiDiscoveryResult,
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

type IdentityResolution = {
  resolvedUserId?: string;
  resolvedOpenWebUiBaseUrl?: string;
};

type DbResolution = {
  resolvedDbPath?: string;
};

type OpenWebUiResolutionRequest = Pick<
  PrecheckRequest,
  "userId" | "openWebUiBaseUrl" | "openWebUiAuthToken" | "openWebUiApiKey"
>;

type OpenWebUiDbResolutionRequest = Pick<PrecheckRequest, "mode" | "dbPath" | "openWebUiDataDir">;

type OpenWebUiIdentityPayload = {
  id?: unknown;
  user?: {
    id?: unknown;
  };
  data?: {
    id?: unknown;
    user?: {
      id?: unknown;
    };
  };
};

const DEFAULT_OPENWEBUI_HOSTS = [
  "localhost",
  "127.0.0.1",
  "host.docker.internal",
  "172.17.0.1",
];

const DEFAULT_OPENWEBUI_PORTS = [3000, 8080, 42004];

const DEFAULT_OPENWEBUI_BASE_URLS = DEFAULT_OPENWEBUI_HOSTS.flatMap((host) => {
  return DEFAULT_OPENWEBUI_PORTS.map((port) => `http://${host}:${port}`);
});

const toIssue = (code: string, message: string, inputPath?: string): PrecheckIssue => {
  return inputPath
    ? {
        code,
        message,
        path: inputPath,
      }
    : { code, message };
};

const normalizeBaseUrl = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
};

const uniqueValues = (values: Array<string | null | undefined>): string[] => {
  const normalized = values.filter((value): value is string => typeof value === "string" && value.length > 0);
  return [...new Set(normalized)];
};

const buildOpenWebUiCandidates = (request: OpenWebUiResolutionRequest, env: EnvConfig): string[] => {
  const explicitBaseUrl = normalizeBaseUrl(request.openWebUiBaseUrl ?? env.openWebUiBaseUrl ?? "");
  if (explicitBaseUrl) {
    return [explicitBaseUrl];
  }

  const envCandidates = env.openWebUiDiscoveryUrls.map((candidate) => normalizeBaseUrl(candidate));
  return uniqueValues([...envCandidates, ...DEFAULT_OPENWEBUI_BASE_URLS]);
};

const buildIdentityHeaders = (request: OpenWebUiResolutionRequest, env: EnvConfig): Record<string, string> => {
  const token = request.openWebUiAuthToken?.trim() || env.openWebUiAuthToken;
  const apiKey = request.openWebUiApiKey?.trim() || env.openWebUiApiKey;
  if (token) {
    return {
      Authorization: `Bearer ${token}`,
    };
  }

  if (apiKey) {
    return {
      Authorization: `Bearer ${apiKey}`,
    };
  }

  return {};
};

const pickIdentityId = (payload: unknown): string | null => {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const typed = payload as OpenWebUiIdentityPayload;
  const candidate = typed.id ?? typed.user?.id ?? typed.data?.id ?? typed.data?.user?.id;
  return typeof candidate === "string" && candidate.trim().length > 0 ? candidate.trim() : null;
};

const fetchCurrentUserId = async (
  baseUrl: string,
  request: OpenWebUiResolutionRequest,
  env: EnvConfig,
): Promise<string | null> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, env.openWebUiDiscoveryTimeoutMs);

  try {
    const response = await fetch(`${baseUrl}/api/v1/auths/`, {
      method: "GET",
      headers: buildIdentityHeaders(request, env),
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as unknown;
    return pickIdentityId(payload);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
};

const resolveIdentity = async (
  request: OpenWebUiResolutionRequest,
  env: EnvConfig,
  issues: PrecheckIssue[],
): Promise<IdentityResolution> => {
  const explicitUserId = request.userId?.trim();
  if (explicitUserId) {
    return {
      resolvedUserId: explicitUserId,
      resolvedOpenWebUiBaseUrl: normalizeBaseUrl(request.openWebUiBaseUrl ?? "") ?? undefined,
    };
  }

  const candidates = buildOpenWebUiCandidates(request, env);
  for (const candidate of candidates) {
    const discoveredUserId = await fetchCurrentUserId(candidate, request, env);
    if (discoveredUserId) {
      return {
        resolvedUserId: discoveredUserId,
        resolvedOpenWebUiBaseUrl: candidate,
      };
    }
  }

  issues.push(
    toIssue(
      "USER_ID_UNRESOLVED",
      "Unable to resolve OpenWebUI user identity. Provide userId explicitly, or provide valid OpenWebUI auth credentials and base URL.",
    ),
  );

  if (request.openWebUiBaseUrl && !normalizeBaseUrl(request.openWebUiBaseUrl)) {
    issues.push(toIssue("OPENWEBUI_BASE_URL_INVALID", "openWebUiBaseUrl must be a valid http/https URL."));
  }

  return {};
};

const extractSqlitePath = (databaseUrl: string): string | null => {
  const trimmed = databaseUrl.trim();
  if (!trimmed.toLowerCase().startsWith("sqlite:")) {
    return null;
  }

  const withoutQuery = trimmed.split("?")[0];
  if (withoutQuery.startsWith("sqlite:////")) {
    return path.normalize(`/${withoutQuery.slice("sqlite:////".length)}`);
  }

  if (withoutQuery.startsWith("sqlite:///")) {
    return path.normalize(withoutQuery.slice("sqlite:///".length));
  }

  return null;
};

const toAbsoluteIfNeeded = (appRoot: string, candidatePath: string): string => {
  return path.isAbsolute(candidatePath) ? path.normalize(candidatePath) : path.resolve(appRoot, candidatePath);
};

const buildDbPathCandidates = (
  request: OpenWebUiDbResolutionRequest,
  env: EnvConfig,
  appRoot: string,
): string[] => {
  const explicitDataDir = request.openWebUiDataDir?.trim();
  const envDataDir = env.openWebUiDataDir?.trim();
  const sqlitePath = env.openWebUiDatabaseUrl ? extractSqlitePath(env.openWebUiDatabaseUrl) : null;
  const homeDir = os.homedir();

  const candidates = [
    explicitDataDir ? path.join(explicitDataDir, "webui.db") : null,
    envDataDir ? path.join(envDataDir, "webui.db") : null,
    sqlitePath,
    "/app/backend/data/webui.db",
    path.resolve(appRoot, "data", "webui.db"),
    path.resolve(appRoot, "..", "data", "webui.db"),
    path.resolve(homeDir, ".open-webui", "webui.db"),
  ];

  return uniqueValues(candidates).map((candidate) => toAbsoluteIfNeeded(appRoot, candidate));
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

const validateDirectDbInput = (
  request: OpenWebUiDbResolutionRequest,
  basePath: string,
  env: EnvConfig,
  issues: PrecheckIssue[],
): DbResolution => {
  if (request.mode !== "direct_db") {
    return {};
  }

  if (request.dbPath?.trim()) {
    try {
      const resolvedDbPath = resolveSafePath(basePath, request.dbPath);
      ensureReadableFile(resolvedDbPath);
      return {
        resolvedDbPath,
      };
    } catch (error) {
      const code = error instanceof PathSafetyError ? error.code : "DB_PATH_INVALID";
      const message = error instanceof Error ? error.message : "dbPath is invalid or not readable.";
      issues.push(toIssue(code, message, request.dbPath));
      return {};
    }
  }

  const inferredCandidates = buildDbPathCandidates(request, env, basePath);
  for (const candidate of inferredCandidates) {
    try {
      ensureReadableFile(candidate);
      return {
        resolvedDbPath: candidate,
      };
    } catch {
      continue;
    }
  }

  issues.push(
    toIssue(
      "DB_PATH_UNRESOLVED",
      "Unable to resolve OpenWebUI database path. Provide dbPath explicitly or set OPENWEBUI_DATA_DIR/OPENWEBUI_DATABASE_URL.",
    ),
  );

  return {};
};

const buildResult = (
  issues: PrecheckIssue[],
  files: string[],
  totalBytes: number,
  identity: IdentityResolution,
  dbResolution: DbResolution,
): PrecheckResult => {
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
    resolvedUserId: identity.resolvedUserId,
    resolvedOpenWebUiBaseUrl: identity.resolvedOpenWebUiBaseUrl,
    resolvedDbPath: dbResolution.resolvedDbPath,
    resolvedInputFiles: files,
    fileCount: files.length,
    totalBytes,
    issues,
  };
};

export type PrecheckService = {
  run: (input: unknown) => Promise<PrecheckResult>;
  discoverOpenWebUi: (input: unknown) => Promise<OpenWebUiDiscoveryResult>;
};

export const createPrecheckService = (deps: PrecheckServiceDeps): PrecheckService => {
  const appRoot = path.resolve(process.cwd(), "..");

  const discoverOpenWebUi = async (input: unknown): Promise<OpenWebUiDiscoveryResult> => {
    const parsed = openWebUiDiscoveryRequestSchema.safeParse(input ?? {});
    if (!parsed.success) {
      return {
        ok: false,
        issues: [
          toIssue(
            "OPENWEBUI_DISCOVERY_INPUT_INVALID",
            parsed.error.issues[0]?.message ?? "Invalid OpenWebUI discovery input.",
          ),
        ],
      };
    }

    const request = parsed.data;
    const issues: PrecheckIssue[] = [];
    const identity = await resolveIdentity(request, deps.env, issues);
    const dbResolution = validateDirectDbInput(request, appRoot, deps.env, issues);

    return {
      ok: issues.length === 0,
      resolvedUserId: identity.resolvedUserId,
      resolvedOpenWebUiBaseUrl: identity.resolvedOpenWebUiBaseUrl,
      resolvedDbPath: dbResolution.resolvedDbPath,
      issues,
    };
  };

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
    const identity = await resolveIdentity(request, deps.env, issues);

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
    const dbResolution = validateDirectDbInput(request, appRoot, deps.env, issues);

    const stats = computeStats(collectedFiles, deps.env.maxInputTotalBytes, issues, deps.env.pathMapping);
    return buildResult(issues, stats.files, stats.totalBytes, identity, dbResolution);
  };

  return {
    discoverOpenWebUi,
    run,
  };
};
