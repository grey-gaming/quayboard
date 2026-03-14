import type { FastifyPluginAsync } from "fastify";

import type { AppServices } from "../../app-services.js";

export const eventsRoutes = (services: AppServices): FastifyPluginAsync => async (app) => {
  app.get("/events", async (request, reply) => {
    reply.hijack();
    reply.raw.writeHead(200, {
      Connection: "keep-alive",
      "Cache-Control": "no-cache, no-transform",
      "Content-Type": "text/event-stream",
    });

    const removeClient = services.sseHub.addClient(request.user!.id, reply);
    request.raw.on("close", removeClient);
  });
};
