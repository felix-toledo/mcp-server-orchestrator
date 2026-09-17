# Tasks — Vault explorer & editor

Base: [`plan.md`](./plan.md) §4. Assumes `frontend/001-onboarding` T1–T2
(scaffold + base `KnowledgeStoreClient`) are done.

- [x] **T1 — `lib/knowledge-store-client.ts` additions**: done — built into
  the same client file as `frontend/001-onboarding`'s T2 from the start
  (one client, all 6 methods) rather than added as a separate pass; covered
  by the same `knowledge-store-client.test.ts` (8 tests total).
- [x] **T2 — Server Actions**: done — `list-knowledge-entries.ts`,
  `get-knowledge-entry.ts`, `save-knowledge-entry.ts`, 2 tests on the latter
  (AC3/AC4).
- [x] **T3 — `NoteList.tsx` + `NoteEditor.tsx`**: done. `NoteEditor` resets
  its local `content` state via `useEffect` when a different `entry` is
  selected (AC4 — an in-progress unsaved edit is only ever lost by
  deliberately picking a different note, never by a failed save).
- [x] **T4 — Mounted into `app/page.tsx`**: done, via an `ExplorerPanel.tsx`
  wrapper (not in the original plan) that owns the selected-note state
  `NoteList`/`NoteEditor` both need — kept `NoteList` itself a plain
  presentational component per `docs/conventions/frontend.md`'s "`use
  client` only on the specific leaf" rule.

**Verified**: `pnpm run build`/`lint`/`test` pass. Not yet exercised against
a live `knowledge-store` — same blocker noted in the other 3 specs' tasks.
