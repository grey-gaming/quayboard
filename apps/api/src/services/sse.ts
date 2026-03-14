import type { FastifyReply } from "fastify";

import { sseConnectedEventSchema, sseHeartbeatEventSchema } from "@quayboard/shared";

type Client = {
  heartbeat: NodeJS.Timeout;
  reply: FastifyReply;
};

const HEARTBEAT_MS = 15_000;

const formatEvent = (event: string, payload: unknown) =>
  `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;

export const createSseHub = () => {
  const clients = new Map<string, Set<Client>>();

  const addClient = (userId: string, reply: FastifyReply) => {
    reply.raw.write(
      formatEvent(
        "connected",
        sseConnectedEventSchema.parse({
          type: "connected",
          timestamp: new Date().toISOString(),
        }),
      ),
    );

    const heartbeat = setInterval(() => {
      reply.raw.write(
        formatEvent(
          "heartbeat",
          sseHeartbeatEventSchema.parse({
            type: "heartbeat",
            timestamp: new Date().toISOString(),
          }),
        ),
      );
    }, HEARTBEAT_MS);

    const client = { heartbeat, reply };
    const existing = clients.get(userId) ?? new Set<Client>();
    existing.add(client);
    clients.set(userId, existing);

    const removeClient = () => {
      clearInterval(heartbeat);
      const userClients = clients.get(userId);

      if (!userClients) {
        return;
      }

      userClients.delete(client);
      if (userClients.size === 0) {
        clients.delete(userId);
      }
    };

    reply.raw.on("close", removeClient);

    return removeClient;
  };

  return {
    addClient,
    publish(userId: string, event: string, payload: unknown) {
      const userClients = clients.get(userId);
      if (!userClients) {
        return;
      }

      for (const client of userClients) {
        client.reply.raw.write(formatEvent(event, payload));
      }
    },
    closeAll() {
      for (const userClients of clients.values()) {
        for (const client of userClients) {
          clearInterval(client.heartbeat);
          client.reply.raw.end();
        }
      }

      clients.clear();
    },
  };
};

export type SseHub = ReturnType<typeof createSseHub>;
