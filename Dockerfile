# syntax=docker/dockerfile:1

# ---- Base ----
FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ---- Dependencies ----
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ---- Development (hot reload via compose volume mounts) ----
FROM base AS development
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ---- Build ----
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production
# Next.js collects page/route data at build time and imports `@/lib/db`.
# Compose `env_file` is not available during `docker build`, so provide
# placeholders here. Runtime uses the real values from compose/env_file.
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build
ENV AUTH_SECRET=build-time-placeholder-not-used-at-runtime
ENV AUTH_URL=http://localhost:3000
RUN npm run build

# ---- Production ----
FROM base AS production
ENV NODE_ENV=production
# Clear build-time placeholders so a misconfigured deploy fails loudly
# instead of connecting to 127.0.0.1. Real values come from env_file.
ENV DATABASE_URL=
ENV AUTH_SECRET=
ENV AUTH_URL=
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
USER nextjs
EXPOSE 3000
CMD ["npm", "run", "start"]

# ---- Worker (node-cron → app cron route) ----
FROM base AS worker
COPY package.json package-lock.json ./
RUN npm ci
COPY worker ./worker
CMD ["node", "--experimental-strip-types", "worker/scheduler.ts"]
