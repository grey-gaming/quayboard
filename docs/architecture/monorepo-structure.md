# Monorepo Structure

Quayboard is currently a pnpm workspace with four packages:

- `apps/api` contains the Fastify API scaffold, health route, and migration harness.
- `apps/web` contains the Vite + React web scaffold and Tailwind token setup.
- `apps/mcp` is a compileable placeholder for the future MCP server.
- `packages/shared` holds runtime schemas and types shared across packages.

The repository intentionally avoids future-milestone structure in M0:

- no product routes beyond `GET /healthz`
- no authentication modules
- no database tables beyond the migration harness itself
- no design-system component inventory yet

Root scripts orchestrate package-level build, typecheck, test, and development commands through pnpm workspaces rather than a separate task runner.
