# =============================================================================
# Production image for the API server
#
# Build:  docker build -t app-api .
# Run:    docker run --env-file .env -e PORT=3000 -p 3000:3000 app-api
# =============================================================================

# ---- Build stage ------------------------------------------------------------
FROM node:24-slim AS build

RUN corepack enable

WORKDIR /repo

# Install dependencies first for better layer caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY artifacts/api-server/package.json artifacts/api-server/
COPY artifacts/mockup-sandbox/package.json artifacts/mockup-sandbox/
COPY lib/api-spec/package.json lib/api-spec/
COPY lib/api-zod/package.json lib/api-zod/
COPY lib/api-client-react/package.json lib/api-client-react/
COPY lib/db/package.json lib/db/
COPY scripts/package.json scripts/
RUN pnpm install --frozen-lockfile

# Copy sources and build the API server bundle
COPY tsconfig.base.json tsconfig.json ./
COPY lib/ lib/
COPY artifacts/api-server/ artifacts/api-server/
RUN pnpm --filter @workspace/api-server run build

# ---- Runtime stage ----------------------------------------------------------
FROM node:24-slim AS runtime

ENV NODE_ENV=production

# Run as the non-root user that ships with the official Node image
USER node
WORKDIR /app

COPY --from=build --chown=node:node /repo/artifacts/api-server/dist ./dist

# PORT is configurable at runtime; 3000 is only the default
ENV PORT=3000
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch(\`http://127.0.0.1:\${process.env.PORT}/api/healthz\`).then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "--enable-source-maps", "dist/index.mjs"]
