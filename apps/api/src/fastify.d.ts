import type { User } from "@quayboard/shared";

declare module "fastify" {
  interface FastifyRequest {
    sessionToken?: string;
    user?: User;
  }
}
