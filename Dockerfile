# =============================================================================
# Single-container production image: API server + AI IDE frontend
#
# Build:  docker build -t grok-ide .
# Run:    docker run --env-file .env -p 3000:3000 grok-ide
#
# The API server serves the pre-built frontend at / and its own routes at /api.
# Set SERVE_FRONTEND=true (included in the ENV block below) to enable this.
# =============================================================================

# ---- Build stage ------------------------------------------------------------
FROM node:24-slim AS build

RUN corepack enable

WORKDIR /repo

# Copy manifests first for better layer caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY artifacts/api-server/package.json  artifacts/api-server/
COPY artifacts/ai-ide/package.json      artifacts/ai-ide/
COPY artifacts/mockup-sandbox/package.json artifacts/mockup-sandbox/
COPY lib/api-spec/package.json          lib/api-spec/
COPY lib/api-zod/package.json           lib/api-zod/
COPY lib/api-client-react/package.json  lib/api-client-react/
COPY lib/db/package.json                lib/db/
COPY scripts/package.json               scripts/

RUN pnpm install --frozen-lockfile

# Copy all sources
COPY tsconfig.base.json tsconfig.json ./
COPY lib/         lib/
COPY artifacts/api-server/ artifacts/api-server/
COPY artifacts/ai-ide/     artifacts/ai-ide/

# Build shared libs (generates TypeScript declarations)
RUN pnpm -w run typecheck:libs

# Build the API server bundle
RUN pnpm --filter @workspace/api-server run build

# Build the AI IDE frontend (BASE_PATH=/ → served at root by the API server)
RUN BASE_PATH=/ NODE_ENV=production pnpm --filter @workspace/ai-ide run build

# ---- Runtime stage ----------------------------------------------------------
FROM node:24-slim AS runtime

ENV NODE_ENV=production
ENV SERVE_FRONTEND=true

# Run as the non-root user that ships with the official Node image
USER node
WORKDIR /app

# API server bundle
COPY --from=build --chown=node:node /repo/artifacts/api-server/dist ./dist

# AI IDE frontend — served by Express static middleware at /
COPY --from=build --chown=node:node /repo/artifacts/ai-ide/dist/public ./public

# PORT is configurable at runtime; 3000 is the default
ENV PORT=3000
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch(\`http://127.0.0.1:\${process.env.PORT}/api/healthz\`).then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "--enable-source-maps", "dist/index.mjs"]
