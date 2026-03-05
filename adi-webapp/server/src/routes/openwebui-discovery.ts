import type { FastifyInstance } from "fastify";
import { failure, success } from "../lib/api-response";
import { openWebUiDiscoveryRequestSchema } from "../schemas/precheck-schema";
import type { PrecheckService } from "../services/precheck-service";

type OpenWebUiDiscoveryRouteDeps = {
  precheckService: PrecheckService;
};

export const registerOpenWebUiDiscoveryRoute = (
  app: FastifyInstance,
  deps: OpenWebUiDiscoveryRouteDeps,
): void => {
  app.post("/api/openwebui/discovery", async (request, reply) => {
    const parsed = openWebUiDiscoveryRequestSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      reply.code(400);
      return failure(
        "OPENWEBUI_DISCOVERY_INVALID",
        parsed.error.issues[0]?.message ?? "Invalid OpenWebUI discovery payload.",
      );
    }

    const result = await deps.precheckService.discoverOpenWebUi(parsed.data);
    return success(result);
  });
};
