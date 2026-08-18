# Portable Monorepo

A portable, production-ready TypeScript monorepo (Express API + Postgres/Drizzle + OpenAPI codegen) that runs anywhere — see README.md for the canonical run/deploy docs.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- Env var validation: `artifacts/api-server/src/lib/env.ts` (documented in `.env.example`)
- Tests: `artifacts/api-server/src/app.test.ts` (vitest, `pnpm test`)
- Deployment: `Dockerfile`, `docker-compose.yml`, `deploy/nginx.conf.example`, `.github/workflows/ci.yml`
- Docs for external users: `README.md`

## Architecture decisions

- All Replit-specific packages removed (connectors-sdk, vite plugins) so the repo runs anywhere; do not re-add them without user approval
- esbuild/rollup/etc. platform-exclusion overrides removed from `pnpm-workspace.yaml` so installs work on macOS/Windows, not just Linux
- `DATABASE_URL` and `SESSION_SECRET` are required only when `NODE_ENV=production`; `PORT` is always required

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
