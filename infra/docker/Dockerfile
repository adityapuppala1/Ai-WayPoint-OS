# syntax=docker/dockerfile:1.7
# Waypoint images. Build from the repository root:
#   docker build -f infra/docker/Dockerfile --target web -t waypoint-web .
#   docker build -f infra/docker/Dockerfile --target worker -t waypoint-worker .
#
# Both run as the unprivileged `node` user and need nothing downloaded when they start.
# What never reaches an image (secrets, local data) is listed in /.dockerignore.

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true NEXT_TELEMETRY_DISABLED=1
RUN corepack enable pnpm
WORKDIR /app

# Dependencies from the lockfile only (cached until the lockfile changes).
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm fetch

FROM deps AS build
COPY . .
# Packages come from the store filled above. Not fully offline: pnpm 11 checks each package's
# publication date against the supply-chain policy in pnpm-workspace.yaml, and needs the
# registry's metadata for that.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prefer-offline --frozen-lockfile
RUN pnpm --filter @waypoint/web build

# ── Web app + API (Next.js standalone output) ────────────────────────────────────────────
FROM node:22-bookworm-slim AS web
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1 \
    WAYPOINT_MIGRATIONS_DIR=/app/packages/db/drizzle WAYPOINT_INPROCESS_WORKER=false
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /app/apps/web/public ./apps/web/public
COPY --from=build --chown=node:node /app/packages/db/drizzle ./packages/db/drizzle
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/web/server.js"]

# ── Background worker and one-off tasks (migrations, seeding) ────────────────────────────
# Only the packages the worker and the database tools need: no web app, no phone app.
FROM deps AS worker-build
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --prefer-offline --frozen-lockfile \
      --filter "@waypoint/worker..." --filter "@waypoint/db..." \
    && rm -rf apps/web apps/mobile apps/api

# Runs TypeScript directly (tsx); no package manager is needed once the image is built.
#   worker:      node --import tsx src/index.ts            (the default, in /app/apps/worker)
#   migrations:  cd /app/packages/db && node --import tsx src/cli.ts migrate
#   seed:        cd /app/packages/db && node --import tsx src/cli.ts seed
FROM node:22-bookworm-slim AS worker
ENV NODE_ENV=production WAYPOINT_MIGRATIONS_DIR=/app/packages/db/drizzle
WORKDIR /app
COPY --from=worker-build --chown=node:node /app ./
USER node
WORKDIR /app/apps/worker
CMD ["node", "--import", "tsx", "src/index.ts"]
