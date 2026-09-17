# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

MCP Server for SMA - TypeScript monorepo containing MCP server and orchestrator services for social media analytics. The architecture uses the Model Context Protocol (MCP) to expose tools that can be called by LLM-powered agents.

## Workspace Structure

```
mcp-server-sma/
├── packages/shared/          # Shared utilities and types
├── services/
│   ├── mcp-server/          # MCP server (port 3011) - exposes tools
│   └── orchestrator/        # Orchestrator (port 3012) - coordinates LLM + MCP
```

## Common Commands

### Initial Setup

```bash
npm install              # Install all workspace dependencies
npm run build:shared     # REQUIRED: Build shared package first
npm run prisma:generate  # Generate Prisma client
```

### Development

```bash
# Run services individually (in separate terminals)
npm run dev:mcp-server      # Start MCP server on port 3011
npm run dev:orchestrator    # Start orchestrator on port 3012
npm run dev:shared          # Watch mode for shared package

# Run MCP inspector (debug MCP tools)
npm run start:inspector-mcp
```

### Build & Production

```bash
npm run build                  # Build all workspaces
npm run build:mcp-server       # Build only mcp-server
npm run build:orchestrator     # Build only orchestrator
npm run start:mcp-server       # Run built mcp-server
npm run start:orchestrator     # Run built orchestrator
```

### Database (Prisma)

```bash
npm run prisma:generate  # Generate Prisma client (run after schema changes)
npm run prisma:migrate   # Run migrations
npm run prisma:studio    # Open Prisma Studio GUI
```

### Code Quality

```bash
npm run format      # Format all code with Prettier
npm run lint        # Lint all workspaces
npm run lint:fix    # Auto-fix linting errors
```

### Clean

```bash
npm run clean       # Remove all node_modules and dist folders
```

## Architecture

### MCP Server (`services/mcp-server`)

- **Purpose**: Exposes MCP tools for social media platforms (Instagram, WhatsApp, Telegram, TikTok, Facebook)
- **Port**: 3011
- **Key Files**:
  - `src/core/server.ts` - Central tool registration (add new tools here)
  - `src/infraestructure/tools/` - Tool implementations
  - `prisma/schema.prisma` - Database schema

**Tool Registration Pattern**:

```typescript
// 1. Create tool in src/infraestructure/tools/myTool.ts
export function registerMyTool(server: McpServer) {
  server.tool(/* ... */);
}

// 2. Register in src/core/server.ts
import { registerMyTool } from '../infraestructure/tools/myTool.js';
registerMyTool(server);
```

### Orchestrator (`services/orchestrator`)

- **Purpose**: Coordinates between LLM providers (OpenAI) and MCP server
- **Port**: 3012
- **Architecture Pattern**: Uses Strategy pattern for LLM providers
- **Key Flow**:
  1. `index.ts` - Express app entry point
  2. `validateAgentMiddleware.ts` - KAA header authentication
  3. `inquireController.ts` - Main `/api/inquire` endpoint
  4. `Orchestrator.ts` - Coordinates LLM ↔ MCP tool calls (max 10 iterations)
  5. `OpenAIProvider.ts` - LLM integration (implements `ILlmProvider`)
  6. `McpClient.ts` - MCP server communication

**Authentication**: All requests require `KAA` header matching `KEY_ALLOWED_AGENTS` env var

**Adding new LLM provider**:

1. Implement `ILlmProvider` interface
2. Add to `LlmProviderFactory`
3. Set `LLM_PROVIDER` in `.env`

### Shared Package (`packages/shared`)

- Currently minimal - contains shared types and utilities
- **Must be built before other services**: `npm run build:shared`

## Design Patterns in Use

1. **Module Pattern**: Each tool/service in separate files with explicit exports
2. **Service Layer**: Business logic separated from tools (see `DessignPatterns.md`)
3. **Dependency Injection**: Services receive dependencies via constructor (e.g., PrismaClient)
4. **Strategy Pattern**: Interchangeable LLM providers (`ILlmProvider` implementations)

See `DessignPatterns.md` for detailed examples.

## Environment Variables

### MCP Server (`.env` in `services/mcp-server/`)

```env
DATABASE_URL="postgresql://user:password@localhost:5432/mcp_sma"
MCP_SERVER_PORT=3011
```

### Orchestrator (`.env` in `services/orchestrator/`)

```env
PORT=3012
KEY_ALLOWED_AGENTS=your-secret-key
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4.1-nano
MCP_SERVER_URL=http://localhost:3011/mcp
```

## Git Workflow

- **Main branch**: Production-ready code only
- **Develop branch**: Active development (default target)
- **Feature branches**: `feat/feature-name`, `fix/bug-name`, `docs/doc-name`
- **Never commit directly to `main`**
- Create PRs to `develop` for code review

## Testing the System

### Health Check

```bash
curl http://localhost:3012/health
```

### Test Orchestrator with Tool Call

```bash
curl -X POST http://localhost:3012/api/inquire \
  -H "Content-Type: application/json" \
  -H "KAA: your-secret-key" \
  -d '{
    "messages": [
      {"role": "user", "content": "Use the hello tool to greet John"}
    ]
  }'
```

See `services/orchestrator/TEST_API.md` for more examples.

## Key Technical Details

- **Node Version**: v18+
- **Package Manager**: npm (workspace-enabled)
- **Module System**: ES Modules (`"type": "module"`)
- **Database**: PostgreSQL with Prisma ORM
- **TypeScript**: Strict mode enabled
- **Import Extensions**: Use `.js` extensions in imports (TypeScript ESM requirement)

## Common Issues

1. **Workspace dependency errors**: Run `npm install` at root, then `npm run build:shared`
2. **Prisma client errors**: Run `npm run prisma:generate`
3. **Port conflicts**: Check ports 3011 and 3012 are available
4. **MCP connection errors**: Ensure mcp-server is running before starting orchestrator
