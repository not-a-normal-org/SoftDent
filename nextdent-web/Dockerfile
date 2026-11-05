# syntax=docker/dockerfile:1
# Multi-stage build for the NextDent web app (Next.js 16 standalone + Prisma).

FROM node:20-bookworm-slim AS base
# openssl is required by the Prisma query engine at build & runtime; tzdata so that
# TZ resolves against the system zone database as well as ICU's copy
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates tzdata \
    && rm -rf /var/lib/apt/lists/*
# The clinic is in Barishal (UTC+6, no DST) and the app reports by clinic calendar day
# and month. Containers default to UTC, so set the zone here rather than relying on the
# host or the platform (Cloud Run sets it too, but the image must not depend on that).
ENV TZ=Asia/Dhaka

# ---- install dependencies ----
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- build (also used as the "migrate" image — it has prisma + schema) ----
FROM base AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# ---- production runner (minimal standalone output) ----
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN groupadd --gid 1001 nodejs && useradd --uid 1001 --gid nodejs --create-home nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
# server.js is emitted by Next's standalone output
CMD ["node", "server.js"]
