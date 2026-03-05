import { z } from "zod";
import { JOB_MODES, JOB_SOURCES } from "../domain/job-types";

export const precheckRequestSchema = z.object({
  source: z.enum(JOB_SOURCES),
  inputMode: z.enum(["files", "folder"]),
  inputPaths: z.array(z.string().min(1)).min(1),
  userId: z.string().min(1),
  mode: z.enum(JOB_MODES),
  tags: z.array(z.string()).default([]),
  dbPath: z.string().optional(),
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
  resolvedInputFiles: string[];
  fileCount: number;
  totalBytes: number;
  issues: PrecheckIssue[];
};
