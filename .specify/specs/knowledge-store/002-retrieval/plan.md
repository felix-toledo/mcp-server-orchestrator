# Plan — Chat retrieval (semantic search over the vault)

Base: [`spec.md`](./spec.md) (no Open Questions remain). Follows
[`docs/design-patterns.md`](../../../../docs/design-patterns.md) and
[`docs/conventions/architecture.md`](../../../../docs/conventions/architecture.md).
Contracts below are signatures only — no logic, per `planner`'s rules.
Paths/signatures below match the **actual current code**, not
`001-vectorization`'s original plan where the two have since diverged (e.g.
`mcp-server`'s tools live under `src/infraestructure/tools/`, not
`infrastructure/`).

## 1. Layering

```
orchestrator:  Orchestrator.processConversation (new step) → McpManager.callTool → McpClient
mcp-server:    searchKnowledgeEntriesTool.ts (transport) → KnowledgeStoreClient (HTTP)
knowledge-store: knowledgeEntriesController (transport) → KnowledgeEntryService (business logic) → prisma ($queryRaw)
```

Same 3-layer direction as `001-vectorization`.

## 2. `knowledge-store` — new endpoint

### 2.1 Route registration order (`src/core/server.ts`) — real gotcha

Express matches routes in registration order. `GET /knowledge-entries/:id`
is already registered; adding `GET /knowledge-entries/search` **after** it
would never be reached (`:id` greedily matches the literal string
`"search"`). It must be registered **before** the `:id` route:

```typescript
app.get('/knowledge-entries/search', knowledgeEntriesController.search); // before :id
app.get('/knowledge-entries/:id', knowledgeEntriesController.getById);
```

### 2.2 Schema (`src/api/schemas.ts`)

```typescript
export const SearchKnowledgeEntriesQuerySchema = z.object({
  q: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(5).default(5),
});
export type SearchKnowledgeEntriesQuery = z.infer<typeof SearchKnowledgeEntriesQuerySchema>;
```

### 2.3 `KnowledgeEntryService` — new method (`src/services/knowledgeEntryService.ts`)

```typescript
export interface KnowledgeEntrySearchResult {
  id: string;
  path: string;
  title: string;
  summary: string;
  similarity: number; // 1 - cosine distance, spec §4
}

export class KnowledgeEntryService {
  // ...existing methods unchanged...
  search(query: string, limit: number): Promise<KnowledgeEntrySearchResult[]>; // spec AC2-AC4
}
```

Implementation shape (embeds `query`, then one `$queryRaw` — same raw-SQL
pattern `setEmbedding` already uses for pgvector, since `embedding` is
`Unsupported("vector(1536)")` and Prisma can't express `<=>` in its query
builder):

```typescript
async search(query: string, limit: number): Promise<KnowledgeEntrySearchResult[]> {
  const user = await this.userService.getCurrent();
  if (!user) return [];

  const queryEmbedding = await this.embeddings.embed(query);
  const vectorLiteral = `[${queryEmbedding.join(',')}]`;

  return this.prisma.$queryRaw<KnowledgeEntrySearchResult[]>`
    SELECT id, path, title, summary,
           1 - (embedding <=> ${vectorLiteral}::vector) AS similarity
    FROM "KnowledgeEntry"
    WHERE "userId" = ${user.id}
      AND embedding IS NOT NULL
      AND 1 - (embedding <=> ${vectorLiteral}::vector) >= ${SIMILARITY_THRESHOLD}
    ORDER BY embedding <=> ${vectorLiteral}::vector ASC
    LIMIT ${limit};
  `;
}
```

`SIMILARITY_THRESHOLD = 0.35` (spec §7.1 — recalibrated from an original
0.75 during live verification, see that section for the real numbers) — one
`const` at the top of this file, the single place to recalibrate per the
spec's explicit note that this value isn't locked.

### 2.4 Controller (`src/api/knowledgeEntriesController.ts`) — new handler

```typescript
search: async (req: Request, res: Response): Promise<void> => {
  const parsed = SearchKnowledgeEntriesQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid query', details: parsed.error.issues });
    return;
  }
  const results = await knowledgeEntryService.search(parsed.data.q, parsed.data.limit);
  res.status(200).json(results);
},
```

Same thin pattern as every other handler in this file — no business logic.

## 3. `mcp-server` — new tool

`src/infraestructure/tools/searchKnowledgeEntriesTool.ts`, same shape as
`createKnowledgeEntryTool.ts`:

```typescript
const SearchKnowledgeEntriesInputSchema = z.object({
  query: z.string().min(1).describe('Text to search the vault for, semantically'),
  limit: z.number().int().min(1).max(5).optional().describe('Max results, default 5'),
});

export function registerSearchKnowledgeEntriesTool(
  server: McpServer,
  knowledgeStoreClient: KnowledgeStoreClient,
): void;
```

`KnowledgeStoreClient` (`src/infraestructure/http/knowledgeStoreClient.ts`)
gains one method:

```typescript
export interface SearchKnowledgeEntriesResult {
  id: string;
  path: string;
  title: string;
  summary: string;
  similarity: number;
}

searchKnowledgeEntries(query: string, limit?: number): Promise<SearchKnowledgeEntriesResult[]>;
// GET `${baseUrl}/knowledge-entries/search?q=${encodeURIComponent(query)}&limit=${limit ?? 5}`
```

Registered in `src/core/server.ts` next to
`registerCreateKnowledgeEntryTool(server, knowledgeStoreClient)`.

## 4. `orchestrator` — new step in `Orchestrator.processConversation`

Inserted right after `const tools = ...getAllTools()` and before
`systemContent` is built (spec §6):

