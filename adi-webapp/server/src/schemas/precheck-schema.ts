import { z } from "zod";
import { JOB_MODES, JOB_SOURCES } from "../domain/job-types";

export const precheckRequestSchema = z.object({
  source: z.enum(JOB_SOURCES),
  inputMode: z.enum(["files", "folder"]),
  inputPaths: z.array(z.string().min(1)).min(1),
  userId: z.string().optional(),
  mode: z.enum(JOB_MODES),
  tags: z.array(z.string()).default([]),
  dbPath: z.string().optional(),
  openWebUiBaseUrl: z.string().optional(),
  openWebUiDataDir: z.string().optional(),
  openWebUiAuthToken: z.string().optional(),
  openWebUiApiKey: z.string().optional(),
});

export type PrecheckRequest = z.infer<typeof precheckRequestSchema>;

export type PrecheckIssue = {
  code: string;
  message: string;
  path?: string;
};

export type PrecheckResult = {
  ok: boolean;
  checks: {
    pythonAvailable: boolean;
    scriptPaths: boolean;
    inputsReadable: boolean;
    extensionsValid: boolean;
    userIdPresent: boolean;
    outputWritable: boolean;
  };
  resolvedUserId?: string;
  resolvedOpenWebUiBaseUrl?: string;
  resolvedDbPath?: string;
  resolvedInputFiles: string[];
  fileCount: number;
  totalBytes: number;
  issues: PrecheckIssue[];
};

export const openWebUiDiscoveryRequestSchema = z
  .object({
    mode: z.enum(JOB_MODES).default("sql"),
    userId: z.string().optional(),
    dbPath: z.string().optional(),
    openWebUiBaseUrl: z.string().optional(),
    openWebUiDataDir: z.string().optional(),
    openWebUiAuthToken: z.string().optional(),
    openWebUiApiKey: z.string().optional(),
  })
  .strict();

export type OpenWebUiDiscoveryRequest = z.infer<typeof openWebUiDiscoveryRequestSchema>;

export type OpenWebUiDiscoveryResult = {
  ok: boolean;
  resolvedUserId?: string;
  resolvedOpenWebUiBaseUrl?: string;
  resolvedDbPath?: string;
  issues: PrecheckIssue[];
};
