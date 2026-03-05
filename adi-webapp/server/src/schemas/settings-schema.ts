import { z } from "zod";

export const settingsUpdateSchema = z
  .object({
    pythonBin: z.string().min(1).optional(),
    importerRoot: z.string().min(1).optional(),
    maxInputFiles: z.number().int().positive().optional(),
    maxInputTotalBytes: z.number().int().positive().optional(),
    subprocessTimeoutMs: z.number().int().positive().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one settings field is required.",
  });

export type SettingsUpdate = z.infer<typeof settingsUpdateSchema>;
