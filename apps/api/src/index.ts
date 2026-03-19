import { createAppServices } from "./app-services.js";
import { readHttpConfig } from "./config.js";
import { readDatabaseUrl, readSecretsEncryptionKey } from "./config.js";
import { buildServer } from "./server.js";

const start = async () => {
  const config = readHttpConfig();
  const { services, close } = await createAppServices(
    readDatabaseUrl(),
    readSecretsEncryptionKey(),
  );
  const server = await buildServer({
    corsOrigin: config.corsOrigin,
    services,
  });

  try {
    await server.listen({ host: "0.0.0.0", port: config.apiPort });
  } catch (error) {
    server.log.error(error);
    process.exitCode = 1;
  }

  const shutdown = async () => {
    await server.close();
    await close();
  };

  process.on("SIGINT", () => {
    void shutdown();
  });
  process.on("SIGTERM", () => {
    void shutdown();
  });
};

void start();
