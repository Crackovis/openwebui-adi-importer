import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
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
import type { RuntimeSettings } from "./runtime-settings";
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
  getRuntimeSettings?: () => RuntimeSettings;
};

type InputStats = {
  files: string[];
  totalBytes: number;
};

type IdentityResolution = {
  resolvedUserId?: string;
  resolvedOpenWebUiBaseUrl?: string;
  resolvedDbPath?: string;
};

type DbResolution = {
  resolvedDbPath?: string;
};

type OpenWebUiResolutionRequest = Pick<
  PrecheckRequest,
  "mode" | "userId" | "dbPath" | "openWebUiBaseUrl" | "openWebUiDataDir" | "openWebUiAuthToken" | "openWebUiApiKey"
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

type OpenWebUiIdentityLookupResult = {
  userId?: string;
  statusCode?: number;
};

type OpenWebUiUserRow = {
  id?: unknown;
  role?: unknown;
};

type SqliteLikeError = Error & {
  code?: unknown;
};

const DEFAULT_OPENWEBUI_HOSTS = [
  "localhost",
  "127.0.0.1",
  "host.docker.internal",
  "172.17.0.1",
];

const DEFAULT_OPENWEBUI_PORTS = [3000, 8080, 42004];

const WINDOWS_ABSOLUTE_PATH_PATTERN = /^[A-Za-z]:[\\/]/;
const WINDOWS_UNC_PATH_PATTERN = /^\\\\/;

const PINOKIO_WINDOWS_DB_PATHS = [
  "C:\\pinokio\\api\\OpenWebUI\\app\\env\\Lib\\site-packages\\open_webui\\data\\webui.db",
  "C:\\pinokio\\api\\OpenWebUI\\app\\backend\\data\\webui.db",
  "C:\\pinokio\\api\\OpenWebUI\\data\\webui.db",
];

const PINOKIO_DB_RELATIVE_PATHS = [
  "api/OpenWebUI/app/env/Lib/site-packages/open_webui/data/webui.db",
  "api/OpenWebUI/app/backend/data/webui.db",
  "api/OpenWebUI/data/webui.db",
  "api/openwebui/app/env/Lib/site-packages/open_webui/data/webui.db",
  "api/openwebui/app/backend/data/webui.db",
  "api/openwebui/data/webui.db",
  "api/open-webui/app/env/Lib/site-packages/open_webui/data/webui.db",
  "api/open-webui/app/backend/data/webui.db",
  "api/open-webui/data/webui.db",
];

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
): Promise<OpenWebUiIdentityLookupResult> => {
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
      return {
        statusCode: response.status,
      };
    }

    const payload = (await response.json()) as unknown;
    return {
      userId: pickIdentityId(payload) ?? undefined,
      statusCode: response.status,
    };
  } catch {
    return {};
  } finally {
    clearTimeout(timeout);
  }
};

const isAbsolutePathLike = (candidatePath: string): boolean => {
  return path.isAbsolute(candidatePath) || WINDOWS_ABSOLUTE_PATH_PATTERN.test(candidatePath) || WINDOWS_UNC_PATH_PATTERN.test(candidatePath);
};

const resolveExplicitDbPath = (basePath: string, dbPath: string): string => {
  const trimmed = dbPath.trim();
  if (isAbsolutePathLike(trimmed)) {
    return path.normalize(trimmed);
  }
  return resolveSafePath(basePath, trimmed);
};

const toAbsoluteIfNeeded = (appRoot: string, candidatePath: string): string => {
  const trimmed = candidatePath.trim();
  return isAbsolutePathLike(trimmed) ? path.normalize(trimmed) : path.resolve(appRoot, trimmed);
};

const buildRuntimePathCandidates = (
  candidatePath: string,
  pathMapping: Array<{ host: string; container: string }>,
): string[] => {
  const translated = translateHostPathToContainer(candidatePath, pathMapping);
  return uniqueValues([candidatePath, translated]);
};

