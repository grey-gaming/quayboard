import type { FastifyInstance, FastifyReply, FastifyRequest, RouteShorthandOptions } from "fastify";
import { ZodError } from "zod";

import { apiErrorResponseSchema } from "@quayboard/shared";

import type { AppServices } from "../app-services.js";
import { isHttpError } from "../services/http-error.js";
import { SESSION_COOKIE_NAME } from "../services/session-tokens.js";

type StubRoute = {
  method: "DELETE" | "GET" | "PATCH" | "POST" | "PUT";
  url: string;
  schema?: RouteShorthandOptions["schema"];
};

export const apiErrorResponseJsonSchema = {
  type: "object",
  properties: {
    error: {
      type: "object",
      properties: {
        code: { type: "string" },
        message: { type: "string" },
      },
      required: ["code", "message"],
      additionalProperties: false,
    },
  },
  required: ["error"],
  additionalProperties: false,
} as const;

export const sendApiError = (
  reply: FastifyReply,
  statusCode: number,
  code: string,
  message: string,
) =>
  reply.status(statusCode).send(
    apiErrorResponseSchema.parse({
      error: { code, message },
    }),
  );

export const handleRouteError = (reply: FastifyReply, error: unknown) => {
  if (error instanceof ZodError) {
    return sendApiError(
      reply,
      400,
      "invalid_request",
      error.issues[0]?.message ?? "Request validation failed.",
    );
  }

  if (isHttpError(error)) {
    return sendApiError(reply, error.statusCode, error.code, error.message);
  }

  reply.log.error(error);
  return sendApiError(
    reply,
    500,
    "internal_error",
    "An unexpected error occurred.",
  );
};

export const requireAuthenticatedUser =
  (services: AppServices) => async (request: FastifyRequest, reply: FastifyReply) => {
    const token = request.cookies[SESSION_COOKIE_NAME];
    const authenticated = await services.authService.authenticate(token);

    if (!authenticated) {
      return sendApiError(
        reply,
        401,
        "unauthorized",
        "Authentication is required.",
      );
    }

    request.sessionToken = authenticated.sessionToken;
    request.user = authenticated.user;
  };

export const registerNotImplementedRoutes = (
  app: FastifyInstance,
  routes: StubRoute[],
) => {
  for (const route of routes) {
    app.route({
      method: route.method,
      url: route.url,
      schema: {
        ...(route.schema ?? {}),
        response: {
          501: apiErrorResponseJsonSchema,
        },
      },
      handler: async (_request, reply) =>
        sendApiError(
          reply,
          501,
          "not_implemented",
          "This endpoint belongs to a later milestone.",
        ),
    });
  }
};
