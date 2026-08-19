# Portable Monorepo

A production-ready TypeScript pnpm monorepo containing an Express 5 API server, a PostgreSQL + Drizzle ORM data layer, an OpenAPI-first API contract with generated clients, and a React component sandbox. It runs on any machine with Node.js — no Replit (or any other specific platform) required.

## Repository structure

```
artifacts/
  api-server/        Express 5 API server (esbuild production bundle)
  mockup-sandbox/    Vite + React + Tailwind component preview sandbox (dev tool)
lib/
  api-spec/          OpenAPI spec (source of truth) + Orval codegen config
  api-zod/           Generated Zod schemas from the OpenAPI spec
  api-client-react/  Generated React Query client from the OpenAPI spec
  db/                PostgreSQL connection + Drizzle ORM schema
scripts/             Utility scripts
deploy/              Example deployment configs (nginx)
.github/workflows/   CI pipeline (GitHub Actions)
```

## Requirements

- Node.js >= 24
- pnpm 10 (`corepack enable` installs the pinned version automatically)
- PostgreSQL 14+ (or Docker — see below); only needed when using database features

## Installation

```bash
git clone <repository-url>
cd <repository>
corepack enable
pnpm install
cp .env.example .env   # then edit values
```

## Environment variables

All configuration comes from environment variables (see `.env.example`):

| Variable                                              | Required      | Description                                                            |
| ----------------------------------------------------- | ------------- | ---------------------------------------------------------------------- |
| `PORT`                                                | Yes           | TCP port the API server listens on                                     |
| `NODE_ENV`                                            | No            | `development` (default) or `production`                                |
| `DATABASE_URL`                                        | In production | PostgreSQL connection string, e.g. `postgres://user:pass@host:5432/db` |
| `SESSION_SECRET`                                      | In production | Random secret for signing sessions/tokens (`openssl rand -base64 32`)  |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Docker only   | Credentials for the local Postgres container                           |

The API server validates its configuration at startup and exits with a descriptive error listing exactly which variables are missing or invalid.

Never commit `.env` — it is git-ignored.

## Development

Environment variables can be set inline (macOS/Linux) or per-session (Windows PowerShell):

```bash
# macOS / Linux — API server (builds and starts; listens on $PORT)
PORT=3000 pnpm --filter @workspace/api-server run dev

# macOS / Linux — component preview sandbox
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/mockup-sandbox run dev
```

```powershell
# Windows (PowerShell)
$env:PORT = "3000"; pnpm --filter @workspace/api-server run dev

$env:PORT = "5173"; $env:BASE_PATH = "/"; pnpm --filter @workspace/mockup-sandbox run dev
```

Tip: you can also put `PORT` (and other variables) in `.env` and load it with your preferred tool (e.g. `node --env-file=.env`).

Verify the API is up:

```bash
curl http://localhost:3000/api/healthz
# {"status":"ok"}
```

## Production

```bash
pnpm install --frozen-lockfile
pnpm --filter @workspace/api-server run build      # bundles to artifacts/api-server/dist

# macOS / Linux
NODE_ENV=production PORT=3000 DATABASE_URL=... SESSION_SECRET=... \
  pnpm --filter @workspace/api-server run start

# Windows (PowerShell)
# $env:NODE_ENV="production"; $env:PORT="3000"; $env:DATABASE_URL="..."; $env:SESSION_SECRET="..."
# pnpm --filter @workspace/api-server run start
```

The server binds to all interfaces, so it works inside containers and on remote hosts.

## Docker

Build and run just the API server:

```bash
docker build -t app-api .
docker run --env-file .env -p 3000:3000 app-api
```

Or run the full stack (PostgreSQL + API) with Docker Compose:

```bash
cp .env.example .env   # edit values first
docker compose up --build
```

The compose file provisions Postgres with a persistent volume and wires `DATABASE_URL` automatically. `POSTGRES_PASSWORD` has no default — compose fails fast if it is missing from `.env`. Postgres is not exposed to the host by default; uncomment the `ports` block in `docker-compose.yml` if you need local access. The image runs as a non-root user and includes a health check on `/api/healthz`.

## Database

The data layer lives in `lib/db` (Drizzle ORM, PostgreSQL). The schema is currently empty — add tables in `lib/db/src/schema/`.

```bash
# Apply all pending migrations to the database pointed at by DATABASE_URL
DATABASE_URL=postgres://app:app@localhost:5432/app pnpm --filter @workspace/db run migrate

# After editing the schema, generate a new migration file
pnpm --filter @workspace/db run generate
```

For local development, `docker compose up postgres` gives you a ready database at `postgres://app:<your-password>@localhost:5432/app` (Postgres is exposed on `127.0.0.1:5432`).

## API contract & codegen

`lib/api-spec/openapi.yaml` is the single source of truth for the API. After editing it, regenerate the Zod schemas and React Query client:

```bash
pnpm --filter @workspace/api-spec run codegen
```

## Testing, linting, building

```bash
pnpm test              # run all workspace tests (vitest)
pnpm run typecheck     # full TypeScript check across all packages
pnpm run lint          # prettier check
pnpm run format        # prettier write
pnpm run build         # typecheck + build all packages
```

## Deployment (VPS / cloud VM)

1. Install Docker (or Node 24 + pnpm) on the server.
2. Clone the repository and create `.env` from `.env.example` with production values.
3. `docker compose up --build -d` (or build and run the API bundle directly).
4. Optionally put NGINX in front for TLS — see `deploy/nginx.conf.example`.

## CI

`.github/workflows/ci.yml` runs on every push to `main` and every pull request: install → typecheck → test → build. No external services or secrets are required for CI to pass.

## Troubleshooting

- **"Invalid environment configuration" at startup** — the error lists exactly which variables are missing; compare with `.env.example`.
- **`Use pnpm instead` during install** — this repo enforces pnpm; run `corepack enable && pnpm install`, not npm/yarn.
- **Database connection errors** — confirm Postgres is running and `DATABASE_URL` is reachable from where the server runs (inside Docker Compose the host is `postgres`, not `localhost`).
- **Port already in use** — change `PORT` in `.env`.
- **pnpm refuses to install a brand-new package version** — the workspace enforces a 1-day minimum release age as a supply-chain defense (`pnpm-workspace.yaml`).
