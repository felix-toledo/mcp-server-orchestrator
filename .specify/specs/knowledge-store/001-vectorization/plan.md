# Plan — Knowledge vectorization & persistence

Base: [`spec.md`](./spec.md) (no Open Questions remain). Follows
[`docs/design-patterns.md`](../../../../docs/design-patterns.md) and
[`docs/conventions/architecture.md`](../../../../docs/conventions/architecture.md).
Contracts below are signatures only — no logic, per `planner`'s rules.

## 1. Layering (both components)

```
mcp-server:  createKnowledgeEntryTool.ts (transport) → knowledgeStoreClient (HTTP)
knowledge-store:  controllers (transport) → services (business logic) → vault/ + prisma (data access)
```

Same 3-layer direction as everywhere else in this repo: transport never
skips the service layer, services never know about Express/MCP.

## 2. `services/mcp-server` — new file

`src/infraestructure/tools/createKnowledgeEntryTool.ts`:

```typescript
const CreateKnowledgeEntryInputSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  tags: z.array(z.string()).optional(),
});

export function registerCreateKnowledgeEntryTool(
  server: McpServer,
  knowledgeStoreClient: KnowledgeStoreClient, // injected, see §6
): void;
```

- Calls `knowledgeStoreClient.createKnowledgeEntry(input)`. On a thrown
  error (network/HTTP failure), catches it and returns an MCP tool error
  result (`isError: true` in the `CallToolResult`) instead of rethrowing —
  this is what AC5 needs.
- `KnowledgeStoreClient` (new, `src/infrastructure/knowledgeStoreClient.ts`)
  is a thin `fetch` wrapper reading `KNOWLEDGE_STORE_URL`, constructed once
  in `src/core/server.ts` and injected — same DI rule as `PrismaClient`
  elsewhere, applied here to an HTTP client instead.
- No business logic in this file (Clause IV) — it's a pure transport
  adapter. This is also why it needs no Vitest test of its own: there's
  nothing to unit-test beyond "does it call the client and shape the
  response," which is exactly the kind of thin-wrapper code
  `docs/conventions/architecture.md` doesn't ask for a test around. (Matches
  the existing, already-flagged gap: `mcp-server` has no Vitest yet at all.)

## 3. `services/knowledge-store` — contracts

### 3.1 Request/response schemas (`src/api/schemas.ts`)

```typescript
export const PurposeSchema = z.enum([
  'PERSONAL_DAILY',
  'AUTOMATION_PRODUCTIVITY',
  'PROJECTS_WORK',
  'SECOND_BRAIN_STUDY',
  'TEAM_BUSINESS',
]);

export const CreateUserInputSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  purpose: PurposeSchema,
});

export const CreateKnowledgeEntryInputSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  tags: z.array(z.string()).optional(),
});

export const UpdateKnowledgeEntryInputSchema = z.object({
  content: z.string().min(1),
});
```

### 3.2 Service interfaces

```typescript
// src/services/userService.ts
export class UserService {
  constructor(private readonly prisma: PrismaClient) {}
  create(input: CreateUserInput): Promise<User>;   // throws UserAlreadyExistsError if one exists (AC → 409)
  getCurrent(): Promise<User | null>;                // null → controller returns 404
}

// src/services/embeddingsProvider.ts — Strategy (see §5)
export interface EmbeddingsProvider {
  embed(text: string): Promise<number[]>;
}
export class OpenAiEmbeddingsProvider implements EmbeddingsProvider {
  constructor(private readonly apiKey: string, private readonly model: string) {}
  embed(text: string): Promise<number[]>;
}

// src/vault/vaultRepository.ts
export class VaultRepository {
  constructor(private readonly vaultRoot: string) {}
  write(slugBase: string, fileContents: string): Promise<{ path: string }>; // AC2: internally resolves collisions
  read(path: string): Promise<string>;
  overwrite(path: string, fileContents: string): Promise<void>;
  delete(path: string): Promise<void>;                                      // used for AC3 rollback
}

// src/services/knowledgeEntryService.ts
export class KnowledgeEntryService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly vault: VaultRepository,
    private readonly embeddings: EmbeddingsProvider,
  ) {}
  create(input: CreateKnowledgeEntryInput): Promise<KnowledgeEntrySummary>;      // AC1–AC4
  list(): Promise<KnowledgeEntrySummary[]>;                                       // updatedAt desc
  getById(id: string): Promise<KnowledgeEntryDetail | null>;                     // content = live file read
  update(id: string, input: UpdateKnowledgeEntryInput): Promise<KnowledgeEntrySummary>;
}
```

### 3.3 Controllers (`src/api/`) — thin, one per resource

`usersController.ts` and `knowledgeEntriesController.ts`: each handler
validates with the Zod schema from §3.1, calls exactly one `*Service`
method, maps the result/error to the HTTP status in spec §5.1's table. No
business logic — a `UserAlreadyExistsError` thrown by `UserService.create`
maps to `409` here, it isn't re-derived.

## 4. Composition root (`src/index.ts`) + route wiring (`src/core/server.ts`)

**Implemented split** (refined during Implement for testability —
`createApp` takes its dependencies as a parameter instead of building them
itself, so a test can pass fakes without touching Prisma/the filesystem/a
real HTTP call):

```typescript
// src/index.ts — the one place everything gets `new`'d
const prisma = new PrismaClient();
const vault = new VaultRepository(resolveVaultPath());
const embeddings = new OpenAiEmbeddingsProvider(env.OPENAI_API_KEY, env.EMBEDDINGS_MODEL);
const userService = new UserService(prisma);
const knowledgeEntryService = new KnowledgeEntryService(prisma, vault, embeddings, userService);
const app = createApp({ userService, knowledgeEntryService });
app.listen(PORT);

// src/core/server.ts — pure wiring, no construction
export function createApp(deps: { userService: UserService; knowledgeEntryService: KnowledgeEntryService }): Express;
```

