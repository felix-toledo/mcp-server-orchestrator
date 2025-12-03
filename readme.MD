# Proyecto: Servidor MCP para SMA - Monorepo

## 1. Visión General

Este repositorio contiene un **monorepo** con múltiples servicios para el Protocolo de Contexto de Modelo (MCP). La arquitectura está diseñada para ser escalable y mantenible, utilizando TypeScript para un desarrollo tipado y seguro, y Prisma como ORM para la interacción con la base de datos PostgreSQL.

### Estructura del Monorepo

```
mcp-server-sma/
├── packages/
│   └── shared/                 # Utilidades y tipos compartidos
├── services/
│   ├── mcp-server/            # Servidor MCP principal (Puerto 3000)
│   └── orchestrator/          # Orquestador de servicios (Puerto 3001)
└── package.json              # Configuración del workspace
```

## 2. Servicios

### 📦 **packages/shared**

- **Propósito**: Utilidades, tipos y funciones comunes compartidas entre servicios
- **Puerto**: N/A (paquete de librería)
- **Tecnologías**: TypeScript, Zod

### 🚀 **services/mcp-server**

- **Propósito**: Servidor MCP principal que expone herramientas para agentes de chat
- **Puerto**: 3000
- **Tecnologías**: TypeScript, MCP SDK, Prisma, PostgreSQL
- **Funcionalidades**:
  - Herramientas MCP para WhatsApp, Telegram, Instagram, TikTok, Facebook
  - Gestión de base de datos
  - Análisis de contenido y comentarios

### 🎯 **services/orchestrator**

- **Propósito**: Orquestador que coordina y gestiona los diferentes servicios
- **Puerto**: 3001
- **Tecnologías**: TypeScript, Express, CORS
- **Funcionalidades**:
  - API REST para gestión de servicios
  - Health checks
  - Coordinación entre servicios

## 3. Puesta en Marcha Inicial

### Prerrequisitos

- **Node.js**: Versión `v18` o superior
- **npm**: Administrador de paquetes de Node.js
- **PostgreSQL**: Instancia de base de datos PostgreSQL corriendo localmente

### Pasos de Configuración

1. **Clonar el Repositorio**:

   ```bash
   git clone <URL-del-repositorio>
   cd mcp-server-sma
   ```

2. **Instalar Dependencias del Workspace**:

   ```bash
   npm install
   ```

3. **Construir el Paquete Shared** (requerido por otros servicios):

   ```bash
   npm run build:shared
   ```

4. **Configurar Variables de Entorno**:

   ```bash
   # Copiar archivo de ejemplo
   cp .env.example .env

   # Configurar DATABASE_URL en .env
   DATABASE_URL="postgresql://usuario:password@localhost:5432/mcp_sma"
   ```

5. **Configurar Base de Datos**:

   ```bash
   # Generar cliente Prisma
   npm run prisma:generate

   ```

## 4. Scripts y Comandos

### 🏗️ **Build y Compilación**

```bash
# Construir todos los servicios
npm run build

# Construir servicios individuales
npm run build:shared      # Paquete compartido
npm run build:mcp-server  # Servidor MCP
npm run build:orchestrator # Orquestador
```

### 🚀 **Desarrollo**

```bash
# Desarrollo de servicios individuales
npm run dev:mcp-server    # Servidor MCP en puerto 3000
npm run dev:orchestrator  # Orquestador en puerto 3001

# Desarrollo del paquete shared (con watch)
npm run dev:shared
```

### 🎯 **Producción**

```bash
# Ejecutar servicios construidos
npm run start:mcp-server    # Servidor MCP
npm run start:orchestrator # Orquestador
```

### 🗄️ **Base de Datos**

```bash
# Generar cliente Prisma
npm run prisma:generate

# Abrir Prisma Studio
npm run prisma:studio
```

### 🧹 **Limpieza y Mantenimiento**

```bash
# Linting y formato
npm run lint        # Verificar código
npm run lint:fix    # Corregir automáticamente
npm run format      # Formatear código

# Limpiar todo
npm run clean       # Limpiar builds y node_modules
```

## 5. Flujo de Desarrollo

### Desarrollo Local

1. **Iniciar servicios en terminales separadas**:

   ```bash
   # Terminal 1: MCP Server
   npm run dev:mcp-server

   # Terminal 2: Orchestrator
   npm run dev:orchestrator
   ```

