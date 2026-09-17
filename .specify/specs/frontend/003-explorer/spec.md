# Spec — Vault explorer & editor

| | |
|---|---|
| **Status** | Draft — Open Questions resolved 2026-09-18 (see README), no longer blocked on Clause I |
| **Group** | frontend |
| **Depends on** | [`knowledge-store/001-vectorization`](../../knowledge-store/001-vectorization/spec.md) — needs `GET /knowledge-entries`, `GET /knowledge-entries/:id`, `PUT /knowledge-entries/:id` |
| **Open Questions** | Resolved — see [`.specify/specs/README.md`](../../README.md#open-questions-blocking-all-4-specs-resolve-before-any-advances-to-plan) for the log |
| **Constitution clauses in play** | I, IV |

## 1. Goal

The user can see every note ALMA (or they, directly) has written, open one,
edit it, and save — without leaving the frontend.

## 2. User Story & Acceptance Criteria

As the user, I browse my vault and edit a note directly, next to the chat.

- **AC1**: Given at least one `KnowledgeEntry` exists, the explorer panel
  lists notes (`title`, `updatedAt`) ordered by most-recently-updated
  first, fetched from `knowledge-store`'s `GET /knowledge-entries`.
- **AC2**: Given I click a note, the editor opens with its raw Markdown
  content (`GET /knowledge-entries/:id`, which reads the live file — not a
  cached copy).
- **AC3**: Given I edit the content and click Save, `PUT
  /knowledge-entries/:id` overwrites the file, regenerates `summary` and
  `embedding`, and bumps `updatedAt`.
- **AC4**: Given the save request fails (network error, `knowledge-store`
  down), the editor shows an error and keeps my unsaved edit in place — it
  does not discard it.
- **AC5**: Renaming a note (changing its `title`/file path) and deleting a
  note are **not** available this iteration — see Out of Scope.

## 3. Folder structure (new files under `services/frontend`)

```
services/frontend/src/
├── app/page.tsx                    # main view: chat (see frontend/002-chat) + explorer
├── actions/
│   ├── list-knowledge-entries.ts
│   ├── get-knowledge-entry.ts
│   └── save-knowledge-entry.ts
├── components/explorer/
│   ├── NoteList.tsx
│   └── NoteEditor.tsx
└── lib/
    └── knowledge-store-client.ts   # shared with frontend/001-onboarding
```

## 4. Defaults & Assumptions (mark any correction inline)

1. **Plain textarea editor, no live Markdown preview, no rich editor
   library.** Matches "no hace falta nada más sofisticado" from the
   original request.
2. **Embedding regenerates on every save**, even if the content is
   unchanged — simplest correct behavior for this scope, no dirty-check
   optimization.

## 5. Out of Scope — Future Work

- Renaming/deleting a `KnowledgeEntry`.
- Rich Markdown editor / live preview.
- Nested folders, backlinks, or a knowledge graph view.
