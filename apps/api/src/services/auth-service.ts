import { and, eq, gt } from "drizzle-orm";

import type { AppDatabase } from "../db/client.js";
import { sessionsTable, usersTable } from "../db/schema.js";
import { generateId } from "./ids.js";
import { isUniqueViolationError } from "./db-errors.js";
import { HttpError } from "./http-error.js";
import { hashPassword, verifyPassword } from "./passwords.js";
import {
  SESSION_TTL_MS,
  createSessionToken,
  hashSessionToken,
} from "./session-tokens.js";
import { toUser } from "./user-mappers.js";

type RegisterInput = {
  displayName: string;
  email: string;
  password: string;
};

type LoginInput = {
  email: string;
  password: string;
};

const createSessionExpiry = () => new Date(Date.now() + SESSION_TTL_MS);

export const createAuthService = (db: AppDatabase) => ({
  async register(input: RegisterInput) {
    const existingUser = await db.query.usersTable.findFirst({
      where: eq(usersTable.email, input.email.toLowerCase()),
    });

    if (existingUser) {
      throw new HttpError(409, "email_taken", "An account already exists for this email.");
    }

    const passwordHash = await hashPassword(input.password);
    const now = new Date();
    let user;
    try {
      [user] = await db
        .insert(usersTable)
        .values({
          id: generateId(),
          email: input.email.toLowerCase(),
          passwordHash,
          displayName: input.displayName.trim(),
          avatarUrl: null,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
    } catch (error) {
      if (isUniqueViolationError(error)) {
        throw new HttpError(
          409,
          "email_taken",
          "An account already exists for this email.",
        );
      }

      throw error;
    }

    const session = await this.createSession(user.id);

    return {
      session,
      user: toUser(user),
    };
  },

  async login(input: LoginInput) {
    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.email, input.email.toLowerCase()),
    });

    if (!user || !(await verifyPassword(user.passwordHash, input.password))) {
      throw new HttpError(401, "invalid_credentials", "Invalid email or password.");
    }

    const session = await this.createSession(user.id);

    return {
      session,
      user: toUser(user),
    };
  },

  async createSession(userId: string) {
    const token = createSessionToken();
    const now = new Date();
    const expiresAt = createSessionExpiry();

    const [session] = await db
      .insert(sessionsTable)
      .values({
        id: generateId(),
        userId,
        tokenHash: hashSessionToken(token),
        expiresAt,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return {
      cookieValue: token,
      session: {
        id: session.id,
        userId: session.userId,
        expiresAt: session.expiresAt.toISOString(),
        createdAt: session.createdAt.toISOString(),
        updatedAt: session.updatedAt.toISOString(),
      },
    };
  },

  async authenticate(token: string | undefined) {
    if (!token) {
      return null;
    }

    const hashedToken = hashSessionToken(token);
    const [session] = await db
      .select({
        user: usersTable,
      })
      .from(sessionsTable)
      .innerJoin(usersTable, eq(usersTable.id, sessionsTable.userId))
      .where(
        and(
          eq(sessionsTable.tokenHash, hashedToken),
          gt(sessionsTable.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (!session?.user) {
      return null;
    }

    return {
      sessionToken: token,
      user: toUser(session.user),
    };
  },

  async getCurrentUser(token: string | undefined) {
    const authenticated = await this.authenticate(token);

    if (!authenticated) {
      throw new HttpError(401, "unauthorized", "Authentication is required.");
    }

    return authenticated.user;
  },

  async logout(token: string | undefined) {
    if (!token) {
      return;
    }

    await db
      .delete(sessionsTable)
      .where(eq(sessionsTable.tokenHash, hashSessionToken(token)));
  },
});

export type AuthService = ReturnType<typeof createAuthService>;
