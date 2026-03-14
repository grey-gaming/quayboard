import type { FastifyPluginAsync, FastifyReply } from "fastify";

import {
  authUserResponseSchema,
  loginRequestSchema,
  registerRequestSchema,
} from "@quayboard/shared";

import type { AppServices } from "../app-services.js";
import { SESSION_COOKIE_NAME } from "../services/session-tokens.js";
import { handleRouteError, sendApiError } from "./route-helpers.js";

const credentialsBodyJsonSchema = {
  type: "object",
  properties: {
    email: { type: "string", format: "email" },
    password: { type: "string", minLength: 8, maxLength: 200 },
  },
  required: ["email", "password"],
  additionalProperties: false,
} as const;

const authUserResponseJsonSchema = {
  type: "object",
  properties: {
    user: {
      type: "object",
      properties: {
        id: { type: "string", format: "uuid" },
        email: { type: "string", format: "email" },
        displayName: { type: "string" },
        avatarUrl: { type: ["string", "null"], format: "uri" },
        createdAt: { type: "string", format: "date-time" },
        updatedAt: { type: "string", format: "date-time" },
      },
      required: [
        "id",
        "email",
        "displayName",
        "avatarUrl",
        "createdAt",
        "updatedAt",
      ],
      additionalProperties: false,
    },
  },
  required: ["user"],
  additionalProperties: false,
} as const;

const registerBodyJsonSchema = {
  ...credentialsBodyJsonSchema,
  properties: {
    ...credentialsBodyJsonSchema.properties,
    displayName: { type: "string", minLength: 1, maxLength: 120 },
  },
  required: ["displayName", "email", "password"],
} as const;

const applySessionCookie = (
  reply: FastifyReply,
  cookieValue: string,
) => {
  reply.setCookie(SESSION_COOKIE_NAME, cookieValue, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60,
  });
};

export const authRoutes = (services: AppServices): FastifyPluginAsync => async (app) => {
  app.post(
    "/auth/register",
    {
      schema: {
        body: registerBodyJsonSchema,
        response: {
          200: authUserResponseJsonSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const input = registerRequestSchema.parse(request.body);
        const { session, user } = await services.authService.register(input);
        applySessionCookie(reply, session.cookieValue);
        return authUserResponseSchema.parse({ user });
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.post(
    "/auth/login",
    {
      schema: {
        body: credentialsBodyJsonSchema,
        response: {
          200: authUserResponseJsonSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const input = loginRequestSchema.parse(request.body);
        const { session, user } = await services.authService.login(input);
        applySessionCookie(reply, session.cookieValue);
        return authUserResponseSchema.parse({ user });
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.post("/auth/logout", async (request, reply) => {
    try {
      await services.authService.logout(request.cookies[SESSION_COOKIE_NAME]);
      reply.clearCookie(SESSION_COOKIE_NAME, {
        path: "/",
      });
      return reply.status(204).send();
    } catch (error) {
      return handleRouteError(reply, error);
    }
  });

  app.get(
    "/auth/me",
    {
      schema: {
        response: {
          200: authUserResponseJsonSchema,
          401: {
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
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const user = await services.authService.getCurrentUser(
          request.cookies[SESSION_COOKIE_NAME],
        );
        return authUserResponseSchema.parse({ user });
      } catch (error) {
        if (error instanceof Error && "statusCode" in error) {
          return sendApiError(reply, 401, "unauthorized", "Authentication is required.");
        }

        return handleRouteError(reply, error);
      }
    },
  );
};
