# Dockerfile para todos los servicios del monorepo
# Multi-stage build para optimizar el tamaño de la imagen

FROM node:20-alpine AS base
WORKDIR /app

# Instalar dependencias necesarias para Prisma
RUN apk add --no-cache openssl libc6-compat

# ========================================
# Stage 1: Instalar dependencias
# ========================================
FROM base AS deps

# Copiar package.json de cada servicio/paquete
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY services/mcp-server/package*.json ./services/mcp-server/
COPY services/orchestrator/package*.json ./services/orchestrator/

# Instalar dependencias en el root
RUN npm ci

# Instalar dependencias en shared
WORKDIR /app/packages/shared
RUN npm ci

# Instalar dependencias en mcp-server
WORKDIR /app/services/mcp-server
RUN npm ci

# Instalar dependencias en orchestrator
WORKDIR /app/services/orchestrator
RUN npm ci

# Volver al directorio raíz
WORKDIR /app

# ========================================
# Stage 2: Build
# ========================================
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/services/mcp-server/node_modules ./services/mcp-server/node_modules
COPY --from=deps /app/services/orchestrator/node_modules ./services/orchestrator/node_modules

# Copiar código fuente
COPY . .

# Build shared package primero
RUN cd packages/shared && npm run build

# Generar cliente Prisma
RUN cd services/mcp-server && npx prisma generate

# Build todos los servicios
RUN npm run build:mcp-server
RUN npm run build:orchestrator

# ========================================
# Stage 3: MCP Server - Runtime
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

EXPOSE 3000
CMD ["npm", "start"]

# ========================================
# Stage 4: Orchestrator - Runtime
# ========================================
FROM base AS orchestrator
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/services/orchestrator/node_modules ./services/orchestrator/node_modules
COPY --from=builder /app/services/orchestrator/dist ./services/orchestrator/dist
COPY --from=builder /app/services/orchestrator/package.json ./services/orchestrator/

WORKDIR /app/services/orchestrator

EXPOSE 3001
CMD ["npm", "start"]

