# Dockerfile for every service in this monorepo.
# Multi-stage build to keep the final image small. Uses pnpm (this is a
# pnpm workspace, not npm — see CLAUDE.md).

FROM node:20-alpine AS base
WORKDIR /app

# System deps required by Prisma
RUN apk add --no-cache openssl libc6-compat

# Enable pnpm via corepack (bundled with Node 20)
RUN corepack enable && corepack prepare pnpm@10 --activate

# ========================================
# Stage 1: install dependencies
# ========================================
FROM base AS deps

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY services/mcp-server/package.json ./services/mcp-server/
COPY services/orchestrator/package.json ./services/orchestrator/

RUN pnpm install --frozen-lockfile

# ========================================
# Stage 2: build
# ========================================
FROM base AS builder
COPY --from=deps /app ./
COPY . .

RUN pnpm run build:shared
RUN cd services/mcp-server && pnpm exec prisma generate
RUN pnpm run build:mcp-server
RUN pnpm run build:orchestrator

# ========================================
# Stage 3: MCP Server runtime
# ========================================
FROM base AS mcp-server
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/services/mcp-server/node_modules ./services/mcp-server/node_modules
COPY --from=builder /app/services/mcp-server/dist ./services/mcp-server/dist
COPY --from=builder /app/services/mcp-server/package.json ./services/mcp-server/
COPY --from=builder /app/services/mcp-server/prisma ./services/mcp-server/prisma

WORKDIR /app/services/mcp-server

EXPOSE 30020
CMD ["node", "dist/index.js"]

# ========================================
# Stage 4: Orchestrator runtime
# ========================================
FROM base AS orchestrator
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/services/orchestrator/node_modules ./services/orchestrator/node_modules
COPY --from=builder /app/services/orchestrator/dist ./services/orchestrator/dist
COPY --from=builder /app/services/orchestrator/package.json ./services/orchestrator/

WORKDIR /app/services/orchestrator

EXPOSE 30021
CMD ["node", "dist/index.js"]
