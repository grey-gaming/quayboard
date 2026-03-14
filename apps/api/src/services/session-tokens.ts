import { createHash, randomBytes } from "node:crypto";

export const SESSION_COOKIE_NAME = "qb_session";
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const createSessionToken = () => randomBytes(32).toString("base64url");

export const hashSessionToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");