const resolveReadableDbPath = (
  candidates: string[],
  pathMapping: Array<{ host: string; container: string }>,
): string | undefined => {
  for (const candidate of candidates) {
    const runtimeCandidates = buildRuntimePathCandidates(candidate, pathMapping);
    for (const runtimeCandidate of runtimeCandidates) {
      try {
        ensureReadableFile(runtimeCandidate);
        return runtimeCandidate;
      } catch {
        continue;
      }
    }
  }

  return undefined;
};

const readSqliteErrorCode = (error: unknown): string | undefined => {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return undefined;
  }

  const code = (error as SqliteLikeError).code;
  return typeof code === "string" && code.trim().length > 0 ? code.trim() : undefined;
};

const validateDirectDbReadiness = (
  dbPath: string,
  issuePath: string,
  issues: PrecheckIssue[],
): boolean => {
  const issueCountBefore = issues.length;

  try {
    fs.accessSync(dbPath, fs.constants.W_OK);
  } catch {
    issues.push(
      toIssue(
        "DB_PATH_NOT_WRITABLE",
        "OpenWebUI database is not writable. Ensure file permissions allow write access before Direct DB mode.",
        issuePath,
      ),
    );
  }

  let db: Database.Database | undefined;
  try {
    db = new Database(dbPath, {
      readonly: true,
      fileMustExist: true,
    });

    const quickCheck = db.pragma("quick_check", { simple: true });
    if (quickCheck !== "ok") {
      issues.push(
        toIssue(
          "DB_FILE_INVALID",
          `OpenWebUI database integrity check failed (quick_check=${String(quickCheck)}).`,
          issuePath,
        ),
      );
    }
  } catch (error) {
    const sqliteCode = readSqliteErrorCode(error);
    if (sqliteCode === "SQLITE_NOTADB" || sqliteCode === "SQLITE_CORRUPT") {
      issues.push(
        toIssue(
          "DB_FILE_INVALID",
          "Resolved dbPath is not a valid SQLite database file for Direct DB mode.",
          issuePath,
        ),
      );
    } else {
      const message = error instanceof Error ? error.message : "Unable to open OpenWebUI database.";
      issues.push(toIssue("DB_OPEN_FAILED", message, issuePath));
    }
  } finally {
    db?.close();
  }

  return issues.length === issueCountBefore;
};

const buildPinokioDbCandidates = (roots: string[]): string[] => {
  const candidates: string[] = [];
  for (const root of roots) {
    for (const relativePath of PINOKIO_DB_RELATIVE_PATHS) {
      candidates.push(path.join(root, relativePath));
    }
  }

  return uniqueValues(candidates);
};

const normalizeDbUsers = (rows: OpenWebUiUserRow[]): Array<{ id: string; role?: string }> => {
  return rows.flatMap((row) => {
    if (typeof row.id !== "string" || row.id.trim().length === 0) {
      return [];
    }

    return [
      {
        id: row.id.trim(),
        role: typeof row.role === "string" ? row.role.trim().toLowerCase() : undefined,
      },
    ];
  });
};

const pickDbUserId = (rows: OpenWebUiUserRow[]): { userId?: string; multipleUsersFound: boolean } => {
  const users = normalizeDbUsers(rows);
  if (users.length === 0) {
    return {
      multipleUsersFound: false,
    };
  }

  if (users.length === 1) {
    return {
      userId: users[0].id,
      multipleUsersFound: false,
    };
  }

  const adminUsers = users.filter((user) => user.role === "admin");
  if (adminUsers.length === 1) {
    return {
      userId: adminUsers[0].id,
      multipleUsersFound: false,
    };
  }

  return {
    multipleUsersFound: true,
  };
};

const resolveIdentityFromDb = (
  dbPath: string,
): { userId?: string; multipleUsersFound: boolean } => {
  let db: Database.Database | undefined;
  try {
    db = new Database(dbPath, {
      readonly: true,
      fileMustExist: true,
    });
    const rows = db
      .prepare('SELECT id, role FROM "user"')
      .all() as OpenWebUiUserRow[];
    return pickDbUserId(rows);
  } catch {
    return {
      multipleUsersFound: false,
    };
  } finally {
    db?.close();
  }
};

