import type { FastifyInstance } from "fastify";
import type { EnvConfig } from "../config/env";
import type { SettingsRepository } from "../db/repositories/settings-repository";
import { failure, success } from "../lib/api-response";
import { settingsUpdateSchema } from "../schemas/settings-schema";

type SettingsRouteDeps = {
  env: EnvConfig;
  settingsRepository: SettingsRepository;
};

type EffectiveSettings = {
  pythonBin: string;
  importerRoot: string;
  maxInputFiles: number;
  maxInputTotalBytes: number;
  subprocessTimeoutMs: number;
};

const defaultsFromEnv = (env: EnvConfig): EffectiveSettings => {
  return {
    pythonBin: env.pythonBin,
    importerRoot: env.importerRoot,
    maxInputFiles: env.maxInputFiles,
    maxInputTotalBytes: env.maxInputTotalBytes,
    subprocessTimeoutMs: env.subprocessTimeoutMs,
  };
};

const mergeEffectiveSettings = (
  base: EffectiveSettings,
  persisted: Record<string, unknown> | null,
): EffectiveSettings => {
  if (!persisted) {
    return base;
  }

  return {
    pythonBin: typeof persisted.pythonBin === "string" ? persisted.pythonBin : base.pythonBin,
    importerRoot: typeof persisted.importerRoot === "string" ? persisted.importerRoot : base.importerRoot,
    maxInputFiles:
      typeof persisted.maxInputFiles === "number" ? persisted.maxInputFiles : base.maxInputFiles,
    maxInputTotalBytes:
      typeof persisted.maxInputTotalBytes === "number"
        ? persisted.maxInputTotalBytes
        : base.maxInputTotalBytes,
    subprocessTimeoutMs:
      typeof persisted.subprocessTimeoutMs === "number"
        ? persisted.subprocessTimeoutMs
        : base.subprocessTimeoutMs,
  };
};

export const registerSettingsRoute = (app: FastifyInstance, deps: SettingsRouteDeps): void => {
  app.get("/api/settings", async () => {
    const defaults = defaultsFromEnv(deps.env);
    const stored = deps.settingsRepository.getOne("app");
    return success(mergeEffectiveSettings(defaults, stored));
  });

  app.put("/api/settings", async (request, reply) => {
    const parsed = settingsUpdateSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400);
      return failure("SETTINGS_VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid settings payload.");
    }

    const defaults = defaultsFromEnv(deps.env);
    const current = mergeEffectiveSettings(defaults, deps.settingsRepository.getOne("app"));
    const merged = {
      ...current,
      ...parsed.data,
    };
    deps.settingsRepository.setOne("app", merged);
    return success(merged);
  });
};