2. **Verificar que funcionen**:
   - MCP Server: `http://localhost:3000`
   - Orchestrator: `http://localhost:3001`
   - Health check: `http://localhost:3001/health`

## 6. Estructura de Archivos por Servicio

### **packages/shared/**

```
packages/shared/
├── src/
│   ├── index.ts           # Exportaciones principales
│   ├── types/             # Tipos TypeScript compartidos
│   ├── utils/             # Utilidades comunes
│   └── schemas/           # Esquemas Zod compartidos
├── package.json
└── tsconfig.json
```

### **services/mcp-server/**

```
services/mcp-server/
├── src/
│   ├── index.ts           # Punto de entrada
│   ├── core/
│   │   ├── server.ts      # Configuración del servidor MCP
│   │   ├── domain/        # Lógica de dominio
│   │   └── services/      # Servicios de negocio
│   ├── infraestructure/
│   │   ├── database/      # Configuración de Prisma
│   │   ├── http/          # Servidores HTTP
│   │   └── tools/         # Herramientas MCP
│   └── shared/
│       └── utils/         # Utilidades específicas
├── prisma/
│   └── schema.prisma      # Esquema de base de datos
├── package.json
└── tsconfig.json
```

### **services/orchestrator/**

```
services/orchestrator/
├── src/
│   ├── index.ts           # Servidor Express
│   ├── app/               # Configuración de la app
│   ├── mcp/               # Integración con MCP
│   ├── schemas/           # Esquemas de validación
│   └── sop/               # Procedimientos operativos
├── package.json
└── tsconfig.json
```

## 7. Calidad y Estilo de Código

### Herramientas de Calidad

- **ESLint**: Análisis de código y detección de errores
- **Prettier**: Formateo automático de código
- **TypeScript**: Tipado estático

### Comandos de Calidad

```bash
# Antes de hacer commit, ejecutar:
npm run format      # Formatear código
npm run lint:fix    # Corregir errores de linting
```

## 8. Despliegue

### Despliegue Manual

```bash
# 1. Construir todos los servicios
npm run build

# 2. Generar cliente Prisma
npm run prisma:generate

# 3. Aplicar migraciones
npm run prisma:migrate

# 4. Ejecutar servicios
npm run start:mcp-server &
npm run start:orchestrator &
```

## 9. Variables de Entorno

### Archivo `.env`

```env
# Database
DATABASE_URL="postgresql://usuario:password@localhost:5432/mcp_sma"

# MCP Server
MCP_SERVER_PORT=3000
MCP_SERVER_HOST=localhost

# Orchestrator
ORCHESTRATOR_PORT=3001
ORCHESTRATOR_HOST=localhost

# CORS
CORS_ORIGIN=http://localhost:3000
```

## 10. Flujo de Colaboración con Git

### Git Flow

1. **Nunca trabajar directamente sobre `main`**
2. **Usar rama `develop` para desarrollo activo**:

   ```bash
   git checkout develop
   git pull origin develop
   ```

3. **Crear ramas de feature desde `develop`**:

   ```bash
   git checkout -b feat/nombre-funcionalidad
   ```

4. **Convención de nombres de ramas**:
   - `feat/agregar-tool-instagram`
   - `fix/corregir-login-usuario`
   - `docs/actualizar-readme`

5. **Pull Request a `develop`**:
   - Revisión de código obligatoria
   - Tests pasando
   - Código formateado y sin errores de linting

6. **Merge a `main`** solo cuando esté listo para producción

## 11. Troubleshooting

### Problemas Comunes

1. **Error de workspace**: Instalar dependencias en cada servicio individualmente
2. **Error de BOM**: Recrear archivos con codificación UTF-8 sin BOM
3. **Error de Prisma**: Ejecutar `npm run prisma:generate`
4. **Puerto ocupado**: Cambiar puertos en variables de entorno

### Comandos de Diagnóstico

```bash
# Verificar estructura
npm run build

# Verificar servicios
curl http://localhost:3001/health
curl http://localhost:3000/

# Ver logs de Docker
docker-compose logs -f
```

## 12. Contribución

1. Fork del repositorio
2. Crear rama de feature desde `develop`
3. Desarrollar y testear
4. Crear Pull Request a `develop`
5. Revisión y merge

---

**IMPORTANTE**: Todo el desarrollo activo se realiza en la rama `develop`. Los pushes van a `develop` hasta tener funcionalidades avanzadas, luego se prueba en deploy antes de mergear a `main`.
