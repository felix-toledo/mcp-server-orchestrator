# 🐳 Guía Rápida de Docker

Esta guía te muestra cómo usar los diferentes Dockerfiles del proyecto.

## 📦 Archivos Docker Disponibles

### 1. **Dockerfile** (raíz del proyecto)

Dockerfile multi-stage que construye todos los servicios en una sola imagen:

- ✅ Optimizado para monorepo
- ✅ Compila el paquete shared
- ✅ Genera targets separados para cada servicio
- ✅ Ideal para docker-compose

**Uso:**

```bash
# Construir imagen del mcp-server
docker build --target mcp-server -t mcp-server:latest .

# Construir imagen del orchestrator
docker build --target orchestrator -t orchestrator:latest .
```

### 2. **services/mcp-server/Dockerfile**

Dockerfile individual para el servicio MCP Server:

- ✅ Independiente del monorepo
- ✅ Incluye soporte para Prisma
- ✅ Usuario no-root para seguridad
- ✅ Health checks incluidos

**Uso:**

```bash
cd services/mcp-server
docker build -t mcp-server:latest .
docker run -p 3000:3000 -e DATABASE_URL="..." mcp-server:latest
```

### 3. **services/orchestrator/Dockerfile**

Dockerfile individual para el servicio Orchestrator:

- ✅ Independiente del monorepo
- ✅ Imagen ligera
- ✅ Usuario no-root para seguridad
- ✅ Health checks incluidos

**Uso:**

```bash
cd services/orchestrator
docker build -t orchestrator:latest .
docker run -p 3001:3001 -e MCP_SERVER_URL="..." orchestrator:latest
```

## 🚀 Inicio Rápido

### Con Docker Compose (Recomendado)

```bash
# 1. Configurar variables de entorno
cp env.template .env
nano .env  # Editar con tus valores (especialmente DATABASE_URL para la BD externa)

# 2. Levantar todos los servicios
docker-compose up -d

# 3. Ver logs
docker-compose logs -f

# 4. Ejecutar migraciones (primera vez, si es necesario)
docker-compose exec mcp-server npx prisma migrate deploy
```

> **Nota:** Este proyecto usa una base de datos PostgreSQL externa que ya está deployada. Asegúrate de configurar correctamente la variable `DATABASE_URL` en tu archivo `.env` con la URL de conexión a tu base de datos.

### Sin Docker Compose

```bash
# 1. Construir imágenes
docker build --target mcp-server -t mcp-server .
docker build --target orchestrator -t orchestrator .

# 2. Crear red
docker network create mcp-network

# 3. Iniciar MCP Server (asegúrate de tener la URL de tu BD externa)
docker run -d --name mcp-server --network mcp-network \
  -p 3000:3000 \
  -e DATABASE_URL="postgresql://usuario:password@host-externo:puerto/nombre_bd" \
  mcp-server

# 4. Iniciar Orchestrator
docker run -d --name orchestrator --network mcp-network \
  -p 3001:3001 \
  -e MCP_SERVER_URL="http://mcp-server:3000" \
  -e OPENAI_API_KEY="tu-key" \
  orchestrator
```

> **Importante:** La base de datos PostgreSQL está deployada externamente. Asegúrate de que tu contenedor tenga acceso de red a la base de datos externa.

## 🔑 Variables de Entorno Principales

### MCP Server

- `DATABASE_URL`: URL de conexión a PostgreSQL externa (formato: `postgresql://usuario:password@host:puerto/nombre_bd`)
- `PORT`: Puerto del servidor (default: 3000)
- `NODE_ENV`: Ambiente (production/development)

### Orchestrator

- `MCP_SERVER_URL`: URL del MCP Server
- `OPENAI_API_KEY`: API Key de OpenAI
- `PORT`: Puerto del servidor (default: 3001)
- `NODE_ENV`: Ambiente (production/development)

## 📖 Documentación Completa

Para más detalles sobre despliegue, seguridad, y troubleshooting, consulta [DEPLOYMENT.md](./DEPLOYMENT.md)

## 🛠️ Comandos Útiles

```bash
# Ver contenedores activos
docker ps

# Ver logs de un contenedor
docker logs -f mcp-server

# Entrar a un contenedor
docker exec -it mcp-server sh

# Detener todos los contenedores
docker-compose down

# Limpiar todo (¡cuidado!)
docker-compose down -v  # Borra también los volúmenes
```

## 🆘 Problemas Comunes

**Puerto en uso:**

```bash
# Cambiar el puerto en docker-compose.yml o usar -p diferente
docker run -p 3002:3000 ...
```

**Error de base de datos:**

```bash
# Verificar que PostgreSQL esté corriendo
docker ps | grep postgres
# Ver logs
docker logs postgres
```

**Rebuild completo:**

```bash
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```
