# Standalone Dockerfile for mcp-server only.
# NOTE: this service depends on "@mcp-server-sma/shared": "workspace:*" — a
# build using only this folder's context can't resolve that without the rest
# of the pnpm workspace present. Prefer the root Dockerfile + docker-compose
# (which builds from the monorepo root) unless this gets reworked to build
# from the repo root with this file passed via `-f`.

FROM node:20-alpine AS base
WORKDIR /app

RUN apk add --no-cache openssl libc6-compat
RUN corepack enable && corepack prepare pnpm@10 --activate

# ========================================
# Stage 1: install dependencies
# ========================================
FROM base AS deps

COPY package.json ./

RUN pnpm install --prod

# ========================================
# Stage 2: build
# ========================================
FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY . .
COPY prisma ./prisma

RUN pnpm exec prisma generate
RUN pnpm run build

# ========================================
# Stage 3: production
# ========================================
FROM base AS runner
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 mcpserver

COPY --from=builder --chown=mcpserver:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=mcpserver:nodejs /app/dist ./dist
COPY --from=builder --chown=mcpserver:nodejs /app/package.json ./package.json
COPY --from=builder --chown=mcpserver:nodejs /app/prisma ./prisma

USER mcpserver

EXPOSE 30020

HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:30020/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "dist/index.js"]
