import { z } from "zod";

export const DB_IMPORT_CONFIRMATION_TEXT = "CONFIRM_DB_WRITE";

export const dbImportRequestSchema = z.object({
  dbPath: z.string().trim().min(1),
  sqlPath: z.string().trim().min(1),
  confirmationText: z.literal(DB_IMPORT_CONFIRMATION_TEXT),
});

export type DbImportRequest = z.infer<typeof dbImportRequestSchema>;
