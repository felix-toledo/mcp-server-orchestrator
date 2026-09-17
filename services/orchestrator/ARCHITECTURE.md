# Orchestrator Architecture

## Request flow

```
┌─────────────┐
│   Client    │
│  (Postman,  │
│   curl,     │
│   frontend) │
└──────┬──────┘
       │ POST /api/inquire
       │ Header: KAA
       │ Body: {messages: [...]}
       ↓
┌──────────────────────────────────┐
│    Orchestrator Service          │
│         (port 30021)             │
│                                   │
│  ┌────────────────────────────┐ │
│  │ validateAgentMiddleware    │ │
│  │ checks the KAA header      │ │
│  └────────────┬───────────────┘ │
│               ↓                  │
│  ┌────────────────────────────┐ │
│  │   inquireController        │ │
│  │ • validates the body (Zod) │ │
│  │ • maps messages to the     │ │
│  │   active provider's format │ │
│  └────────────┬───────────────┘ │
│               ↓                  │
│  ┌────────────────────────────┐ │
│  │     Orchestrator           │ │
│  │ • coordinates LLM + MCP    │ │
│  │ • conversation loop        │ │
│  └──────┬──────────┬──────────┘ │
│         │          │             │
└─────────┼──────────┼─────────────┘
          │          │
    ┌─────┘          └─────┐
    ↓                      ↓
┌──────────────┐    ┌──────────────┐
│ LLM Provider │    │  McpClient   │
│  (Strategy)  │    │              │
└──────┬───────┘    └──────┬───────┘
       │                   │
       ↓                   ↓
┌──────────────┐    ┌──────────────┐
│  Whichever   │    │ MCP Server   │
│  LLM_PROVIDER│    │ (port 30020) │
│   selects    │    │  • hello     │
└──────────────┘    │  • (more...) │
                     └──────────────┘
```

## Step by step

1. **`validateAgentMiddleware`** — checks the `KAA` header against
   `KEY_ALLOWED_AGENTS`. 401 if missing, 403 if it doesn't match.
2. **`inquireController`** — validates the request body with Zod, converts
   the message list to the active provider's format, creates or reuses an
   `Orchestrator` instance, calls `processConversation()`, returns JSON.
3. **`Orchestrator.processConversation`** — connects to the MCP server,
   fetches the available tools, then loops (max 10 iterations): ask the LLM
   for a response → if it requested tool calls, execute them via `McpClient`
   and feed the results back into the conversation → otherwise return the
   final answer.
4. **`ILlmProvider` (Strategy) + `LlmProviderFactory` (Factory)** — see
   [`docs/design-patterns.md`](../../docs/design-patterns.md) at the repo
   root for the general pattern writeup. `LlmProviderFactory.create()` reads
   `LLM_PROVIDER` from the environment and returns the matching
   implementation (`OpenAIProvider` today; `GeminiProvider`/`CopilotProvider`
   also exist).
5. **`McpClient`** — `connect()` opens a StreamableHTTP transport,
   `listTools()`/`getToolsForOpenAI()` discover and format the tool catalog,
   `callTool(name, args)` executes one.

## Directory layout

```
services/orchestrator/
├── src/
│   ├── api/
│   │   ├── inquireController.ts
│   │   └── validateAgentMiddleware.ts
│   ├── llm/                     # Strategy + Factory
│   │   ├── ILlmProvider.ts
│   │   ├── OpenAIProvider.ts
│   │   ├── GeminiProvider.ts
│   │   ├── CopilotProvider.ts
│   │   └── LlmProviderFactory.ts
│   ├── mcp/
│   │   ├── McpClient.ts
│   │   ├── McpManager.ts
│   │   └── Orchestrator.ts
│   ├── skills/
│   ├── config/
│   └── index.ts                 # entry point
├── .env
├── package.json
├── vitest.config.ts
└── tsconfig.json
```

## Environment variables

See `CLAUDE.md`'s Environment Variables section at the repo root for the
authoritative list — this is a service-local `.env`:

```env
PORT=30021
KEY_ALLOWED_AGENTS=your-secret-key
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4.1-nano
MCP_SERVER_URL=http://localhost:30020/mcp
```

## Security

1. Every request must carry the `KAA` header — this authenticates the
   calling agent/channel, not the end user (see
   [`docs/context.md`](../../docs/context.md) for the target per-user
   identity design, not yet built).
2. API keys live in `.env`, never in code, and are gitignored.
3. Zod validates every input at the boundary.
4. Errors are caught per layer and logged.

## Adding a new LLM provider

```typescript
export class ClaudeProvider implements ILlmProvider {
  getName() {
    return 'claude';
  }
  async generateResponse(/* ... */) {
    /* ... */
  }
}
```

Add a case for it in `LlmProviderFactory`, then set `LLM_PROVIDER=claude` (and
its API key) in `.env`.

## Adding new MCP tools

Done entirely in `mcp-server`: create the tool file under
`services/mcp-server/src/infraestructure/tools/`, register it in
`services/mcp-server/src/core/server.ts`. The orchestrator discovers it
automatically the next time it fetches the tool catalog — no orchestrator
change needed.

## Testing

See `CLAUDE.md`'s Testing section at the repo root, and
`services/orchestrator/TEST_API.md` (if present) for request examples.
