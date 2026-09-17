# Plan — Vault explorer & editor

Base: [`spec.md`](./spec.md). Assumes `frontend/001-onboarding`'s scaffold
and `lib/knowledge-store-client.ts` (that spec's plan §3) already exist —
this spec only adds the 3 methods below to that same client, not a second
client.

## 1. Contracts

```typescript
// src/lib/knowledge-store-client.ts — additions
export interface KnowledgeEntrySummary {
  id: string; path: string; title: string; summary: string; updatedAt: string;
}
export interface KnowledgeEntryDetail extends KnowledgeEntrySummary { content: string }

export class KnowledgeStoreClient {
  // ...(createUser/getCurrentUser/createKnowledgeEntry from frontend/001-onboarding)
  listKnowledgeEntries(): Promise<KnowledgeEntrySummary[]>;                  // AC1
  getKnowledgeEntry(id: string): Promise<KnowledgeEntryDetail | null>;       // AC2 — null on 404
  updateKnowledgeEntry(id: string, content: string): Promise<KnowledgeEntrySummary>; // AC3
}
```

```typescript
// src/actions/list-knowledge-entries.ts
export async function listKnowledgeEntries(): Promise<KnowledgeEntrySummary[]>;
// src/actions/get-knowledge-entry.ts
export async function getKnowledgeEntry(id: string): Promise<KnowledgeEntryDetail | null>;
// src/actions/save-knowledge-entry.ts
export async function saveKnowledgeEntry(
  id: string,
  content: string,
): Promise<{ ok: true; entry: KnowledgeEntrySummary } | { ok: false; error: string }>;
// AC4: a thrown error becomes { ok: false, error }, never an unhandled rejection —
// NoteEditor.tsx keeps the unsaved `content` in its own state regardless of the result
```

## 2. Components

- `NoteList.tsx` (Server Component, receives `KnowledgeEntrySummary[]` via
  props from `app/page.tsx`'s initial `listKnowledgeEntries()` call) —
  static list, click navigates/selects (client-side selection state lives
  in a thin wrapper Client Component, not in `NoteList` itself, per
  `docs/conventions/frontend.md`'s "`use client` only on the specific leaf"
  rule).
- `NoteEditor.tsx` (Client Component — needs the textarea's local edit
  state and the Save button's pending/error state, AC4).

## 3. Test strategy (Vitest)

| Target | Covers |
|---|---|
| `KnowledgeStoreClient.listKnowledgeEntries`/`getKnowledgeEntry`/`updateKnowledgeEntry` (mocked `fetch`) | AC1 shape; AC2 — `404` → `null`; AC3 happy path |
| `saveKnowledgeEntry` action (mocked `KnowledgeStoreClient`) | AC4 — a thrown error becomes `{ ok: false, error }` |

No component-render test for `NoteList`/`NoteEditor` this iteration — same
reasoning as the other 2 frontend specs.

## 4. Build order → `tasks.md`

1. `lib/knowledge-store-client.ts` additions (§1) + tests.
2. `actions/list-knowledge-entries.ts` + `get-knowledge-entry.ts` +
   `save-knowledge-entry.ts` + tests.
3. `components/explorer/NoteList.tsx` + `NoteEditor.tsx`.
4. Mount into `app/page.tsx` (alongside `frontend/002-chat`'s panel).
