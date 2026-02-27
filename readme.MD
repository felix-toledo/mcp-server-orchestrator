# 🚀 MCP Server Orchestrator

<p align="center">
<img src="example.png" alt="MCP Server Orchestrator Example" />
</p>

A complete orchestration system for MCP (Model Context Protocol) servers that integrates AI models with custom tools via a modern, scalable architecture.

## 📋 Table of Contents

- [About the Project](https://www.google.com/search?q=%23-about-the-project)
- [Architecture](https://www.google.com/search?q=%23-architecture)
- [How It Works](https://www.google.com/search?q=%23-how-it-works)
- [Prerequisites](https://www.google.com/search?q=%23-prerequisites)
- [Quick Start](https://www.google.com/search?q=%23-quick-start)
- [Deployment Options](https://www.google.com/search?q=%23-deployment-options)
  - [Option A: No Docker (Local Development)](https://www.google.com/search?q=%23option-a-no-docker-local-development)
  - [Option B: With Docker Compose (Recommended)](https://www.google.com/search?q=%23option-b-with-docker-compose-recommended)
  - [Option C: Individual Docker Containers](https://www.google.com/search?q=%23option-c-individual-docker-containers)
- [Environment Variables](https://www.google.com/search?q=%23-environment-variables)
- [MCP Config: Connecting to External MCP Servers](https://www.google.com/search?q=%23-mcp-config-connecting-to-external-mcp-servers)
- [Usage & Examples](https://www.google.com/search?q=%23-usage--examples)
- [Project Structure](https://www.google.com/search?q=%23-project-structure)
- [Available Scripts](https://www.google.com/search?q=%23-available-scripts)
- [Troubleshooting](https://www.google.com/search?q=%23-troubleshooting)
- [Contributing](https://www.google.com/search?q=%23-contributing)

---

## 🎯 About the Project

**MCP Server Orchestrator** is a system that allows you to create intelligent AI agents capable of executing actions through custom tools. The project consists of two main services:

- **🔧 MCP Server** (Port 3000): A server that exposes custom tools following the MCP protocol.
- **🎭 Orchestrator** (Port 3001): A service that coordinates requests between an AI model (OpenAI) and the MCP server.

**Use Cases:**

- Create AI assistants with custom capabilities.
- Integrate language models with databases and APIs.
- Build intelligent agents that can execute actions within your system.
- Rapidly prototype new tools for AI.

---

## 🏗️ Architecture

```mermaid
graph LR
    A[Client/User] -->|POST /api/inquire| B[Orchestrator :3001]
    B -->|LLM Request| C[OpenAI API]
    B -->|MCP Protocol| D[MCP Server :3000]
    D -->|Query| E[(PostgreSQL)]
    C -->|Tool Calls| B
    B -->|Response| A

    style A fill:#e1f5ff
    style B fill:#fff4e6
    style C fill:#f3e5f5
    style D fill:#e8f5e9
    style E fill:#fce4ec
```

### Communication Flow

1.  **Client** sends a request to the **Orchestrator** with a user message.
2.  **Orchestrator** connects to the **MCP Server** to fetch available tools.
3.  **Orchestrator** sends the message and tools to **OpenAI**.
4.  **OpenAI** decides which tools to use and returns `tool_calls`.
5.  **Orchestrator** executes the tools on the **MCP Server**.
6.  **MCP Server** processes the request (DB queries, APIs, etc.).
7.  Results are sent back to **OpenAI** to generate the final response.
8.  **Orchestrator** returns the response to the **Client**.

---

## ⚙️ How It Works

### Main Components

#### 1\. **MCP Server** (`services/mcp-server`)

- Implements the MCP protocol using `@modelcontextprotocol/sdk`.
- Exposes tools that the AI model can execute.
- Manages connection with PostgreSQL using Prisma.
- HTTP Server on port 3000 with the `/mcp` endpoint.

**Tool Example:**

```typescript
// Simple tool that greets
server.tool(
  'hello',
  'Say hello to someone',
  {
    name: z.string().describe('Name of the person to greet'),
  },
  async ({ name }) => {
    return { content: [{ type: 'text', text: `Hello, ${name}!` }] };
  },
);
```

#### 2\. **Orchestrator** (`services/orchestrator`)

- Express Server on port 3001.
- Coordinates communication between OpenAI and the MCP Server.
- Implements the Strategy Pattern to support multiple LLM providers.
- Validates requests using authentication middleware (`KAA` header).

**Request Flow:**

```typescript
POST /api/inquire
→ validateAgentMiddleware (checks KAA header)
→ inquireController (validates and processes messages)
→ Orchestrator.processConversation()
  ├─ Connects to MCP Server
  ├─ Fetches available tools
  ├─ Conversation Loop (max 10 iterations):
  │  ├─ Sends messages to OpenAI with available tools
  │  ├─ If OpenAI requests tool_calls → executes on MCP Server
  │  ├─ Adds results to history
  │  └─ Repeats until final response is obtained
  └─ Returns response to client
```

---

## 📦 Prerequisites

### Minimum Requirements

- ✅ **Node.js**: v20.x or higher ([Download](https://nodejs.org/))
- ✅ **npm**: v10.x or higher (included with Node.js)
- ✅ **PostgreSQL**: v14 or higher (can be external)
- ✅ **OpenAI API Key**: Get it at [platform.openai.com](https://platform.openai.com/)

### Docker Requirements

- ✅ **Docker**: v20.10 or higher ([Download](https://www.docker.com/))
- ✅ **Docker Compose**: v2.0 or higher
- ✅ At least **2GB of RAM** available

### Verify Installation

```bash
# Verify Node.js
node --version  # Should show v20.x.x or higher

# Verify npm
npm --version   # Should show v10.x.x or higher

# Verify Docker (if using it)
docker --version
docker-compose --version
```

---

## 🚀 Quick Start

### Initial Setup (Both Options)

1.  **Clone the repository**

    ```bash
    git clone <Repository-URL>
    cd mcp-server-orchestrator
    ```

2.  **Configure environment variables**

    ```bash
    # Copy example file
    cp .env.example .env
    ```

3.  **Edit `.env` with your credentials**

    ```bash
    # Windows
    notepad .env

    # Linux/Mac
    nano .env
    ```

    Configure at least:
    - `DATABASE_URL`: Connection URL for your PostgreSQL database.
    - `OPENAI_API_KEY`: Your OpenAI API key.
    - `KEY_ALLOWED_AGENTS`: Secret key for authentication.

Now choose your preferred deployment option ⬇️

---

## 🛠️ Deployment Options

### Option A: No Docker (Local Development)

**Ideal for:** Active development, debugging, testing new features.

#### Step 1: Install Dependencies

```bash
# Install dependencies in the entire monorepo
npm install

# Build the shared package (required by other services)
npm run build:shared
```

#### Step 2: Configure Database

```bash
# Generate Prisma client
npm run prisma:generate

# Run migrations (optional, if you have pending migrations)
npm run prisma:migrate
```

#### Step 3: Start Services

**Option 3A: Separate terminals** (Recommended for development)

```bash
# Terminal 1: MCP Server
npm run dev:mcp-server

# Terminal 2: Orchestrator
npm run dev:orchestrator
```

**Option 3B: Production mode**

```bash
# Build all services
npm run build

# Terminal 1: MCP Server
npm run start:mcp-server

# Terminal 2: Orchestrator
npm run start:orchestrator
```

#### Step 4: Verify Installation

```bash
# Verify MCP Server
curl http://localhost:3000/health

# Verify Orchestrator
curl http://localhost:3001/health
```

✅ If both respond with `OK` or `{"status":"ok"}`, you are ready\!

---

### Option B: With Docker Compose (Recommended)

**Ideal for:** Production, server deployments, consistent environments.

#### Step 1: Configure Variables

```bash
# Copy template
cp env.template .env

# Edit with your values
notepad .env  # Windows
nano .env     # Linux/Mac
```

**Important:** Configure `DATABASE_URL` with your external PostgreSQL database.

#### Step 2: Start Services

```bash
# Build and start all services
docker-compose up -d --build

# View real-time logs
docker-compose logs -f

# View logs for a specific service
docker-compose logs -f orchestrator
```

#### Step 3: Run Migrations (First time)

```bash
# Generate Prisma client (if necessary)
docker-compose exec mcp-server npx prisma generate

# Run migrations (if necessary)
docker-compose exec mcp-server npx prisma migrate deploy
```

#### Step 4: Verify Installation

```bash
# View container status
docker-compose ps

# Verify health checks
curl http://localhost:3000/health
curl http://localhost:3001/health
```

#### Useful Docker Compose Commands

```bash
# Stop services
docker-compose down

# Restart a service
docker-compose restart mcp-server

# View error logs
docker-compose logs | grep ERROR

# Rebuild from scratch
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Enter a container
docker-compose exec mcp-server sh
```

---

### Option C: Individual Docker Containers

**Ideal for:** Advanced deployments, custom orchestration, Kubernetes.

#### Build Images

```bash
# Build MCP Server image
docker build --target mcp-server -t mcp-server:latest -f Dockerfile .

# Build Orchestrator image
docker build --target orchestrator -t orchestrator:latest -f Dockerfile .
```

#### Create Docker Network

```bash
docker network create mcp-network
```

#### Run MCP Server

```bash
docker run -d \
  --name mcp-server \
  --network mcp-network \
  -p 3000:3000 \
  -e DATABASE_URL="postgresql://user:password@host:5432/db" \
  -e PORT=3000 \
  -e NODE_ENV=production \
  --restart unless-stopped \
  mcp-server:latest
```

#### Run Orchestrator

```bash
docker run -d \
  --name orchestrator \
  --network mcp-network \
  -p 3001:3001 \
  -e MCP_SERVER_URL="http://mcp-server:3000/mcp" \
  -e OPENAI_API_KEY="your-api-key" \
  -e KEY_ALLOWED_AGENTS="your-secret-key" \
  -e PORT=3001 \
  -e NODE_ENV=production \
  --restart unless-stopped \
  orchestrator:latest
```

#### Verify Containers

```bash
# View active containers
docker ps

# View logs
docker logs -f mcp-server
docker logs -f orchestrator

# Execute commands inside the container
docker exec -it mcp-server sh
```

---

## 🔐 Environment Variables

### Variables Table

| Variable             | Service      | Required | Description               | Example                                        |
| -------------------- | ------------ | -------- | ------------------------- | ---------------------------------------------- |
| `NODE_ENV`           | Both         | No       | Execution environment     | `production` / `development`                   |
| `DATABASE_URL`       | MCP Server   | ✅ Yes   | PostgreSQL connection URL | `postgresql://user:pass@localhost:5432/dbname` |
| `MCP_SERVER_PORT`    | MCP Server   | No       | MCP Server Port           | `3000` (default)                               |
| `ORCHESTRATOR_PORT`  | Orchestrator | No       | Orchestrator Port         | `3001` (default)                               |
| `MCP_SERVER_URL`     | Orchestrator | ✅ Yes   | MCP Server URL            | `http://localhost:3000/mcp`                    |
| `OPENAI_API_KEY`     | Orchestrator | ✅ Yes   | OpenAI API Key            | `sk-...`                                       |
| `KEY_ALLOWED_AGENTS` | Orchestrator | ✅ Yes   | Authentication Key        | `my-secret-key`                                |
| `OPENAI_MODEL`       | Orchestrator | No       | OpenAI Model to use       | `gpt-4o-mini` (default)                        |
| `GEMINI_API_KEY`     | Orchestrator | Cond.    | Gemini API Key            | `AI...`                                        |
| `GEMINI_MODEL`       | Orchestrator | No       | Gemini Model to use       | `gemini-2.0-flash` (default)                   |
| `LLM_PROVIDER`       | Orchestrator | No       | LLM Provider              | `openai` / `gemini` (default: `openai`)        |

### Example `.env` File

```env
# General
NODE_ENV=production

# PostgreSQL Database (External)
DATABASE_URL=postgresql://user:password@db.example.com:5432/mcp_db

# MCP Server
MCP_SERVER_PORT=3000

# Orchestrator
ORCHESTRATOR_PORT=3001
MCP_SERVER_URL=http://localhost:3000/mcp
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxx
KEY_ALLOWED_AGENTS=my-super-secret-key-12345

# LLM Configuration (Optional)
LLM_PROVIDER=openai
OPENAI_MODEL=gpt-4o-mini

# Gemini (use LLM_PROVIDER=gemini)
# GEMINI_API_KEY=AI...
# GEMINI_MODEL=gemini-2.0-flash
```

---

## � MCP Config: Connecting to External MCP Servers

The Orchestrator can connect to **any MCP-compatible server**, not just the built-in one. This is configured through a `mcp_config.json` file placed in the `services/orchestrator/` directory.

### Supported Transports

| Transport        | Description                                                      | Use Case                                                       |
| ---------------- | ---------------------------------------------------------------- | -------------------------------------------------------------- |
| `stdio`          | Spawns a local process and communicates via stdin/stdout         | npm packages, local scripts, Claude Desktop-compatible servers |
| `streamableHttp` | Connects via HTTP using the current MCP Streamable HTTP protocol | Remote servers, your own MCP server, production APIs           |
| `sse`            | Connects via Server-Sent Events (legacy MCP protocol 2024-11-05) | Older MCP servers that haven't migrated to Streamable HTTP     |

### Configuration File

Create `services/orchestrator/mcp_config.json`:

```json
{
  "mcpServers": {
    "my-mcp-server": {
      "transport": "streamableHttp",
      "url": "http://localhost:3000/mcp"
    },
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp"]
    },
    "github": {
      "transport": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_xxxxxxxxxxxx"
      }
    },
    "filesystem": {
      "transport": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/dir"]
    },
    "remote-server": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://your-remote-server.com/mcp"]
    },
    "legacy-sse-server": {
      "transport": "sse",
      "url": "http://localhost:8080/sse"
    }
  }
}
```

### Transport Auto-Detection

The `transport` field is **optional**. If omitted, it is auto-detected based on the config shape:

| Config has | Detected transport |
| ---------- | ------------------ |
| `command`  | `stdio`            |
| `url`      | `streamableHttp`   |

This makes the config compatible with **Claude Desktop / Cursor / Windsurf** format:

```json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp"]
    }
  }
}
```

### Config File Resolution

The Orchestrator searches for the config file in this order:

1. `MCP_CONFIG_PATH` environment variable (absolute path)
2. `mcp_config.json` in the current working directory
3. `.mcp_config.json` in the current working directory
4. `mcp.config.json` in the current working directory

### Transport Reference

#### stdio

Spawns a child process and communicates via stdin/stdout. Ideal for npm-based MCP servers.

```json
{
  "transport": "stdio",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-github"],
  "env": { "GITHUB_TOKEN": "..." },
  "cwd": "/optional/working/directory"
}
```

| Field     | Required | Description                                       |
| --------- | -------- | ------------------------------------------------- |
| `command` | ✅       | Executable to run (`npx`, `node`, `python`, etc.) |
| `args`    | No       | Command line arguments                            |
| `env`     | No       | Environment variables for the process             |
| `cwd`     | No       | Working directory                                 |

#### streamableHttp

Connects to a remote server via the MCP Streamable HTTP protocol.

```json
{
  "transport": "streamableHttp",
  "url": "http://localhost:3000/mcp",
  "headers": { "Authorization": "Bearer ..." }
}
```

| Field     | Required | Description                  |
| --------- | -------- | ---------------------------- |
| `url`     | ✅       | Full URL of the MCP endpoint |
| `headers` | No       | Additional HTTP headers      |

#### sse

Connects via SSE (legacy protocol). Use only for servers that haven't migrated to Streamable HTTP.

```json
{
  "transport": "sse",
  "url": "http://localhost:8080/sse",
  "headers": { "Authorization": "Bearer ..." }
}
```

| Field     | Required | Description                  |
| --------- | -------- | ---------------------------- |
| `url`     | ✅       | Full URL of the SSE endpoint |
| `headers` | No       | Additional HTTP headers      |

### How It Works

When the Orchestrator starts processing a conversation:

1. Loads `mcp_config.json` and connects to all configured servers.
2. Discovers tools from each server and builds a unified tool registry.
3. All tools from all servers are passed to the LLM.
4. When the LLM calls a tool, the Orchestrator automatically routes it to the correct server.
5. Servers that fail to connect are skipped (non-blocking) — the rest continue working.

> **Note:** If two servers expose a tool with the same name, the last one loaded wins. A warning is logged when this happens.

---

## �💡 Usage & Examples

### MCP Inspector (Testing Tool)

To visually test the MCP Server:

```bash
# From the project root
npm run start:inspector-mcp
```

This will open a web interface to interact with the MCP tools.

### Example 1: Orchestrator API Call

```bash
curl -X POST http://localhost:3001/api/inquire \
  -H "Content-Type: application/json" \
  -H "KAA: your-secret-key" \
  -d '{
    "messages": [
      {"role": "user", "content": "Hello, what tools do you have available?"}
    ]
  }'
```

### Example 2: Using a Specific Tool

```bash
curl -X POST http://localhost:3001/api/inquire \
  -H "Content-Type: application/json" \
  -H "KAA: your-secret-key" \
  -d '{
    "messages": [
      {"role": "user", "content": "Use the hello tool to greet John"}
    ]
  }'
```

### Example 3: Multi-turn Conversation

```bash
curl -X POST http://localhost:3001/api/inquire \
  -H "Content-Type: application/json" \
  -H "KAA: your-secret-key" \
  -d '{
    "messages": [
      {"role": "user", "content": "What is your name?"},
      {"role": "assistant", "content": "I am an AI assistant powered by MCP."},
      {"role": "user", "content": "Can you help me with data analysis?"}
    ]
  }'
```

### Example 4: Using Postman

**URL:** `http://localhost:3001/api/inquire`  
**Method:** `POST`  
**Headers:**

- `Content-Type: application/json`
- `KAA: your-secret-key`

**Body (JSON):**

```json
{
  "messages": [{ "role": "user", "content": "message here" }]
}
```

### Expected Response

```json
{
  "success": true,
  "response": "Response generated by the AI model",
  "metadata": {
    "iterations": 2,
    "toolsUsed": ["hello", "getAccountAnalytics"]
  }
}
```

---

## 📁 Project Structure

```
mcp-server-orchestrator/
├── services/
│   ├── mcp-server/                 # MCP Server (Port 3000)
│   │   ├── src/
│   │   │   ├── core/              # MCP Server logic
│   │   │   │   └── server.ts      # Configuration and tool registration
│   │   │   ├── infraestructure/   # Infrastructure
│   │   │   │   └── tools/         # MCP tool implementation
│   │   │   └── index.ts           # Entry point
│   │   ├── prisma/
│   │   │   └── schema.prisma      # Database schema
│   │   └── package.json
│   │
│   └── orchestrator/              # Orchestrator (Port 3001)
│       ├── src/
│       │   ├── api/               # Controllers and middleware
│       │   │   ├── inquireController.ts
│       │   │   └── validateAgentMiddleware.ts
│       │   ├── llm/               # LLM Providers (Strategy Pattern)
│       │   │   ├── ILlmProvider.ts
│       │   │   ├── OpenAIProvider.ts
│       │   │   └── LlmProviderFactory.ts
│       │   ├── mcp/               # MCP Client
│       │   │   ├── McpClient.ts
│       │   │   └── Orchestrator.ts
│       │   └── index.ts           # Entry point - Express Server
│       ├── ARCHITECTURE.md        # Detailed documentation
│       └── package.json
│
├── packages/
│   └── shared/                    # Shared utilities
│       ├── src/
│       │   ├── types/             # TypeScript Types
│       │   ├── utils/             # Utility functions
│       │   └── schemas/           # Zod Schemas
│       └── package.json
│
├── Dockerfile                     # Multi-stage build for both services
├── docker-compose.yml             # Service orchestration
├── .env.example                   # Environment variable example
├── env.template                   # Template for Docker
├── package.json                   # Workspace root
├── tsconfig.json                  # TypeScript configuration
└── README.md                      # This file
```

---

## 🎯 Available Scripts

### Root Scripts (Workspace)

```bash
# Build
npm run build                  # Builds all services
npm run build:shared           # Builds only the shared package
npm run build:mcp-server       # Builds only the MCP Server
npm run build:orchestrator     # Builds only the Orchestrator

# Development
npm run dev:mcp-server         # Development mode MCP Server (hot reload)
npm run dev:orchestrator       # Development mode Orchestrator (hot reload)
npm run dev:shared             # Development mode Shared (watch)

# Production
npm run start:mcp-server       # Runs compiled MCP Server
npm run start:orchestrator     # Runs compiled Orchestrator
npm run start:inspector-mcp    # Opens MCP Inspector in the browser

# Database (Prisma)
npm run prisma:generate        # Generates Prisma client
npm run prisma:migrate         # Runs migrations
npm run prisma:studio          # Opens Prisma Studio (GUI)

# Code Quality
npm run lint                   # Checks code with ESLint
npm run lint:fix               # Automatically fixes errors
npm run format                 # Formats code with Prettier

# Maintenance
npm run clean                  # Cleans builds and node_modules
npm run install:all            # Installs deps and builds shared
```

### Scripts per Service

```bash
# In services/mcp-server/
cd services/mcp-server
npm run dev                   # Development with hot reload
npm run build                 # Builds the service
npm run start                 # Runs compiled version
npm run prisma:generate       # Generates Prisma client
npm run prisma:studio         # Opens Prisma Studio

# In services/orchestrator/
cd services/orchestrator
npm run dev                   # Development with tsx
npm run build                 # Builds the service
npm run start                 # Runs compiled version
```

---

## 🔥 Troubleshooting

### Common Issues and Solutions

#### 1\. Error: "Cannot find module '@modelcontextprotocol/sdk'"

**Cause:** Dependencies not installed correctly.

**Solution:**

```bash
# Clean cache and reinstall
npm run clean
npm install
npm run build:shared
```

#### 2\. Error: "Prisma Client is not generated"

**Cause:** Prisma Client not generated.

**Solution:**

```bash
npm run prisma:generate
```

#### 3\. Error: "Port 3000 is already in use"

**Cause:** Port occupied by another process.

**Solution:**

```bash
# Windows - Find process using the port
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Linux/Mac
lsof -i :3000
kill -9 <PID>

# Or change the port in .env
MCP_SERVER_PORT=3002
```

#### 4\. Database Connection Error

**Cause:** Incorrect `DATABASE_URL` or database not reachable.

**Solution:**

```bash
# Verify connection
psql postgresql://user:password@host:5432/dbname

# Verify variable is set
echo $DATABASE_URL  # Linux/Mac
echo %DATABASE_URL% # Windows cmd
$env:DATABASE_URL   # Windows PowerShell

# Ensure correct format
DATABASE_URL="postgresql://user:password@host:5432/db_name"
```

#### 5\. Docker: "service 'mcp-server' didn't complete successfully"

**Cause:** Error in environment variables or build.

**Solution:**

```bash
# View detailed logs
docker-compose logs mcp-server

# Rebuild without cache
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Verify environment variables
docker-compose config
```

#### 6\. Error: "Invalid API Key" in Orchestrator

**Cause:** `OPENAI_API_KEY` not configured or invalid.

**Solution:**

```bash
# Verify key is in .env
cat .env | grep OPENAI_API_KEY

# Ensure it starts with 'sk-'
OPENAI_API_KEY=sk-proj-...
```

#### 7\. Error 401/403 when calling `/api/inquire`

**Cause:** Missing or incorrect `KAA` header.

**Solution:**

```bash
# Ensure correct header is included
curl -H "KAA: your-secret-key" ...

# Verify it matches .env
KEY_ALLOWED_AGENTS=your-secret-key
```

#### 8\. Orchestrator cannot connect to MCP Server

**Cause:** Incorrect `MCP_SERVER_URL`.

**Solution:**

```bash
# Without Docker (localhost)
MCP_SERVER_URL=http://localhost:3000/mcp

# With Docker Compose (service name)
MCP_SERVER_URL=http://mcp-server:3000/mcp

# Verify both services are running
curl http://localhost:3000/health
curl http://localhost:3001/health
```

#### 9\. Hot reload not working in development

**Cause:** Files not being watched.

**Solution:**

```bash
# Stop process and restart
# Ctrl+C to stop
npm run dev:mcp-server

# If using Windows with WSL, there might be file watching issues
# Use polling mode
npm run dev -- --usePolling
```

#### 10\. Error executing migrations in Docker

**Cause:** Permissions or Prisma Client not generated.

**Solution:**

```bash
# Generate client first
docker-compose exec mcp-server npx prisma generate

# Then execute migrations
docker-compose exec mcp-server npx prisma migrate deploy

# If it fails, enter container and debug
docker-compose exec mcp-server sh
cd /app/services/mcp-server
npx prisma migrate deploy --schema=prisma/schema.prisma
```

### Diagnostic Commands

```bash
# Verify versions
node --version
npm --version
docker --version
docker-compose --version

# Verify running services
# Without Docker
curl http://localhost:3000/health
curl http://localhost:3001/health

# With Docker
docker-compose ps
docker-compose logs --tail=50

# Verify connectivity between services (Docker)
docker-compose exec orchestrator ping mcp-server

# View environment variables (Docker)
docker-compose exec mcp-server env | grep DATABASE
docker-compose exec orchestrator env | grep OPENAI
```

---

## 🤝 Contributing

### Git Workflow

1.  **Fork the repository**

2.  **Create a feature branch from `develop`**

    ```bash
    git checkout develop
    git pull origin develop
    git checkout -b feat/feature-name
    ```

3.  **Develop and test**

    ```bash
    # Develop your feature
    npm run dev:mcp-server

    # Format code
    npm run format

    # Verify linting
    npm run lint:fix
    ```

4.  **Commit with descriptive messages**

    ```bash
    git add .
    git commit -m "feat: description of change"
    ```

5.  **Push and create Pull Request**

    ```bash
    git push origin feat/feature-name
    ```

6.  **PR to `develop`**, not `main`

### Branch Naming Convention

- `feat/feature-name` - New features
- `fix/bug-description` - Bug fixes
- `docs/topic` - Documentation
- `refactor/component` - Code refactoring
- `test/component` - Adding tests

### Adding New MCP Tools

1.  Create file in `services/mcp-server/src/infraestructure/tools/`.
2.  Implement the tool following the existing pattern.
3.  Register in `services/mcp-server/src/core/server.ts`.
4.  The orchestrator will discover them automatically ✨

**Example:**

```typescript
// services/mcp-server/src/infraestructure/tools/myTool.ts
import { z } from 'zod';

export function registerMyTool(server: Server) {
  server.tool(
    'myTool',
    'Description of what the tool does',
    {
      param1: z.string().describe('Description of param1'),
      param2: z.number().describe('Description of param2'),
    },
    async ({ param1, param2 }) => {
      // Implementation
      const result = doSomething(param1, param2);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result),
          },
        ],
      };
    },
  );
}
```

### Adding New LLM Provider

1.  Implement `ILlmProvider` in `services/orchestrator/src/llm/`.
2.  Add to Factory in `LlmProviderFactory.ts`.
3.  Configure in `.env` with `LLM_PROVIDER=new-provider`.

---

## 📚 Additional Documentation

- **[ARCHITECTURE.md](https://www.google.com/search?q=services/orchestrator/ARCHITECTURE.md)**: Detailed Orchestrator architecture.
- **[DEPLOYMENT.md](https://www.google.com/search?q=DEPLOYMENT.md)**: Complete deployment guide with Docker.
- **[DOCKER.md](DOCKER.md)**: Docker quick reference.

---

## 📄 License

Since there is nothing, you can start from scratch with this project.

---

## 🙏 Acknowledgements

- [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) for the SDK.
- [OpenAI](https://openai.com/) for the Language Model API.
- [Prisma](https://www.prisma.io/) for the excellent ORM.

---

<p align="center">
Made with ❤️ to simplify AI integration with custom tools
</p>

<p align="center">
⭐ If this project was useful, consider giving it a star
</p>
