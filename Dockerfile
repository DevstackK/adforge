# syntax=docker/dockerfile:1.7
FROM node:22-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ffmpeg chromium ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG DATABASE_URL=postgresql://build:build@localhost:5432/build
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_YWRmb3JnZS1idWlsZC5jbGVyay5hY2NvdW50cy5kZXYk
ENV DATABASE_URL=$DATABASE_URL NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 OTEL_SERVICE_NAME=adforge-web
RUN groupadd --system --gid 1001 nodejs && useradd --system --uid 1001 --gid nodejs nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/src/generated ./src/generated
COPY --from=deps /app/node_modules/.bin/prisma ./node_modules/.bin/prisma
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]

FROM builder AS worker
ENV NODE_ENV=production REMOTION_BROWSER_EXECUTABLE=/usr/bin/chromium OTEL_SERVICE_NAME=adforge-worker
CMD ["npm", "run", "worker"]
