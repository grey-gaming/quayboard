import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema.js";

export const createPostgresClient = (databaseUrl: string) =>
  postgres(databaseUrl, { max: 1 });

export const createPostgresDatabase = (databaseUrl: string) => {
  const client = createPostgresClient(databaseUrl);

  return {
    client,
    db: drizzle(client, { schema }),
  };
};

export type AppDatabase = ReturnType<typeof createPostgresDatabase>["db"];
