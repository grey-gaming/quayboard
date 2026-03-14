import type { FastifyPluginAsync } from "fastify";

import {
  createSecretRequestSchema,
  secretListResponseSchema,
  secretMetadataSchema,
  updateSecretRequestSchema,
} from "@quayboard/shared";

import type { AppServices } from "../../app-services.js";
import { handleRouteError } from "../route-helpers.js";

const secretMetadataJsonSchema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    projectId: { type: "string", format: "uuid" },
    type: { type: "string" },
    maskedIdentifier: { type: "string" },
    createdAt: { type: "string", format: "date-time" },
    rotatedAt: { type: ["string", "null"], format: "date-time" },
  },
  required: [
    "id",
    "projectId",
    "type",
    "maskedIdentifier",
    "createdAt",
    "rotatedAt",
  ],
  additionalProperties: false,
} as const;

const projectParamsJsonSchema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
  },
  required: ["id"],
  additionalProperties: false,
} as const;

const secretParamsJsonSchema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
  },
  required: ["id"],
  additionalProperties: false,
} as const;

const createSecretBodyJsonSchema = {
  type: "object",
  properties: {
    type: { type: "string" },
    value: { type: "string", minLength: 1 },
  },
  required: ["type", "value"],
  additionalProperties: false,
} as const;

const updateSecretBodyJsonSchema = {
  type: "object",
  properties: {
    value: { type: "string", minLength: 1 },
    revoke: { type: "boolean" },
  },
  anyOf: [{ required: ["value"] }, { properties: { revoke: { const: true } } }],
  additionalProperties: false,
} as const;

export const secretRoutes = (services: AppServices): FastifyPluginAsync => async (app) => {
  app.post(
    "/projects/:id/secrets",
    {
      schema: {
        params: projectParamsJsonSchema,
        body: createSecretBodyJsonSchema,
        response: {
          200: secretMetadataJsonSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const secret = await services.secretService.createSecret(
          request.user!.id,
          (request.params as { id: string }).id,
          createSecretRequestSchema.parse(request.body),
        );

        return secretMetadataSchema.parse(secret);
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.get(
    "/projects/:id/secrets",
    {
      schema: {
        params: projectParamsJsonSchema,
        response: {
          200: {
            type: "object",
            properties: {
              secrets: {
                type: "array",
                items: secretMetadataJsonSchema,
              },
            },
            required: ["secrets"],
            additionalProperties: false,
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const secrets = await services.secretService.listSecrets(
          request.user!.id,
          (request.params as { id: string }).id,
        );

        return secretListResponseSchema.parse({ secrets });
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.patch(
    "/secrets/:id",
    {
      schema: {
        params: secretParamsJsonSchema,
        body: updateSecretBodyJsonSchema,
        response: {
          200: secretMetadataJsonSchema,
          204: { type: "null" },
        },
      },
    },
    async (request, reply) => {
      try {
        const secret = await services.secretService.updateSecret(
          request.user!.id,
          (request.params as { id: string }).id,
          updateSecretRequestSchema.parse(request.body),
        );

        if (!secret) {
          return reply.status(204).send();
        }

        return secretMetadataSchema.parse(secret);
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );
};
