# Dockerfile para Orchestrator (servicio individual)
# Multi-stage build para optimizar el tamaño de la imagen

FROM node:20-alpine AS base
WORKDIR /app

# Instalar dependencias del sistema
RUN apk add --no-cache libc6-compat

# ========================================
# Stage 1: Instalar dependencias
# ========================================
FROM base AS deps

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm ci --only=production && \
    npm cache clean --force

# ========================================
# Stage 2: Build
# ========================================
FROM base AS builder

# Copiar dependencias instaladas
COPY --from=deps /app/node_modules ./node_modules

# Copiar código fuente
COPY . .

# Build del proyecto
RUN npm run build

# ========================================
# Stage 3: Production
# ========================================
FROM base AS runner
ENV NODE_ENV=production

# Crear usuario no-root para seguridad
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 orchestrator

# Copiar archivos necesarios
COPY --from=builder --chown=orchestrator:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=orchestrator:nodejs /app/dist ./dist
COPY --from=builder --chown=orchestrator:nodejs /app/package.json ./package.json

USER orchestrator

EXPOSE 3011

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3011/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["npm", "start"]

