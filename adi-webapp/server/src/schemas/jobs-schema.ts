import { z } from "zod";
import { JOB_MODES, JOB_SOURCES, JOB_STATUSES } from "../domain/job-types";
import { DB_IMPORT_CONFIRMATION_TEXT } from "./db-import-schema";

const sharedJobSchema = z.object({
  source: z.enum(JOB_SOURCES),
  inputMode: z.enum(["files", "folder"]),
  inputPaths: z.array(z.string().min(1)).min(1),
  userId: z.string().min(1),
  tags: z.array(z.string()).default([]),
  mode: z.enum(JOB_MODES),
});

const sqlJobSchema = sharedJobSchema.extend({
  mode: z.literal("sql"),
  dbPath: z.string().optional(),
  confirmationText: z.string().optional(),
});

const directDbJobSchema = sharedJobSchema.extend({
  mode: z.literal("direct_db"),
  dbPath: z.string().min(1),
  confirmationText: z.literal(DB_IMPORT_CONFIRMATION_TEXT),
});

export const createJobRequestSchema = z.discriminatedUnion("mode", [sqlJobSchema, directDbJobSchema]);

export const listJobsQuerySchema = z
  .object({
    status: z.enum(JOB_STATUSES).optional(),
    source: z.enum(JOB_SOURCES).optional(),
    mode: z.enum(JOB_MODES).optional(),
    fromTs: z.coerce.number().int().positive().optional(),
    toTs: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(200).default(100),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();

export type CreateJobRequest = z.infer<typeof createJobRequestSchema>;
export type ListJobsQuery = z.infer<typeof listJobsQuerySchema>;
