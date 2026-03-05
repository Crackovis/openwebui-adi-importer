import type { FastifyInstance } from "fastify";
import type { EnvConfig } from "../config/env";
import { success } from "../lib/api-response";

type HealthRouteDeps = {
  env: EnvConfig;
};

export const registerHealthRoute = (app: FastifyInstance, deps: HealthRouteDeps): void => {
  app.get("/api/health", async () => {
    return success({
      status: "ok",
      uptimeSeconds: Math.floor(process.uptime()),
      now: new Date().toISOString(),
      nodeEnv: deps.env.nodeEnv,
      importerRoot: deps.env.importerRoot,
    });
  });
};
