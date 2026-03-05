import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({ path: path.resolve(process.cwd(), "../.env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  SERVER_HOST: z.string().default("0.0.0.0"),
  SERVER_PORT: z.coerce.number().int().positive().default(8787),
  API_BASE_URL: z.string().default("http://localhost:8787"),
  PYTHON_BIN: z.string().min(1).default("python"),
  IMPORTER_ROOT: z.string().min(1).default("../openwebui-importer"),
  PATH_MAPPING: z.string().optional(),
  APP_DB: z.string().min(1).default("./storage/app.db"),
  UPLOADS_DIR: z.string().min(1).default("./storage/uploads"),
  WORK_DIR: z.string().min(1).default("./storage/work"),
  PREVIEW_DIR: z.string().min(1).default("./storage/preview"),
  SQL_DIR: z.string().min(1).default("./storage/sql"),
  BACKUPS_DIR: z.string().min(1).default("./storage/backups"),
  MAX_INPUT_FILES: z.coerce.number().int().positive().default(200),
  MAX_INPUT_TOTAL_BYTES: z.coerce.number().int().positive().default(104_857_600),
  SUBPROCESS_TIMEOUT_MS: z.coerce.number().int().positive().default(120_000),
  SSE_HEARTBEAT_MS: z.coerce.number().int().positive().default(10_000),
});

export type EnvConfig = {
  nodeEnv: "development" | "test" | "production";
  serverHost: string;
  serverPort: number;
  apiBaseUrl: string;
  pythonBin: string;
  importerRoot: string;
  pathMapping: Array<{ host: string; container: string }>;
  appDbPath: string;
  uploadsDir: string;
  workDir: string;
  previewDir: string;
  sqlDir: string;
  backupsDir: string;
  maxInputFiles: number;
  maxInputTotalBytes: number;
  subprocessTimeoutMs: number;
  sseHeartbeatMs: number;
};

const parsePathMapping = (mapping?: string): Array<{ host: string; container: string }> => {
  if (!mapping) return [];
  return mapping.split(';').map(entry => {
    const [host, container] = entry.split(':');
    return { host: host?.trim(), container: container?.trim() };
  }).filter(m => m.host && m.container);
};

const resolveFromAppRoot = (appRoot: string, inputPath: string): string => {
  return path.isAbsolute(inputPath) ? inputPath : path.resolve(appRoot, inputPath);
};

export const loadEnv = (): EnvConfig => {
  const parsed = envSchema.parse(process.env);
  const appRoot = path.resolve(process.cwd(), "..");

  return {
    nodeEnv: parsed.NODE_ENV,
    serverHost: parsed.SERVER_HOST,
    serverPort: parsed.SERVER_PORT,
    apiBaseUrl: parsed.API_BASE_URL,
    pythonBin: parsed.PYTHON_BIN,
    importerRoot: resolveFromAppRoot(appRoot, parsed.IMPORTER_ROOT),
    pathMapping: parsePathMapping(parsed.PATH_MAPPING),
    appDbPath: resolveFromAppRoot(appRoot, parsed.APP_DB),
    uploadsDir: resolveFromAppRoot(appRoot, parsed.UPLOADS_DIR),
    workDir: resolveFromAppRoot(appRoot, parsed.WORK_DIR),
    previewDir: resolveFromAppRoot(appRoot, parsed.PREVIEW_DIR),
    sqlDir: resolveFromAppRoot(appRoot, parsed.SQL_DIR),
    backupsDir: resolveFromAppRoot(appRoot, parsed.BACKUPS_DIR),
    maxInputFiles: parsed.MAX_INPUT_FILES,
    maxInputTotalBytes: parsed.MAX_INPUT_TOTAL_BYTES,
    subprocessTimeoutMs: parsed.SUBPROCESS_TIMEOUT_MS,
    sseHeartbeatMs: parsed.SSE_HEARTBEAT_MS,
  };
};

export const ensureRuntimeDirectories = (config: EnvConfig): void => {
  const directories = [
    config.uploadsDir,
    config.workDir,
    config.previewDir,
    config.sqlDir,
    config.backupsDir,
    path.dirname(config.appDbPath),
  ];

  for (const directory of directories) {
    fs.mkdirSync(directory, { recursive: true });
  }
};
