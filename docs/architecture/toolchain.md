# Toolchain Choices

The M0 foundation uses the following baseline toolchain:

- Node.js 20.x
- pnpm 9 or newer
- TypeScript 5.7
- Fastify 5 for the API scaffold
- Vite 6 and React 18 for the web scaffold
- Tailwind CSS 3 with Harbor Night design tokens expressed as CSS variables
- Drizzle ORM with `postgres` for migration execution
- Vitest for unit and integration tests
- Playwright for browser smoke testing
- Docker Compose for local Postgres

Implementation notes:

- The repo documents a minimum pnpm version instead of an exact pin. CI currently installs pnpm 10 while the local support floor remains pnpm 9.
- `apps/mcp` is intentionally buildable but non-functional until the dedicated MCP milestone.
- The web app uses token-compatible styling only. shadcn-style component generation is deferred until the UI layer is actually needed.
