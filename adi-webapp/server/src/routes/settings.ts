import type { FastifyInstance } from "fastify";
import type { SettingsRepository } from "../db/repositories/settings-repository";
import { failure, success } from "../lib/api-response";
import { settingsUpdateSchema } from "../schemas/settings-schema";
import type { RuntimeSettings } from "../services/runtime-settings";

type SettingsRouteDeps = {
  settingsRepository: SettingsRepository;
  getRuntimeSettings: () => RuntimeSettings;
};

export const registerSettingsRoute = (app: FastifyInstance, deps: SettingsRouteDeps): void => {
  app.get("/api/settings", async () => {
    return success(deps.getRuntimeSettings());
  });

  app.put("/api/settings", async (request, reply) => {
    const parsed = settingsUpdateSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400);
      return failure("SETTINGS_VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid settings payload.");
    }

    const current = deps.getRuntimeSettings();
    const merged = {
      ...current,
      ...parsed.data,
    };
    deps.settingsRepository.setOne("app", merged);
    return success(merged);
  });
};
