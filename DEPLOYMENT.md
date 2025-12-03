# Guía de Despliegue con Docker

Esta guía te ayudará a desplegar la aplicación MCP Server SMA usando Docker en tu VPS.

## 📋 Prerrequisitos

- Docker Engine 20.10 o superior
- Docker Compose V2 o superior
- Al menos 2GB de RAM disponible
- Puertos 3000, 3001 y 5432 disponibles (o los que configures)

## 🚀 Opciones de Despliegue

### Opción 1: Desplegar todos los servicios con Docker Compose (Recomendado)

Esta es la forma más sencilla para desplegar toda la aplicación:

```bash
# 1. Clonar el repositorio (si aún no lo has hecho)
git clone <tu-repositorio>
cd mcp-server-sma

# 2. Crear archivo de variables de entorno
cp .env.example .env

# 3. Editar .env con tus configuraciones
nano .env

# 4. Construir y levantar todos los servicios
docker-compose up -d --build

# 5. Ver los logs
docker-compose logs -f

# 6. Ejecutar migraciones de Prisma (primera vez)
docker-compose exec mcp-server npx prisma migrate deploy
```

### Opción 2: Desplegar servicios individuales

#### MCP Server Individual

```bash
# Construir la imagen
docker build -t mcp-server:latest \
  --target mcp-server \
  -f Dockerfile .

# Ejecutar el contenedor
docker run -d \
  --name mcp-server \
  -p 3000:3000 \
  -e DATABASE_URL="postgresql://user:pass@host:5432/db" \
  -e PORT=3000 \
  --restart unless-stopped \
  mcp-server:latest
```

#### Orchestrator Individual

```bash
# Construir la imagen
docker build -t orchestrator:latest \
  --target orchestrator \
  -f Dockerfile .

# Ejecutar el contenedor
docker run -d \
  --name orchestrator \
  -p 3001:3001 \
  -e MCP_SERVER_URL="http://mcp-server:3000" \
  -e OPENAI_API_KEY="tu-api-key" \
  -e PORT=3001 \
  --restart unless-stopped \
  orchestrator:latest
```

### Opción 3: Dockerfiles individuales por servicio

Si prefieres construir cada servicio por separado:

#### MCP Server

```bash
cd services/mcp-server
docker build -t mcp-server:latest .
docker run -d -p 3000:3000 --name mcp-server mcp-server:latest
```

#### Orchestrator

```bash
cd services/orchestrator
docker build -t orchestrator:latest .
docker run -d -p 3001:3001 --name orchestrator orchestrator:latest
```

## 🔧 Comandos Útiles

### Docker Compose

```bash
# Iniciar servicios
docker-compose up -d

# Detener servicios
docker-compose down

# Ver logs de todos los servicios
docker-compose logs -f

# Ver logs de un servicio específico
docker-compose logs -f mcp-server

# Reconstruir imágenes
docker-compose build --no-cache

# Reiniciar un servicio
docker-compose restart mcp-server

# Ver estado de los servicios
docker-compose ps

# Ejecutar comandos en un contenedor
docker-compose exec mcp-server sh
```

### Gestión de base de datos

```bash
# Ejecutar migraciones
docker-compose exec mcp-server npx prisma migrate deploy

# Generar cliente Prisma
docker-compose exec mcp-server npx prisma generate

# Abrir Prisma Studio
docker-compose exec mcp-server npx prisma studio
```

### Mantenimiento

```bash
# Ver uso de recursos
docker stats

# Limpiar contenedores detenidos
docker container prune

# Limpiar imágenes sin usar
docker image prune -a

# Backup de la base de datos
docker-compose exec postgres pg_dump -U mcpuser mcp_sma > backup.sql

# Restaurar base de datos
docker-compose exec -T postgres psql -U mcpuser mcp_sma < backup.sql
```

## 🔐 Seguridad

### Variables de Entorno

⚠️ **IMPORTANTE**: Nunca subas el archivo `.env` a Git. Contiene información sensible.

Asegúrate de cambiar:

- `POSTGRES_PASSWORD`: Usa una contraseña segura
- `OPENAI_API_KEY`: Tu clave API real
- Cualquier otra clave o secreto

### Firewall

Configura el firewall de tu VPS para permitir solo los puertos necesarios:

```bash
# UFW (Ubuntu)
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

### Reverse Proxy (Nginx)

Para producción, se recomienda usar Nginx como reverse proxy:

```nginx
server {
    listen 80;
    server_name tu-dominio.com;

    location /mcp {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /orchestrator {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 📊 Monitoreo

### Health Checks

Los servicios incluyen health checks configurados:

```bash
# Verificar estado del MCP Server
curl http://localhost:3000/health

# Verificar estado del Orchestrator
curl http://localhost:3001/health
```

### Logs

```bash
# Seguir logs en tiempo real
docker-compose logs -f --tail=100

# Buscar errores
docker-compose logs | grep ERROR

# Exportar logs
docker-compose logs > logs.txt
```

## 🔄 Actualizaciones

Para actualizar la aplicación:

```bash
# 1. Hacer pull de los cambios
git pull origin main

# 2. Reconstruir las imágenes
docker-compose build --no-cache

# 3. Reiniciar los servicios
docker-compose up -d

# 4. Ejecutar migraciones si es necesario
docker-compose exec mcp-server npx prisma migrate deploy
```

## 🐛 Troubleshooting

### El servicio no inicia

```bash
# Ver logs detallados
docker-compose logs mcp-server

# Verificar variables de entorno
docker-compose config

# Reiniciar servicios
docker-compose restart
```

### Error de conexión a la base de datos

```bash
# Verificar que PostgreSQL esté funcionando
docker-compose ps postgres

# Ver logs de PostgreSQL
docker-compose logs postgres

# Verificar la conectividad
docker-compose exec mcp-server ping postgres
```

### Puerto ya en uso

```bash
# Ver qué está usando el puerto
sudo lsof -i :3000

# Cambiar el puerto en .env
nano .env
# Modifica MCP_SERVER_PORT=3002
```

## 📝 Notas Adicionales

- Los contenedores se reinician automáticamente con `restart: unless-stopped`
- Los datos de PostgreSQL persisten en un volumen Docker
- Las imágenes usan multi-stage builds para optimizar el tamaño
- Se ejecutan con usuarios no-root para mayor seguridad

## 🆘 Soporte

Si encuentras problemas, revisa:

1. Los logs: `docker-compose logs -f`
2. El estado de los contenedores: `docker-compose ps`
3. Las variables de entorno: verifica tu archivo `.env`
4. La conectividad de red entre servicios
