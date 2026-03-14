import "dotenv/config";

import { readHttpConfig } from "./config.js";
import { buildServer } from "./server.js";

const start = async () => {
  const config = readHttpConfig();
  const server = await buildServer({ corsOrigin: config.corsOrigin });

  try {
    await server.listen({ host: "0.0.0.0", port: config.apiPort });
  } catch (error) {
    server.log.error(error);
    process.exitCode = 1;
  }
};

void start();
