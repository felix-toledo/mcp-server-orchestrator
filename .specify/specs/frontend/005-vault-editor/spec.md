# Spec — Obsidian-style vault editor (TipTap + folder tree)

| | |
|---|---|
| **Status** | Draft — Open Questions resolved 2026-09-17 (see §8) |
| **Group** | frontend |
| **Amends** | [`frontend/003-explorer`](../003-explorer/spec.md) (replaces its plain textarea and "no nested folders" scope — both were explicit defaults there, not locked rules) |
| **Depends on** | [`knowledge-store/004-vault-folders-and-llm-summaries`](../../knowledge-store/004-vault-folders-and-llm-summaries/spec.md) |
| **Constitution clauses in play** | I, IV |

## 1. Goal

The explorer becomes what Felix asked for directly: **folder tree on the
left, editor on the right, "lindo lindo tipo Obsidian"** — a live-preview
editor (headings/bold/lists render as you type, not raw `##`/`**` syntax)
instead of `003-explorer`'s plain `<textarea>`, using **TipTap**.

**Must follow [`alma-frontend-convention`](../../../../.claude/skills/alma-frontend-convention/skill.md)**
— this is still ALMA's design system, not a generic editor UI bolted on.

## 2. User Story & Acceptance Criteria

**As the user**, I browse folders and notes in a tree on the left, click one
open, and edit it with real formatting visible as I type — and I can create
new folders/notes from the same screen.

- **AC1**: The left column renders a **tree**, not a flat list — root-level
  notes and folders, folders expandable/collapsible, notes nested inside
  their folder shown when expanded. Backed by `GET /knowledge-entries`
  (now each entry may carry a `folderId`) + `GET /vault-folders`
  (`knowledge-store/004` §4), assembled into a tree client-side.
- **AC2**: A "+" affordance creates a new folder (prompts for a name,
  calls `POST /vault-folders`) or a new empty note inside the
  currently-selected folder (or root) — calls `POST /knowledge-entries`
  with `folderPath` set accordingly.
- **AC3**: Clicking a note opens it in the **TipTap** editor pane, content
  loaded as Markdown (`GET /knowledge-entries/:id`, unchanged) and rendered
  live — headings, bold/italic, lists, code blocks render as their visual
  form, not raw Markdown syntax, while the underlying document is still
  serialized back to Markdown on save (`PUT /knowledge-entries/:id`,
  unchanged endpoint contract).
- **AC4**: Save behavior (error handling, keeping unsaved edits on failure)
  is unchanged from `003-explorer` AC3/AC4 — this spec changes the editing
  *experience*, not the save contract.
- **AC5**: Deleting a folder (§4 of `knowledge-store/004`, cascades) is
  available from the tree (a delete affordance per folder node) — the only
  new destructive action this spec adds; deleting a single note is still
  out of scope (unchanged from `003-explorer` AC5).

## 3. Editor implementation notes

- **`@tiptap/react` + `@tiptap/starter-kit`** for the base editor, plus the
  **`tiptap-markdown`** extension specifically so the editor's source of
  truth stays Markdown (parse on load, serialize on save) instead of
  TipTap's native HTML/ProseMirror JSON — the vault's files must stay plain
  `.md` on disk, this is purely an editing-experience layer on top.
- YAML frontmatter (`title`/`createdAt`, `001-vectorization` §5.1) is
  **not** shown/editable in the TipTap pane — stripped before loading into
  the editor, re-attached before `PUT`. The editor edits the note's body,
  not its metadata.

## 4. Folder structure (extends `frontend/003-explorer`'s)

```
services/frontend/src/
├── components/explorer/
│   ├── VaultTree.tsx          # replaces NoteList.tsx — folders + notes, expand/collapse
│   ├── NoteEditor.tsx         # rewritten: TipTap instead of <textarea>
│   └── CreateEntryMenu.tsx    # "+" affordance, AC2
├── actions/
│   ├── create-vault-folder.ts # new
│   └── delete-vault-folder.ts # new
```

## 5. Defaults & Assumptions (mark any correction inline)

1. **No drag-and-drop moving of notes/folders this round** — creation and
   deletion only, matches `knowledge-store/004-vault-folders-and-llm-summaries`
   §7's own "renaming/moving out of scope" note. Flagging since it's a
   natural next ask once the tree exists.
2. **New-folder/new-note naming is a simple prompt, not a fancier inline
   rename UI** — lowest-effort interaction that satisfies AC2, can be
   upgraded later without changing the data contract.

## 6. Out of Scope — Future Work

- Drag-and-drop reorganization (§5.1).
- Renaming a note or folder.
- Backlinks / `[[WikiLinks]]` / a graph view (`docs/context-extended.md`'s
  longer-term vision, not this round).
- Embedding Excalidraw or any diagramming surface.

## 7. Open Questions — resolved 2026-09-17

- **OQ1 — Rich WYSIWYG (TipTap) vs. plain textarea?** → **TipTap**,
  confirmed directly by Felix, superseding `003-explorer`'s original "no
  rich editor" default.
- **OQ2 — Folders in the UI at all?** → **Yes**, tree view, confirmed.
