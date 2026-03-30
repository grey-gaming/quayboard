import type { FastifyPluginAsync } from "fastify";

import {
  jobSchema,
  milestoneActionRequestSchema,
  milestoneDesignDocListResponseSchema,
  milestoneDesignDocSchema,
  milestoneListResponseSchema,
  milestoneSchema,
  updateMilestoneDesignDocRequestSchema,
} from "@quayboard/shared";

import type { AppServices } from "../../app-services.js";
import { HttpError } from "../../services/http-error.js";
import { handleRouteError } from "../route-helpers.js";

const projectParamsJsonSchema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
  },
  required: ["id"],
  additionalProperties: false,
} as const;

const milestoneParamsJsonSchema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
  },
  required: ["id"],
  additionalProperties: false,
} as const;

const designDocParamsJsonSchema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    revisionId: { type: "string", format: "uuid" },
  },
  required: ["id", "revisionId"],
  additionalProperties: false,
} as const;

const publishProjectUpdate = (
  services: AppServices,
  ownerUserId: string,
  projectId: string,
  resource: "feature" | "milestone" | "phase_gates",
) => {
  services.sseHub.publish(ownerUserId, "project:updated", {
    type: "project:updated",
    projectId,
    resource,
  });
};

export const milestoneRoutes = (
  services: AppServices,
): FastifyPluginAsync => async (app) => {
  app.get(
    "/projects/:id/milestones",
    {
      schema: {
        params: projectParamsJsonSchema,
      },
    },
    async (request, reply) => {
      try {
        const projectId = (request.params as { id: string }).id;
        await services.projectSetupService.assertSetupCompleted(request.user!.id, projectId);

        return milestoneListResponseSchema.parse(
          await services.milestoneService.list(request.user!.id, projectId),
        );
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.post(
    "/projects/:id/milestones",
    {
      schema: {
        params: projectParamsJsonSchema,
      },
    },
    async (request, reply) => {
      try {
        const projectId = (request.params as { id: string }).id;
        await services.projectSetupService.assertSetupCompleted(request.user!.id, projectId);
        const milestone = await services.milestoneService.create(
          request.user!.id,
          projectId,
          request.body,
        );
        publishProjectUpdate(services, request.user!.id, projectId, "milestone");

        return milestoneSchema.parse(milestone);
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.post(
    "/projects/:id/milestones/generate",
    {
      schema: {
        params: projectParamsJsonSchema,
      },
    },
    async (request, reply) => {
      try {
        const projectId = (request.params as { id: string }).id;
        await services.projectSetupService.assertSetupCompleted(request.user!.id, projectId);
        const job = await services.jobService.createJob({
          createdByUserId: request.user!.id,
          projectId,
          type: "GenerateMilestones",
        });

        return reply.status(202).send(jobSchema.parse(job));
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.patch(
    "/milestones/:id",
    {
      schema: {
        params: milestoneParamsJsonSchema,
      },
    },
    async (request, reply) => {
      try {
        const milestoneId = (request.params as { id: string }).id;
        const context = await services.milestoneService.getContext(request.user!.id, milestoneId);
        await services.projectSetupService.assertSetupCompleted(request.user!.id, context.projectId);
        const milestone = await services.milestoneService.update(
          request.user!.id,
          milestoneId,
          request.body,
        );
        publishProjectUpdate(services, request.user!.id, context.projectId, "milestone");

        return milestoneSchema.parse(milestone);
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.post(
    "/milestones/:id",
    {
      schema: {
        params: milestoneParamsJsonSchema,
      },
    },
    async (request, reply) => {
      try {
        const milestoneId = (request.params as { id: string }).id;
        const context = await services.milestoneService.getContext(request.user!.id, milestoneId);
        await services.projectSetupService.assertSetupCompleted(request.user!.id, context.projectId);
        const payload = milestoneActionRequestSchema.parse(request.body);
        const canonicalDesignDoc = await services.milestoneService.getCanonicalDesignDoc(
          request.user!.id,
          milestoneId,
        );
        const milestone = await services.milestoneService.transition(
          request.user!.id,
          milestoneId,
          payload,
        );
        if (payload.action === "approve" && canonicalDesignDoc) {
          await services.artifactApprovalService.approve(
            request.user!.id,
            context.projectId,
            "milestone_design_doc",
            canonicalDesignDoc.id,
          );
        }
        publishProjectUpdate(services, request.user!.id, context.projectId, "phase_gates");

        return milestoneSchema.parse(milestone);
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.post(
    "/projects/:id/milestones/review",
    {
      schema: {
        params: projectParamsJsonSchema,
      },
    },
    async (request, reply) => {
      try {
        const projectId = (request.params as { id: string }).id;
        await services.projectSetupService.assertSetupCompleted(request.user!.id, projectId);
        const job = await services.jobService.createJob({
          createdByUserId: request.user!.id,
          projectId,
          type: "ReviewMilestoneMap",
        });
        publishProjectUpdate(services, request.user!.id, projectId, "milestone");

        return reply.status(202).send(jobSchema.parse(job));
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.post(
    "/milestones/:id/scope-review",
    {
      schema: {
        params: milestoneParamsJsonSchema,
      },
    },
    async (request, reply) => {
      try {
        const milestoneId = (request.params as { id: string }).id;
        const context = await services.milestoneService.getContext(request.user!.id, milestoneId);
        await services.projectSetupService.assertSetupCompleted(request.user!.id, context.projectId);
        await services.milestoneService.assertActiveMilestone(
          request.user!.id,
          context.projectId,
          milestoneId,
        );
        const job = await services.jobService.createJob({
          createdByUserId: request.user!.id,
          projectId: context.projectId,
          type: "ReviewMilestoneScope",
          inputs: { milestoneId },
        });
        publishProjectUpdate(services, request.user!.id, context.projectId, "milestone");

        return reply.status(202).send(jobSchema.parse(job));
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.post(
    "/milestones/:id/reconciliation/review",
    {
      schema: {
        params: milestoneParamsJsonSchema,
      },
    },
    async (request, reply) => {
      try {
        const milestoneId = (request.params as { id: string }).id;
        const context = await services.milestoneService.getContext(request.user!.id, milestoneId);
        await services.projectSetupService.assertSetupCompleted(request.user!.id, context.projectId);
        await services.milestoneService.assertActiveMilestone(
          request.user!.id,
          context.projectId,
          milestoneId,
        );
        const job = await services.jobService.createJob({
          createdByUserId: request.user!.id,
          projectId: context.projectId,
          type: "ReviewMilestoneScope",
          inputs: { milestoneId },
        });
        publishProjectUpdate(services, request.user!.id, context.projectId, "milestone");

        return reply.status(202).send(jobSchema.parse(job));
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.get(
    "/milestones/:id/design-docs",
    {
      schema: {
        params: milestoneParamsJsonSchema,
      },
    },
    async (request, reply) => {
      try {
        const milestoneId = (request.params as { id: string }).id;
        const context = await services.milestoneService.getContext(request.user!.id, milestoneId);
        const docs = await services.milestoneService.listDesignDocs(request.user!.id, milestoneId);
        const approvals = await Promise.all(
          docs.map((doc) =>
            services.artifactApprovalService.getApproval(
              context.projectId,
              "milestone_design_doc",
              doc.id,
            ),
          ),
        );

        return milestoneDesignDocListResponseSchema.parse({
          designDocs: docs.map((doc, index) => ({
            id: doc.id,
            milestoneId: doc.milestoneId,
            version: doc.version,
            title: doc.title,
            markdown: doc.markdown,
            source: doc.source,
            isCanonical: doc.isCanonical,
            createdAt: doc.createdAt.toISOString(),
            approval: approvals[index],
          })),
        });
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.post(
    "/milestones/:id/design-docs",
    {
      schema: {
        params: milestoneParamsJsonSchema,
      },
    },
    async (request, reply) => {
      try {
        const milestoneId = (request.params as { id: string }).id;
        const context = await services.milestoneService.getContext(request.user!.id, milestoneId);
        await services.projectSetupService.assertSetupCompleted(request.user!.id, context.projectId);
        await services.milestoneService.assertActiveMilestone(
          request.user!.id,
          context.projectId,
          milestoneId,
        );

        if (context.status !== "draft") {
          throw new HttpError(
            409,
            "milestone_locked",
            "Only draft milestones can generate a design document.",
          );
        }

        const job = await services.jobService.createJob({
          createdByUserId: request.user!.id,
          projectId: context.projectId,
          type: "GenerateMilestoneDesign",
          inputs: {
            milestoneId,
          },
        });

        return reply.status(202).send(jobSchema.parse(job));
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.patch(
    "/milestones/:id/design-docs",
    {
      schema: {
        params: milestoneParamsJsonSchema,
      },
    },
    async (request, reply) => {
      try {
        const milestoneId = (request.params as { id: string }).id;
        const context = await services.milestoneService.getContext(request.user!.id, milestoneId);
        await services.projectSetupService.assertSetupCompleted(request.user!.id, context.projectId);
        await services.milestoneService.assertActiveMilestone(
          request.user!.id,
          context.projectId,
          milestoneId,
        );

        if (context.status !== "draft") {
          throw new HttpError(409, "milestone_locked", "Only draft milestones can be edited.");
        }

        const canonical = await services.milestoneService.getCanonicalDesignDoc(
          request.user!.id,
          milestoneId,
        );

        if (!canonical) {
          throw new HttpError(
            404,
            "milestone_design_doc_not_found",
            "Milestone design document not found.",
          );
        }

        const payload = updateMilestoneDesignDocRequestSchema.parse(request.body);
        const updatedDoc = await services.milestoneService.createDesignDocVersion({
          milestoneId,
          title: canonical.title,
          markdown: payload.markdown,
          source: "ManualEdit",
        });
        const approval = await services.artifactApprovalService.getApproval(
          context.projectId,
          "milestone_design_doc",
          updatedDoc.id,
        );

        publishProjectUpdate(services, request.user!.id, context.projectId, "phase_gates");

        return milestoneDesignDocSchema.parse({
          id: updatedDoc.id,
          milestoneId: updatedDoc.milestoneId,
          version: updatedDoc.version,
          title: updatedDoc.title,
          markdown: updatedDoc.markdown,
          source: updatedDoc.source,
          isCanonical: updatedDoc.isCanonical,
          createdAt: updatedDoc.createdAt.toISOString(),
          approval,
        });
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.post(
    "/milestones/:id/design-docs/:revisionId/approve",
    {
      schema: {
        params: designDocParamsJsonSchema,
      },
    },
    async (request, reply) => {
      try {
        const params = request.params as { id: string; revisionId: string };
        const context = await services.milestoneService.getContext(request.user!.id, params.id);
        await services.projectSetupService.assertSetupCompleted(request.user!.id, context.projectId);
        const designDocs = await services.milestoneService.listDesignDocs(request.user!.id, params.id);
        const approvedDoc = designDocs.find((doc) => doc.id === params.revisionId);

        if (!approvedDoc) {
          throw new HttpError(
            404,
            "milestone_design_doc_not_found",
            "Milestone design document not found.",
          );
        }

        const approval = await services.artifactApprovalService.approve(
          request.user!.id,
          context.projectId,
          "milestone_design_doc",
          params.revisionId,
        );

        publishProjectUpdate(services, request.user!.id, context.projectId, "phase_gates");

        return milestoneDesignDocSchema.parse({
          id: approvedDoc.id,
          milestoneId: approvedDoc.milestoneId,
          version: approvedDoc.version,
          title: approvedDoc.title,
          markdown: approvedDoc.markdown,
          source: approvedDoc.source,
          isCanonical: approvedDoc.isCanonical,
          createdAt: approvedDoc.createdAt.toISOString(),
          approval,
        });
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );
};