const resolveIdentity = async (
  request: OpenWebUiResolutionRequest,
  appRoot: string,
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
  let sawUnauthorizedLookup = false;
  let reachableBaseUrl: string | undefined;
  for (const candidate of candidates) {
    const lookupResult = await fetchCurrentUserId(candidate, request, env);
    if (lookupResult.userId) {
      return {
        resolvedUserId: lookupResult.userId,
        resolvedOpenWebUiBaseUrl: candidate,
      };
    }

    if (!reachableBaseUrl && typeof lookupResult.statusCode === "number") {
      reachableBaseUrl = candidate;
    }

    sawUnauthorizedLookup = sawUnauthorizedLookup || lookupResult.statusCode === 401;
  }

  const inferredDbPath = resolveReadableDbPath(buildDbPathCandidates(request, env, appRoot), env.pathMapping);
  if (inferredDbPath) {
    const dbIdentity = resolveIdentityFromDb(inferredDbPath);
    if (dbIdentity.userId) {
      return {
        resolvedUserId: dbIdentity.userId,
        resolvedOpenWebUiBaseUrl: reachableBaseUrl,
        resolvedDbPath: inferredDbPath,
      };
    }

    if (dbIdentity.multipleUsersFound) {
      issues.push(
        toIssue(
          "USER_ID_AMBIGUOUS",
          "OpenWebUI database contains multiple users. Provide userId explicitly in advanced overrides.",
        ),
      );
      return {
        resolvedOpenWebUiBaseUrl: reachableBaseUrl,
        resolvedDbPath: inferredDbPath,
      };
    }
  }

  const authHint = sawUnauthorizedLookup
    ? " OpenWebUI responded but rejected identity lookup (401). Provide token/API key, or let discovery read webui.db."
    : "";

  issues.push(
    toIssue(
      "USER_ID_UNRESOLVED",
      `Unable to resolve OpenWebUI user identity. Provide userId explicitly, or provide valid OpenWebUI auth credentials and base URL.${authHint}`,
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

const buildDbPathCandidates = (
  request: OpenWebUiDbResolutionRequest,
  env: EnvConfig,
  appRoot: string,
): string[] => {
  const explicitDbPath = request.dbPath?.trim();
  const explicitDataDir = request.openWebUiDataDir?.trim();
  const envDataDir = env.openWebUiDataDir?.trim();
  const sqlitePath = env.openWebUiDatabaseUrl ? extractSqlitePath(env.openWebUiDatabaseUrl) : null;
  const homeDir = os.homedir();
  const pinokioContainerRoots = env.pathMapping
    .map((entry) => entry.container)
    .filter((value) => value.toLowerCase().includes("pinokio"));
  const pinokioRoots = uniqueValues([
    env.openWebUiPinokioRoot,
    "/pinokio",
    path.join(homeDir, "pinokio"),
    path.join(homeDir, "AppData", "Roaming", "Pinokio"),
    ...pinokioContainerRoots,
  ]);
  const pinokioCandidates = env.nodeEnv === "test" ? [] : buildPinokioDbCandidates(pinokioRoots);

  let normalizedExplicitDbPath: string | null = null;
  if (explicitDbPath) {
    try {
      normalizedExplicitDbPath = resolveExplicitDbPath(appRoot, explicitDbPath);
    } catch {
      normalizedExplicitDbPath = null;
    }
  }

  const deterministicTestCandidates = [
    path.resolve(appRoot, "data", "webui.db"),
    path.resolve(appRoot, "..", "data", "webui.db"),
  ];

  const runtimeDefaultCandidates =
    env.nodeEnv === "test"
      ? deterministicTestCandidates
      : [
          "/app/backend/data/webui.db",
          ...deterministicTestCandidates,
          path.resolve(homeDir, ".open-webui", "webui.db"),
          path.join(homeDir, "open-webui", "data", "webui.db"),
          "C:\\open-webui\\data\\webui.db",
          ...PINOKIO_WINDOWS_DB_PATHS,
          ...pinokioCandidates,
        ];

  const candidates = [
    normalizedExplicitDbPath,
    explicitDataDir ? path.join(explicitDataDir, "webui.db") : null,
    envDataDir ? path.join(envDataDir, "webui.db") : null,
    sqlitePath,
    ...runtimeDefaultCandidates,
  ];

  return uniqueValues(candidates).map((candidate) => toAbsoluteIfNeeded(appRoot, candidate));
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
      const explicitCandidate = resolveExplicitDbPath(basePath, request.dbPath);
      const resolvedDbPath = resolveReadableDbPath([explicitCandidate], env.pathMapping);
      if (!resolvedDbPath) {
        throw new PathSafetyError("DB_PATH_INVALID", `dbPath is not readable: ${request.dbPath}`);
      }
      if (validateDirectDbReadiness(resolvedDbPath, request.dbPath, issues)) {
        return {
          resolvedDbPath,
        };
      }

      return {};
    } catch (error) {
      const code = error instanceof PathSafetyError ? error.code : "DB_PATH_INVALID";
      const message = error instanceof Error ? error.message : "dbPath is invalid or not readable.";
      issues.push(toIssue(code, message, request.dbPath));
      return {};
    }
  }

  const inferredCandidates = buildDbPathCandidates(request, env, basePath);
  const resolvedDbPath = resolveReadableDbPath(inferredCandidates, env.pathMapping);
  if (resolvedDbPath) {
    if (validateDirectDbReadiness(resolvedDbPath, resolvedDbPath, issues)) {
      return {
        resolvedDbPath,
      };
    }

    return {};
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
    resolvedDbPath: dbResolution.resolvedDbPath ?? identity.resolvedDbPath,
    resolvedInputFiles: files,
    fileCount: files.length,
    totalBytes,
    issues,
  };
};

const resolveRuntimeSettings = (deps: PrecheckServiceDeps): RuntimeSettings => {
  if (deps.getRuntimeSettings) {
    return deps.getRuntimeSettings();
  }

  return {
    pythonBin: deps.env.pythonBin,
    importerRoot: deps.env.importerRoot,
    maxInputFiles: deps.env.maxInputFiles,
    maxInputTotalBytes: deps.env.maxInputTotalBytes,
    subprocessTimeoutMs: deps.env.subprocessTimeoutMs,
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
    const identity = await resolveIdentity(request, appRoot, deps.env, issues);
    const dbResolution = validateDirectDbInput(request, appRoot, deps.env, issues);

    return {
      ok: issues.length === 0,
      resolvedUserId: identity.resolvedUserId,
      resolvedOpenWebUiBaseUrl: identity.resolvedOpenWebUiBaseUrl,
      resolvedDbPath: dbResolution.resolvedDbPath ?? identity.resolvedDbPath,
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
    const identity = await resolveIdentity(request, appRoot, deps.env, issues);
    const runtimeSettings = resolveRuntimeSettings(deps);

    try {
      await deps.pythonAdapter.probePython();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Python is unavailable.";
      issues.push(toIssue("PYTHON_UNAVAILABLE", message));
    }

    checkScriptPath(getConverterScriptPath(runtimeSettings.importerRoot, request.source), issues);
    checkScriptPath(getCreateSqlScriptPath(runtimeSettings.importerRoot), issues);
    checkScriptPath(getBatchScriptPath(runtimeSettings.importerRoot), issues);

    const normalizedInputs = normalizeInputPaths(appRoot, request.inputPaths, issues);
    const collectedFiles = collectInputFiles(
      request,
      normalizedInputs,
      runtimeSettings.maxInputFiles,
      issues,
      deps.env.pathMapping,
    );
    if (collectedFiles.length > runtimeSettings.maxInputFiles) {
      issues.push(toIssue("INPUT_TOO_MANY_FILES", `Input exceeds ${runtimeSettings.maxInputFiles} files.`));
    }

    validateExtensions(request.source, collectedFiles, issues, deps.env.pathMapping);
    validateOutputDirectories(deps.env, issues);
    const dbResolution = validateDirectDbInput(request, appRoot, deps.env, issues);

    const stats = computeStats(collectedFiles, runtimeSettings.maxInputTotalBytes, issues, deps.env.pathMapping);
    return buildResult(issues, stats.files, stats.totalBytes, identity, dbResolution);
  };

  return {
    discoverOpenWebUi,
    run,
  };
};
