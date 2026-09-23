# Tasks — Obsidian-style vault editor (TipTap + folder tree)

Base: [`plan.md`](./plan.md) §6. Depends on
`knowledge-store/004-vault-folders-and-llm-summaries` being implemented
first.

- [x] **T1 — `lib/build-vault-tree.ts` + `lib/frontmatter.ts`**: tests.
- [x] **T2 — `knowledge-store-client.ts` + folder actions**:
  `create-vault-folder.ts`, `delete-vault-folder.ts`, `list-vault-folders.ts`
  (not originally named in the plan, needed to fetch the tree). Also added
  `create-knowledge-entry.ts` — the plan assumed one existed for "new note";
  it didn't (the frontend never created notes directly before this, only
  chat did via the MCP tool). Tests.
- [x] **T3 — `VaultTree.tsx`**: recursive tree, expand/collapse, multi-level
  nesting verified live.
- [x] **T4 — `CreateEntryMenu.tsx`**: new folder / new note (AC2), verified
  live end to end (created a nested folder, then a note inside it).
- [x] **T5 — `NoteEditor.tsx` → TipTap**: `@tiptap/react` +
  `@tiptap/starter-kit` + `tiptap-markdown`, frontmatter split/join (AC3).
  Verified live: typed `**negrita**`-equivalent formatting into the editor,
  it rendered as real bold text, not raw Markdown syntax; saved and
  persisted correctly.
- [x] **T6 — Delete-folder affordance**: wired to T2's action (AC5).
- [x] **T7 — Design-system styling for TipTap output**: `globals.css`
  additions per plan §2 (`.note-editor__tiptap .tiptap` rules mapping every
  ProseMirror output element to the design system's type scale).
- [ ] **T8 — E2E**: not done as a committed Playwright spec — substituted
  with manual verification (screenshots + a live interaction script) this
  round, same gap as `frontend/004-chat-shell` T8.

**Real bug found and fixed during manual verification**: `createKnowledgeEntry`
(new action, T2) originally seeded a brand-new note's body with a copy of
its own title (`content: title`), since `knowledge-store`'s API requires
non-empty content. Opening a freshly created note showed the title twice —
once as the heading above the editor, once run directly into the first
line of the body with no separation (`"Nota de prueba UIEsto es..."` once
the user started typing at the cursor). Fixed: seed with a single space
instead of the title.

## Amendment (2026-09-18) — dedicated "Proyectos" view

Felix's ask: "quiero poder generar y hacer nuevos proyectos, poner
documentos sobre estos, etc... incluso dentro de equipos quiero poder
ponerles proyectos a cargo se entinede? que sea mas lindo esto." Confirmed
during clarification (same round as `orchestrator/003-teams`'s team-chat
amendment): a "proyecto" is not a new domain entity — it's the exact same
`VaultFolder` this spec's Explorer already manages, and its "documentos"
are markdown notes (`KnowledgeEntry`), not file uploads (deliberately
avoids reopening the multimodal question deferred earlier).

- **`ProjectsPanel.tsx`** (new, `components/projects/`) — a friendlier,
  card-based view of the same `VaultFolder`/`KnowledgeEntry` data the
  Explorer's tree already renders, reusing every existing action
  (`createVaultFolder`, `createKnowledgeEntry`, `getKnowledgeEntry`,
  `deleteVaultFolder`, `NoteEditor`) rather than duplicating note-editing
  machinery. Three columns: project cards (path + auto-maintained
  `summary` + which `Team`s have it in their `projectFolderIds`) → that
  project's notes (`entries.filter(e => e.folderId === selectedFolderId)`)
  → `NoteEditor`.
  - "que sea mas lindo esto" is addressed by surfacing each project's
    assigned team(s) directly on its card — the same `Team.projectFolderIds`
    data `TeamList.tsx`'s own folder checkboxes already read, just shown
    from the project's side instead of only the team's side. No new
    picker UI on the Teams tab itself this round (would risk scope creep
    for a "nice to have" with no explicit ask beyond the checkbox list
    already being functional).
  - New route `/projects`, new `AppNav` entry, right after "Chat".
- **Verified live**: created a real project folder + a note inside it
  through the underlying knowledge-store API (mirroring exactly what the
  new actions call), confirmed the note's `folderId` matched the project's
  id (proving `ProjectsPanel`'s client-side filter is correct), then
  deleted the test folder and confirmed the cascade removed the note too.
  No production data touched.