```typescript
const RETRIEVAL_TOOL_NAME = 'searchKnowledgeEntries';

// tools the LLM sees excludes the retrieval tool from the start (AC5) —
// it's fetched once from mcpManager.getAllTools() and filtered immediately,
// there's no separate "all tools" list kept around afterward.
const allTools = this.mcpManager ? this.mcpManager.getAllTools() : [];
const tools = allTools.filter((t) => t.name !== RETRIEVAL_TOOL_NAME);

// search (AC1, AC7: never throws past this point) — extracted into its own
// method, searchVaultForContext(nonSystemMessages), specifically so this
// stays out of processConversation's body: that method already carried a
// pre-existing cyclomatic-complexity lint warning (18, over the max-10
// threshold) before this spec touched it, and inlining the search/try-catch
// here would have pushed it to 23. Extracting keeps the warning at 18.
const retrievalContext = await this.searchVaultForContext(nonSystemMessages);

// merge into extraInstructions (AC6) — combined with any skill instructions already present
const combinedExtraInstructions = [extraInstructions, retrievalContext].filter(Boolean).join('\n\n---\n\n');
```

`formatRetrievalContext(toolResult: unknown): string` — new pure function
(own file, `src/mcp/formatRetrievalContext.ts`, easiest to unit test in
isolation). Takes the **raw MCP `CallToolResult`** `searchVaultForContext`
gets back from `mcpManager.callTool` (`{ content: [{ type: 'text', text:
'...' }], isError?: boolean }`), not a pre-parsed array — it JSON-parses
`content[0].text` itself:

- Empty array, `isError: true`, missing/malformed `content`, or invalid
  JSON → all treated the same, the explicit "no se encontró ninguna nota
  relacionada" sentence (AC4/AC6/AC7 — a broken result is exactly as safe
  to fall back on as an empty one).
- Non-empty, well-formed → a short bulleted `title: summary` list.

`systemContent`'s existing `[CONTEXTO ADICIONAL — ...]` wrapping (unchanged
code) now wraps `combinedExtraInstructions` instead of just
`extraInstructions`.

### 4.1 System prompt addition (AC8)

One more sentence appended to `systemInstructions` in `Orchestrator.ts`,
next to the existing "don't narrate saving" rule added 2026-09-17: buscar en
la bóveda es tan invisible para el usuario como guardar — nunca mencionar
que se buscó, cuántos resultados hubo, ni repetir título/ruta/id de una nota
encontrada salvo que el usuario pida explícitamente ver la nota.

## 5. Design patterns applied

- **Service Layer**: `KnowledgeEntryService.search` holds the only
  similarity-threshold/limit logic — controller stays thin (§2.4).
- **Dependency Injection**: nothing new to inject — `search` reuses the
  same `prisma`/`embeddings`/`userService` already constructor-injected
  into `KnowledgeEntryService`.
- No new pattern needed in `mcp-server` (same thin-tool shape as
  `createKnowledgeEntryTool`) or `orchestrator` (`formatRetrievalContext`
  is a pure function, not a class — no DI surface).

## 6. Test strategy (Vitest)

| Target | Covers |
|---|---|
| `KnowledgeEntryService.search` (mocked `PrismaClient.$queryRaw`, `EmbeddingsProvider`, `UserService`) | AC2 (embeds query, passes threshold/limit), AC3 (shape returned — no `content` field), AC4 (empty when nothing clears threshold), no-user edge case |
| `knowledgeEntriesController.search` (supertest, mirrors `core/server.test.ts`) | 200 with results, 200 `[]`, 400 on missing `q`, route-order regression (`/search` not swallowed by `/:id` — §2.1) |
| `formatRetrievalContext` (pure function) | AC4/AC6 — empty-array wording, non-empty formatting |
| `Orchestrator.processConversation` (mocked `McpManager`) | AC1 (search called with last user message), AC5 (`searchKnowledgeEntries` excluded from what the LLM sees, still callable via `McpManager`), AC7 (search throws → conversation still completes, no crash) |
| `KnowledgeStoreClient.searchKnowledgeEntries` (stubbed `fetch`, mirrors `createKnowledgeEntry`'s tests) | request URL/query params, 2xx parsing, non-2xx and network-failure error paths |
| `searchKnowledgeEntriesTool` (via `createFakeMcpServer`, mirrors `createKnowledgeEntryTool.test.ts`) | success path returns JSON text, `limit` passed through, MCP tool error (not thrown) on client failure |

**Correction from this plan's original draft**: `CLAUDE.md`'s Testing
section already lists `services/mcp-server` as Vitest-required (closed
2026-09-18, no longer the tracked gap `001-vectorization`'s plan described
when it was written) — the "no dedicated test" call below doesn't apply
here. `searchKnowledgeEntriesTool` and `KnowledgeStoreClient`'s new method
both get tests, same as every other `mcp-server` file today.

## 7. Build order (detailed breakdown → `tasks.md`)

1. `knowledge-store`: `KnowledgeEntryService.search` + tests (§2.3, §6).
2. `knowledge-store`: schema + controller + route registered **before**
   `:id` (§2.1, §2.2, §2.4) + tests.
3. `mcp-server`: `KnowledgeStoreClient.searchKnowledgeEntries` +
   `searchKnowledgeEntriesTool.ts`, registered in `core/server.ts` (§3).
4. `orchestrator`: `formatRetrievalContext` + test (§4).
5. `orchestrator`: wire the new step into `processConversation` + system
   prompt sentence (§4, §4.1) + test.
6. End-to-end manual verification (same method as `001-vectorization`
   T9's live check): save a note, ask about it in a fresh conversation,
   confirm the answer uses it **without** naming the tool/vault/file.