## 5. Design patterns applied

- **Module Pattern**: one file per controller/service/repository (§3).
- **Service Layer**: `UserService`/`KnowledgeEntryService` hold all business
  rules (slug collision, rollback, summary truncation) — controllers never
  touch Prisma or the filesystem directly.
- **Dependency Injection**: `PrismaClient`, `VaultRepository`,
  `EmbeddingsProvider` are each constructed once in `index.ts` and passed
  via constructors — never `new`'d inside a service. `createApp` itself
  takes the already-built `UserService`/`KnowledgeEntryService` as
  parameters rather than constructing them, which is what makes
  `core/server.test.ts` possible without a real database.
- **Strategy** (`EmbeddingsProvider`): justified now, not speculatively —
  the spec's own Defaults & Assumptions (and `docs/context-extended.md`)
  call out swapping OpenAI for a local embeddings model later. One concrete
  implementation today (`OpenAiEmbeddingsProvider`); per
  `docs/design-patterns.md`'s adoption order, **no Factory yet** — a factory
  with a single product would be exactly the over-engineering
  `quality-checker` flags. Add one only when a second `EmbeddingsProvider`
  implementation actually exists.

## 6. `KnowledgeStoreClient` (in `mcp-server`)

```typescript
// services/mcp-server/src/infrastructure/knowledgeStoreClient.ts
export class KnowledgeStoreClient {
  constructor(private readonly baseUrl: string) {}
  createKnowledgeEntry(input: CreateKnowledgeEntryInput): Promise<{ path: string; title: string }>;
}
```

Thin `fetch` wrapper, one method for now (only `POST /knowledge-entries` is
called from `mcp-server` this iteration — the other endpoints in spec §5.1
are called by `frontend`, not from here).

## 7. Vault path resolution

```typescript
// src/vault/resolveVaultPath.ts
export function resolveVaultPath(): string; // %USERPROFILE%\Documents\alma\vault, Windows-only this iteration
```

One function, one caller (`index.ts`). This is the single place spec §7.6
says to change if the path or the OS target ever changes — no other file
computes or hardcodes this path.

## 8. Slug/collision + summary rules (inside `KnowledgeEntryService`/`VaultRepository`)

- Slugify: lowercase, spaces/punctuation → `-`, matches
  [`naming.md`](../../../../docs/conventions/naming.md)-adjacent kebab-case
  conventions used for filenames elsewhere in the repo.
- Collision (AC2): `VaultRepository.write` is the one place that checks for
  an existing file at a given slug and appends `-2`, `-3`, ... until free —
  `KnowledgeEntryService` doesn't duplicate that check.
- Rollback (AC3): `KnowledgeEntryService.create` calls `vault.write` first;
  if `embeddings.embed` or the `prisma.knowledgeEntry.create` call throws,
  it calls `vault.delete(path)` before rethrowing.
- Summary (AC4): a pure function, `plainTextExcerpt(content, 200)` (strips
  Markdown syntax, truncates) — no LLM/embeddings call involved, matches the
  spec's explicit default.

## 9. Test strategy (Vitest — see §10 for why this is now required here)

| Target | Covers |
|---|---|
| `KnowledgeEntryService.create` (mocked `PrismaClient`, `VaultRepository`, `EmbeddingsProvider`) | AC1 (happy path), AC2 (collision → suffix), AC3 (embeddings failure → file deleted, nothing persisted) |
| `plainTextExcerpt` (pure function) | AC4 (truncation, Markdown stripped) |
| `VaultRepository.write` (mocked `fs`) | AC2's suffix logic in isolation |
| `UserService.create` | 409 on a second `User` (AC1 of `frontend/001-onboarding`, defined here since the rule lives here) |
| `knowledgeEntriesController`/`usersController` | thin — optional light integration test per endpoint (status code mapping), not one test per branch |

`mcp-server`'s new tool file gets no dedicated test (§2) — nothing to unit
test in a pure transport adapter, consistent with `mcp-server`'s existing,
already-documented Vitest gap.

## 10. Constitution/CLAUDE.md update needed

Clause III and `CLAUDE.md`'s Testing section currently name
`services/orchestrator` (and, once it exists, the frontend) as the Vitest-
required workspaces — `services/knowledge-store` didn't exist when that was
written. Given the real business logic living here (§8), Vitest should be
required for `knowledge-store` from its first commit, same reasoning as
orchestrator, not deferred the way `mcp-server` was. **This plan makes that
call** (a mechanical scope addition, not a new business rule) — updating
both docs is task 1 in `tasks.md`.

## 11. Build order (detailed breakdown → `tasks.md`)

1. Update Clause III / `CLAUDE.md` Testing section (§10).
2. `packages/shared` — add `KnowledgeEntrySummary`/`KnowledgeEntryDetail`
   types if `frontend` ends up needing the same shape `knowledge-store`
   returns (confirm when `frontend/003-explorer` is planned — don't add
   speculatively before that's true).
3. `services/knowledge-store` scaffold (`package.json`, `tsconfig.json`,
   Prisma schema + first migration).
4. `vault/` (`resolveVaultPath`, `VaultRepository`) + tests.
5. `services/embeddingsProvider.ts` + tests (mocked HTTP).
6. `services/userService.ts` + `services/knowledgeEntryService.ts` + tests.
7. `api/` controllers + `core/server.ts` composition root + `index.ts`.
8. `services/mcp-server`'s `createKnowledgeEntryTool.ts` +
   `knowledgeStoreClient.ts`.
9. `docker-compose.yml`: add the dev-only `postgres` (pgvector) container.
