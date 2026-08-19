# GROK.IDE

An AI-powered browser IDE that pairs a **Monaco code editor** with a **streaming Grok (xAI) chat panel**. Ask Grok to write nginx configs, systemd units, deploy scripts, or any code — then push the result directly to GitHub from the editor.

Built on a portable pnpm monorepo. Runs locally, in Docker, on any Linux VPS, or in CI. No Replit runtime dependency.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 7, Tailwind CSS v4, Monaco Editor |
| Backend | Express 5, TypeScript, esbuild |
| AI | xAI Grok (streaming SSE) |
| Database | PostgreSQL 17 + Drizzle ORM |
| Monorepo | pnpm workspaces |
| Container | Docker (multi-stage), Docker Compose |
| CI | GitHub Actions |

---

## Requirements

- **Node.js** ≥ 20
- **pnpm** ≥ 9 (enabled via `corepack enable`)
- **PostgreSQL** 15+ (or Docker for local dev)
- **xAI API key** — [console.x.ai](https://console.x.ai) (for AI chat)
- **GitHub PAT** — [github.com/settings/tokens](https://github.com/settings/tokens) (for GitHub push feature)

---

## Installation

```bash
git clone https://github.com/ssdogturdss/portable-monorepo.git
cd portable-monorepo
corepack enable
pnpm install
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

| Variable | Required | Description |
|---|---|---|
| `PORT` | Yes | TCP port for the API server (default: `3000`) |
| `NODE_ENV` | No | `development` or `production` |
| `DATABASE_URL` | Prod only | `postgres://user:pass@host:5432/db` |
| `SESSION_SECRET` | Prod only | Random string ≥ 32 chars — `openssl rand -base64 32` |
| `XAI_API_KEY` | Outside Replit | xAI key for Grok AI features |
| `GITHUB_TOKEN` | Outside Replit | GitHub PAT with repo contents write access |
| `CORS_ORIGIN` | No | Comma-separated allowed origins (e.g. `https://app.example.com`) |
| `SERVE_FRONTEND` | No | `true` to serve the AI IDE frontend from the API server |
| `POSTGRES_PASSWORD` | Docker only | Password for the Compose Postgres container |

> **Inside Replit:** `XAI_API_KEY` and `GITHUB_TOKEN` are not needed — the Replit connector integrations handle authentication automatically.

---

## Development

**Start the database** (Docker required):
```bash
docker compose up postgres -d
```

**Push the schema** to the database:
```bash
pnpm --filter @workspace/db run push
```

**Start the API server** (port 3000 by default):
```bash
pnpm --filter @workspace/api-server run dev
```

**Start the AI IDE frontend** (port 5173 by default):
```bash
pnpm --filter @workspace/ai-ide run dev
```

The frontend proxies API calls to the same origin. In development, point your browser to the Vite dev server URL and make sure the API server is also running.

---

## Production

**Build everything:**
```bash
pnpm -w run typecheck:libs
pnpm --filter @workspace/api-server run build
BASE_PATH=/ NODE_ENV=production pnpm --filter @workspace/ai-ide run build
```

**Start the server** (serves both API and frontend):
```bash
PORT=3000 SERVE_FRONTEND=true node --enable-source-maps artifacts/api-server/dist/index.mjs
```

---

## Docker

**Build and run** (single container, API + frontend):
```bash
docker build -t grok-ide .
docker run --env-file .env -p 3000:3000 grok-ide
```

**With Docker Compose** (includes Postgres):
```bash
# Set POSTGRES_PASSWORD in .env first
docker compose up --build -d
```

**Run database migrations** against the Compose database:
```bash
DATABASE_URL=postgres://app:<password>@localhost:5432/app \
  pnpm --filter @workspace/db run push
```

**Stop and remove containers:**
```bash
docker compose down
# To also delete the database volume:
docker compose down -v
```

---

## Database

The project uses **PostgreSQL** with **Drizzle ORM** for schema management.

**Schema** is defined in `lib/db/src/schema/`:
- `sessions` — AI chat sessions (title, model, timestamps)
- `messages` — individual chat messages (role, content, session reference)

### Development workflow

`drizzle-kit push` syncs the schema directly to the database without writing migration files — convenient for local iteration:

```bash
pnpm --filter @workspace/db run push
```

> ⚠️ **Never run `push` or `push-force` against a production database.** These commands can silently drop columns or tables that no longer appear in the schema. Use the migration workflow below for any environment that holds real data.

### Safe migration path (staging & production)

All schema changes destined for production **must** go through tracked migration files:

1. **Edit the schema** in `lib/db/src/schema/`.

2. **Generate a migration file:**
   ```bash
   pnpm --filter @workspace/db run generate
   ```
   Drizzle writes a new `.sql` file under `lib/db/drizzle/`.

3. **Review the generated SQL before committing.**
   Open the file and read every statement. Pay particular attention to:
   - `DROP TABLE` — permanently removes a table and all its rows.
   - `ALTER TABLE … DROP COLUMN` — permanently removes a column and all its values.

   If you see either statement and it is unintentional, **stop** — adjust the schema and regenerate.

4. **Commit the migration file** alongside the schema change.
   CI (`schema-check` job) will reject any migration that contains `DROP TABLE` or `DROP COLUMN` unless `ALLOW_DESTRUCTIVE_MIGRATIONS=1` is set on the job.

5. **Apply the migration in production:**
   ```bash
   DATABASE_URL=postgres://... pnpm --filter @workspace/db run migrate
   ```
   `drizzle-kit migrate` replays only the committed `.sql` files that have not yet been applied, in order. It never generates or drops anything on its own.

6. **Verify** with a quick health check or integration test before routing live traffic.

### Handling intentional destructive changes

If you genuinely need to drop a column or table from a live database:

1. **Deprecate first** — stop writing to the column/table in a prior release, then verify in production logs that nothing still reads it.
2. **Back up** — snapshot the data (e.g. `CREATE TABLE … AS SELECT …`) before dropping.
3. **Generate and review** the migration as usual.
4. **Bypass the CI guard** by setting `ALLOW_DESTRUCTIVE_MIGRATIONS=1` on the `schema-check` job for that PR, with a comment in the migration SQL explaining why the drop is safe.

**Connect with psql** (when using Docker Compose):
```bash
psql postgres://app:<password>@localhost:5432/app
```

---

## Testing

Run all tests across the monorepo:
```bash
pnpm test
```

Run tests for a specific package:
```bash
pnpm --filter @workspace/api-server run test
```

The test suite covers:
- API server health endpoint
- 404 handling
- Environment variable validation (8 cases)

---

## Linting & Type Checking

```bash
# Lint
pnpm lint

# Type check shared libraries
pnpm -w run typecheck:libs

# Type check the API server
pnpm --filter @workspace/api-server run typecheck

# Type check the AI IDE frontend
pnpm --filter @workspace/ai-ide run typecheck
```

---

## AI IDE Features

### Chat sessions
- Click **New Session** to start a conversation with Grok
- All sessions and messages are persisted in PostgreSQL
- Recent sessions appear in the sidebar

### Monaco editor
- Full-featured code editor with syntax highlighting
- Language is set automatically when Grok generates code
- Templates panel provides 7 ready-made deployment configs

### Streaming responses
- Grok responses stream token-by-token via Server-Sent Events
- Toggle **Web Search** to let Grok browse current documentation

### Push to GitHub
- Click **Push to GitHub** in the editor toolbar
- Select a repository, branch, file path, and commit message
- The current editor content is committed directly to GitHub

### Templates
Browse `/templates` for ready-to-use deployment configs:
- Nginx reverse proxy (Node.js, static files)
- systemd unit files (app service, Postgres backup timer)
- Docker Compose stack (app + Postgres + Nginx)
- Ubuntu 20.04 full provisioning script
- GitHub Actions deploy-on-push workflow

---

## Deployment

### Ubuntu 20.04 / 22.04 VPS

```bash
# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
corepack enable

# Install PostgreSQL
apt-get install -y postgresql postgresql-contrib
sudo -u postgres createuser --superuser app
sudo -u postgres createdb app

# Clone and install
git clone https://github.com/ssdogturdss/portable-monorepo.git /var/www/grok-ide
cd /var/www/grok-ide
pnpm install --frozen-lockfile

# Configure environment
cp .env.example .env
nano .env  # fill in DATABASE_URL, SESSION_SECRET, XAI_API_KEY, GITHUB_TOKEN

# Push schema
pnpm --filter @workspace/db run push

# Build
pnpm -w run typecheck:libs
pnpm --filter @workspace/api-server run build
BASE_PATH=/ NODE_ENV=production pnpm --filter @workspace/ai-ide run build

# Run with systemd (see deploy/app.service in the Templates panel)
# Or use Docker Compose (see above)
```

### Nginx reverse proxy

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        # Required for SSE (streaming chat)
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 300s;
    }
}
```

Add SSL with Certbot: `certbot --nginx -d your-domain.com`

---

## Repository Structure

```
.
├── artifacts/
│   ├── api-server/          Express 5 API — AI chat, GitHub proxy, templates
│   └── ai-ide/              React + Vite AI IDE frontend
├── lib/
│   ├── api-spec/            OpenAPI 3.1 spec
│   ├── api-zod/             Zod schemas (generated from OpenAPI)
│   ├── api-client-react/    React Query hooks (generated from OpenAPI)
│   └── db/                  Drizzle ORM schema + migrations
├── scripts/                 Workspace utility scripts
├── .github/workflows/ci.yml GitHub Actions CI
├── Dockerfile               Multi-stage production build
├── docker-compose.yml       Local dev stack (app + Postgres)
└── .env.example             All environment variables documented
```

---

## CI

GitHub Actions runs on every push and pull request to `main`:

1. Install dependencies (`pnpm install --frozen-lockfile`)
2. Lint
3. Type check
4. Run tests
5. Build all packages

See `.github/workflows/ci.yml`.

---

## Troubleshooting

**`PORT environment variable is required`**
→ Copy `.env.example` to `.env` and set `PORT=3000`.

**`DATABASE_URL is missing`** (production)
→ Set `DATABASE_URL` to a valid `postgres://` connection string.

**`XAI_API_KEY is required when running outside Replit`**
→ Set `XAI_API_KEY` in `.env`. Get a key at [console.x.ai](https://console.x.ai).

**`GITHUB_TOKEN is required when running outside Replit`**
→ Set `GITHUB_TOKEN` in `.env`. Create a PAT at [github.com/settings/tokens](https://github.com/settings/tokens) with **Contents: Read and Write** on your target repos.

**`EADDRINUSE: address already in use`**
→ Another process is using the port. Change `PORT` in `.env` or kill the existing process: `lsof -ti:3000 | xargs kill`

**Frontend shows blank page after Docker build**
→ Make sure `SERVE_FRONTEND=true` is set (it is by default in the Dockerfile). Verify the build output at `artifacts/ai-ide/dist/public/index.html` exists inside the container: `docker run --rm grok-ide ls /app/public`

**SSE streaming stops after ~30 seconds**
→ Add `proxy_read_timeout 300s;` and `proxy_buffering off;` to your Nginx config (see the Nginx example above).
