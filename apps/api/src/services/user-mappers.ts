import type { InferSelectModel } from "drizzle-orm";

import type { User } from "@quayboard/shared";

import { usersTable } from "../db/schema.js";

type UserRecord = InferSelectModel<typeof usersTable>;

export const toUser = (record: UserRecord): User => ({
  id: record.id,
  email: record.email,
  displayName: record.displayName,
  avatarUrl: record.avatarUrl,
  createdAt: record.createdAt.toISOString(),
  updatedAt: record.updatedAt.toISOString(),
});
