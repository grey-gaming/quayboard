import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import Fastify from "fastify";

import type { AppServices } from "./app-services.js";
import { authRoutes } from "./routes/auth.js";
import { artifactRoutes } from "./routes/api/artifacts.js";
import { autoAdvanceRoutes } from "./routes/api/auto-advance.js";
import { blueprintRoutes } from "./routes/api/blueprints.js";
import { bugRoutes } from "./routes/api/bugs.js";
import { debugRoutes } from "./routes/api/debug.js";
import { executionSettingsRoutes } from "./routes/api/execution-settings.js";
import { eventsRoutes } from "./routes/api/events.js";
import { featureRoutes } from "./routes/api/features.js";
import { featureWorkstreamRoutes } from "./routes/api/feature-workstreams.js";
import { healthRoute } from "./routes/health.js";
import { milestoneRoutes } from "./routes/api/milestones.js";
import { jobRoutes } from "./routes/api/jobs.js";
import { onePagerRoutes } from "./routes/api/one-pager.js";
import { productSpecRoutes } from "./routes/api/product-spec.js";
import { projectsRoutes } from "./routes/api/projects.js";
import { sandboxRoutes } from "./routes/api/sandbox.js";
import { secretRoutes } from "./routes/api/secrets.js";
import { systemRoutes } from "./routes/api/system.js";
import { taskPlanningRoutes } from "./routes/api/task-planning.js";
import { toolSystemRoutes } from "./routes/api/tool-system.js";
import { userFlowRoutes } from "./routes/api/user-flows.js";
import { requireAuthenticatedUser } from "./routes/route-helpers.js";

export type ServerOptions = {
  corsOrigin: string;
  services: AppServices;
};

export const buildServer = async ({ corsOrigin, services }: ServerOptions) => {
  const app = Fastify({
    logger: false,
  });

  await app.register(cookie);
  await app.register(cors, {
    origin: corsOrigin,
    credentials: true,
  });

  await app.register(healthRoute);
  await app.register(authRoutes(services));
  await app.register(systemRoutes(services), { prefix: "/api" });
  await app.register(async (apiApp) => {
    apiApp.addHook("preHandler", requireAuthenticatedUser(services));
    await apiApp.register(eventsRoutes(services));
    await apiApp.register(projectsRoutes(services));
    await apiApp.register(jobRoutes(services));
    await apiApp.register(secretRoutes(services));
    await apiApp.register(onePagerRoutes(services));
    await apiApp.register(productSpecRoutes(services));
    await apiApp.register(userFlowRoutes(services));
    await apiApp.register(blueprintRoutes(services));
    await apiApp.register(milestoneRoutes(services));
    await apiApp.register(featureRoutes(services));
    await apiApp.register(featureWorkstreamRoutes(services));
    await apiApp.register(taskPlanningRoutes(services));
    await apiApp.register(bugRoutes);
    await apiApp.register(artifactRoutes(services));
    await apiApp.register(autoAdvanceRoutes(services));
    await apiApp.register(executionSettingsRoutes(services));
    await apiApp.register(sandboxRoutes(services));
    await apiApp.register(toolSystemRoutes);
    await apiApp.register(debugRoutes(services));
  }, { prefix: "/api" });

  return app;
};
