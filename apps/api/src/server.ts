import cors from "@fastify/cors";
import Fastify from "fastify";

import { healthRoute } from "./routes/health.js";

export type ServerOptions = {
  corsOrigin: string;
};

export const buildServer = async ({ corsOrigin }: ServerOptions) => {
  const app = Fastify({
    logger: false,
  });

  await app.register(cors, {
    origin: corsOrigin,
  });

  await app.register(healthRoute);

  return app;
};
