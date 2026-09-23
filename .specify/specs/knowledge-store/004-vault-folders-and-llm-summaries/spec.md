# Spec — Vault folders + LLM-generated summaries

| | |
|---|---|
| **Status** | Draft — Open Questions resolved 2026-09-17 (see §8) |
| **Group** | backend (`services/knowledge-store`, `services/mcp-server`) |
| **Amends** | [`knowledge-store/001-vectorization`](../001-vectorization/spec.md) AC4 (summary generation) and §8 ("nested folders... out of scope"), [`frontend/003-explorer`](../../frontend/003-explorer/spec.md) §5 ("nested folders... out of scope") |
| **Depended on by** | [`frontend/005-vault-editor`](../../frontend/005-vault-editor/spec.md) |
| **Constitution clauses in play** | I, III (Vitest), IV, V (dormant) |

## 1. Goal

Two changes Felix asked for after using the app a bit: (1) the vault stops
being flat — folders, and a folder itself is a first-class searchable thing,
not just a path prefix; (2) a note's `summary` (used both for display and
as the text that gets embedded) stops being a blind truncation and starts
being a real, model-generated summary — cheap model, but a real one.

## 2. User Story & Acceptance Criteria

**As the user**, when I create a folder, it's part of ALMA's searchable
memory from that moment, same as a note; every note I save gets a real
summary, not a chopped-off first 200 characters.

- **AC1**: A new `VaultFolder` (`{ id, path, summary, embedding }`) is
  created whenever a folder is created — explicitly (a dedicated
  create-folder action) or implicitly (creating a note inside a path that
  doesn't exist yet creates every missing ancestor folder first, `mkdir -p`
  semantics).
- **AC2**: A `VaultFolder`'s `summary`/`embedding` are **recomputed every
  time a file directly inside it (or inside any of its descendant folders)
  changes** — create, edit, or delete — by aggregating the summaries of
  what's directly inside it (its own files' summaries + its direct
  subfolders' own summaries, one level, not a full-text re-read of every
  descendant). The recompute **propagates up the parent chain to the
  root** — saving a deeply nested file updates that file's folder, then
  that folder's parent, and so on, so `002-retrieval`/`001-reasoning-pipeline`'s
  search can surface a folder as relevant even when the match is a few
  levels down inside it.
- **AC3**: An empty, newly created folder gets a placeholder summary (its
  own name/path) so it's still findable by name before it has any content
  — not an empty string, not skipped.
- **AC4**: **`summary` generation (both `KnowledgeEntry` and
  `VaultFolder`) now goes through a cheap LLM call first** — replaces
  `001-vectorization` AC4's plain-text truncation as the primary path.
  **If that call fails, fall back to the existing plain-text truncation**
  (`plainTextExcerpt`) rather than failing the save — same fail-open
  philosophy as every other external call in this codebase (`002-retrieval`
  AC7, `knowledge-store/003-chat-sessions` AC8).
- **AC5**: `createKnowledgeEntry` (MCP tool + endpoint) gains an optional
  `folderPath` (e.g. `"proyectos/tfg"`) — when given, the file is written
  inside that folder (creating it and any missing ancestors first, AC1),
  instead of always at the vault root.
- **AC6**: A new MCP tool, `createVaultFolder({ path })`, lets the LLM (or
  the frontend, AC7) create an empty folder directly, without a file.
- **AC7**: Deleting a `VaultFolder` (new endpoint, called from the frontend
  — chat has no delete capability for anything, consistent with the rest
  of this codebase) cascades: every `KnowledgeEntry` and descendant
  `VaultFolder` inside it is deleted too, and their vault files are removed
  from disk — matches how a real filesystem folder delete behaves. Confirmed
  as this spec's own default (§7.1), not explicitly asked.

## 3. Data model

```prisma
model VaultFolder {
  id        String        @id @default(cuid())
  userId    String
  user      User          @relation(fields: [userId], references: [id])
  path      String        // e.g. "proyectos/tfg", unique per user
  parentId  String?
  parent    VaultFolder?  @relation("FolderChildren", fields: [parentId], references: [id])
  children  VaultFolder[] @relation("FolderChildren")
  summary   String
  embedding Unsupported("vector(1536)")?
  createdAt DateTime      @default(now())
  updatedAt DateTime      @updatedAt

  entries   KnowledgeEntry[]
}

// KnowledgeEntry gains:
//   folderId String?
//   folder   VaultFolder? @relation(fields: [folderId], references: [id])
// null folderId = vault root, unchanged from today's flat behavior.
```

## 4. New/changed endpoints

| Method & path | Body | Returns | Notes |
|---|---|---|---|
| `POST /vault-folders` | `{ path }` | `201 VaultFolder` | AC1, idempotent-ish: creates missing ancestors too |
| `GET /vault-folders` | — | `200 VaultFolder[]` (flat, with `parentId`) | for the frontend to build a tree client-side |
| `DELETE /vault-folders/:id` | — | `204` | AC7, cascades |
| `POST /knowledge-entries` | gains `folderPath?` | unchanged shape | AC5 |

## 5. `mcp-server` — new/changed tools

- `createVaultFolder` (new, AC6).
- `createKnowledgeEntry` — input schema gains optional `folderPath` (AC5),
  same tool, no new tool needed.

## 6. Defaults & Assumptions (mark any correction inline)

1. **Folder deletion cascades** (AC7) — not explicitly confirmed, flagged.
2. **Summary model: knowledge-store gets its own small chat-completion
   client, not a shared one with `orchestrator`'s SkillRouter/compressor.**
   The interview's recommendation assumed reusing "the same small/fast
   model infra already specced" — on reflection while writing this spec,
   that infra (`SMALL_LLM_PROVIDER`, `ILlmProvider` Strategy) lives in
   `services/orchestrator`, a different service `knowledge-store` has no
   reason to depend on (it would mean `knowledge-store` calling
   `orchestrator`, backwards from every dependency arrow in this codebase
   so far). Instead: a new, small `SummaryProvider` client in
   `knowledge-store` itself, same shape as `EmbeddingsProvider` (a plain
   `fetch` wrapper, not the full `ILlmProvider` abstraction) — reusing
   `OPENAI_API_KEY` (already configured there for embeddings) against a
   cheap chat-completion tier, same reasoning `001-vectorization` §7.1 used
   for picking the embeddings provider. **Flagging this correction
   explicitly** since it changes what was recommended in the interview.
3. **One-level aggregation for folder summaries (AC2)** — a folder's
   summary reflects its direct children only; going up the parent chain is
   what makes a deep match visible at the root, not each folder re-reading
   its entire subtree's raw text.

## 7. Out of Scope — Future Work

- Renaming/moving a folder or a note into a different folder.
- Drag-and-drop reorganization in the UI (that's `frontend/005-vault-editor`'s
  concern if it comes up there — not assumed free here).
- A configurable recursion depth/aggregation strategy — one level, fixed.

## 8. Open Questions — resolved 2026-09-17

- **OQ1 — Does a folder get its own embedding, or is it purely a path
  prefix?** → **Its own embedding** (AC1/AC2), confirmed.
- **OQ2 — Does the LLM summary replace truncation entirely or fall back to
  it?** → **Falls back to it on failure** (AC4), confirmed.
