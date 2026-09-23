# Plan — Vault folders + LLM-generated summaries

Base: [`spec.md`](./spec.md). Extends `001-vectorization`'s existing
`knowledge-store` layering — no new layers, same `api/` → `services/` →
`vault/`+`prisma` shape.

## 1. `VaultRepository` changes (`src/vault/vaultRepository.ts`)

```typescript
export class VaultRepository {
  // existing methods gain an optional folderPath, defaulting to root:
  write(folderPath: string | null, slugBase: string, fileContents: string): Promise<{ path: string }>;
  // path returned is now folder-relative, e.g. "proyectos/tfg/mi-nota.md"

  // new:
  ensureFolder(path: string): Promise<void>;    // mkdir -p semantics, AC1
  deleteFolder(path: string): Promise<void>;    // AC7, recursive fs delete
}
```

`ensureFolder` is called by both `KnowledgeEntryService.create` (when
`folderPath` is given, AC5) and the new `VaultFolderService.create` (AC1)
— one place that actually touches `fs.mkdir`.

## 2. `SummaryProvider` (new, `src/services/summaryProvider.ts`)

```typescript
export interface SummaryProvider {
  summarize(content: string): Promise<string>;
}

export class CheapLlmSummaryProvider implements SummaryProvider {
  constructor(private readonly apiKey: string, private readonly model: string) {}
  async summarize(content: string): Promise<string>; // one chat-completion call, short system prompt: "resumí esto en 1-2 frases"
}
```

`knowledge-store/.env` gains `SUMMARY_MODEL` (default a cheap
chat-completion tier, e.g. whatever's cheapest under the same
`OPENAI_API_KEY` already configured — exact model string not pinned here,
same reasoning as `orchestrator/001-reasoning-pipeline`'s small-model
choice: confirm the actual cheapest current tier at implementation time).

```typescript
// new helper, src/services/generateSummary.ts — the AC4 fallback logic,
// used by both KnowledgeEntryService and VaultFolderService so the
// fail-open behavior lives in exactly one place:
export async function generateSummary(
  content: string,
  summaryProvider: SummaryProvider,
  maxLength: number,
): Promise<string> {
  try {
    return await summaryProvider.summarize(content);
  } catch (error) {
    console.warn('⚠️ Resumen con LLM falló, uso truncado de texto plano:', error);
    return plainTextExcerpt(content, maxLength);
  }
}
```

## 3. `VaultFolderService` (new, `src/services/vaultFolderService.ts`)

```typescript
export class VaultFolderService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly vault: VaultRepository,
    private readonly embeddings: EmbeddingsProvider,
    private readonly summaries: SummaryProvider,
    private readonly userService: UserService,
  ) {}

  create(path: string): Promise<VaultFolder>;              // AC1 — ensures every ancestor exists first
  list(): Promise<VaultFolder[]>;                            // AC's §4 GET
  delete(id: string): Promise<void>;                         // AC7 — cascade (Prisma onDelete: Cascade + vault.deleteFolder)

  // AC2 — called by KnowledgeEntryService after any create/update/delete
  // that touches a folder, and by this service's own create/delete:
  recomputeAndPropagate(folderId: string): Promise<void>;
}
```

`recomputeAndPropagate(folderId)`: loads the folder's direct
`KnowledgeEntry`s + direct child `VaultFolder`s, concatenates their
summaries, calls `generateSummary` on that concatenation, `$executeRaw`s
the new embedding (same raw-SQL pattern `KnowledgeEntryService.setEmbedding`
already uses), then — if `parentId` is set — calls itself on the parent
(AC2's upward propagation; bounded by real folder depth, no cycle risk
since `parentId` is a tree).

## 4. `KnowledgeEntryService` changes

- `create`: gains `folderPath?` param (AC5) — resolves/creates the folder
  via `VaultFolderService` first if given, passes its id as `folderId`,
  writes the file via `vault.write(folderPath, ...)`, and — after the
  normal create — calls `vaultFolderService.recomputeAndPropagate(folderId)`
  if a folder was involved.
- `create`/`update`: summary generation switches from
  `plainTextExcerpt(content, 200)` to `generateSummary(content,
  summaryProvider, 200)` (§2) — same call site, different function.
- `delete` (doesn't exist yet — still out of scope for `KnowledgeEntry`
  itself per `001-vectorization` §8; only relevant here because deleting a
  `VaultFolder` cascades to entries inside it, which **is** in scope, via
  Prisma's own cascade, not a new `KnowledgeEntryService.delete` method).

## 5. `mcp-server`

`createKnowledgeEntryTool.ts`'s input schema gains optional `folderPath`
(AC5). New `createVaultFolderTool.ts` (AC6), same thin shape, calling a new
`KnowledgeStoreClient.createVaultFolder(path)` method.

## 6. Design patterns applied

- **Strategy**: `SummaryProvider`, same justification `EmbeddingsProvider`
  already established (a second implementation — local model — is
  plausible future work, matches `docs/context-extended.md`'s own
  embeddings-provider reasoning extended to summaries).
- **Service Layer**: `VaultFolderService` owns all folder business logic
  (creation, cascade, recompute/propagation) — controllers stay thin.

## 7. Test strategy (Vitest)

| Target | Covers |
|---|---|
| `VaultRepository.ensureFolder`/`deleteFolder` (mocked `fs`) | AC1, AC7 |
| `generateSummary` | LLM success path, fallback-on-failure path (AC4) |
| `VaultFolderService.create` | AC1 (ancestor creation), AC3 (placeholder summary) |
| `VaultFolderService.recomputeAndPropagate` | AC2 — one-level aggregation, propagates to parent, stops at root |
| `VaultFolderService.delete` | AC7 — cascade removes entries + vault files |
| `KnowledgeEntryService.create` (extended) | AC5 (folderPath honored), summary now via `generateSummary` |
| `knowledgeEntriesController`/new `vaultFoldersController` | endpoint status codes |
| `mcp-server`: `createVaultFolderTool`, extended `createKnowledgeEntryTool` | mirrors existing tool test pattern |

## 8. Build order (→ `tasks.md`)

1. Prisma schema: `VaultFolder` + `KnowledgeEntry.folderId` + migration.
2. `VaultRepository.ensureFolder`/`deleteFolder` + tests.
3. `SummaryProvider`/`CheapLlmSummaryProvider`/`generateSummary` + tests.
4. `VaultFolderService` (create, list, delete, recomputeAndPropagate) + tests.
5. `KnowledgeEntryService` changes (`folderPath`, `generateSummary` swap) + tests.
6. `vaultFoldersController` + routes + tests.
7. `mcp-server`: `createVaultFolderTool` + `KnowledgeStoreClient.createVaultFolder`
   + extend `createKnowledgeEntryTool`'s schema + tests.
8. Manual end-to-end: create nested folders via chat, confirm they're
   searchable by name/content, confirm a note's real summary (not a
   truncation) shows up in the explorer.
