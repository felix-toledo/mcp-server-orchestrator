# Plan — Obsidian-style vault editor (TipTap + folder tree)

Base: [`spec.md`](./spec.md). Follows
[`docs/conventions/frontend.md`](../../../../docs/conventions/frontend.md)
and **must** apply [`alma-frontend-convention`](../../../../.claude/skills/alma-frontend-convention/skill.md)
tokens throughout.

## 1. `VaultTree.tsx`

```typescript
interface TreeNode {
  type: 'folder' | 'note';
  id: string;
  name: string;              // folder: last path segment; note: title
  children?: TreeNode[];     // folders only
}

function buildTree(folders: VaultFolder[], entries: KnowledgeEntrySummary[]): TreeNode[];
```

Pure function, own file (`lib/build-vault-tree.ts`) so it's unit-testable
without rendering anything — `VaultTree.tsx` (Client Component, expand/
collapse state) just calls it and renders.

## 2. `NoteEditor.tsx` — TipTap

```typescript
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';

const editor = useEditor({
  extensions: [StarterKit, Markdown],
  content: bodyWithoutFrontmatter, // parsed as markdown on init (AC3)
});

// on save: editor.storage.markdown.getMarkdown() → re-attach frontmatter → PUT
```

Frontmatter strip/reattach: a small pure helper,
`lib/frontmatter.ts` — `splitFrontmatter(raw): { frontmatter: string; body:
string }` and `joinFrontmatter(frontmatter, body): string` — used by
`NoteEditor` on load and save respectively (spec §3).

Styling: TipTap's default output is unstyled HTML elements
(`h1`–`h3`, `p`, `ul`/`ol`, `blockquote`, `code`) — this spec's own CSS
(`.note-editor__tiptap` in `globals.css`) maps each to the design system's
type scale (`text-heading` for `h1`-ish weight, `text-body` for `p`, `mono-sm`
for inline `code`, per `alma-frontend-convention`) rather than accepting
TipTap/`StarterKit`'s default browser styling.

## 3. `CreateEntryMenu.tsx` + actions

```typescript
// actions/create-vault-folder.ts
export async function createVaultFolder(path: string): Promise<VaultFolder>; // POST /vault-folders

// actions/delete-vault-folder.ts
export async function deleteVaultFolder(id: string): Promise<{ ok: boolean }>; // DELETE /vault-folders/:id
```

`CreateEntryMenu`: two actions ("nueva carpeta," "nueva nota"), each a
simple `prompt()`-free inline text input (not a browser `prompt()` — matches
the design system's `.input` component instead of a native dialog),
submitting to `createVaultFolder` or the existing
`actions/save-knowledge-entry.ts`-adjacent create path (extended with
`folderPath`, mirrors `knowledge-store/004`'s `POST /knowledge-entries`
change).

## 4. Design patterns applied

- No new pattern beyond what `docs/conventions/frontend.md` already
  prescribes — `buildTree`/`splitFrontmatter`/`joinFrontmatter` are pure
  functions in `lib/`, exactly the "framework-agnostic helper" shape that
  directory already holds.

## 5. Test strategy (Vitest — `lib/`/`actions/` only, no component-render
tests per this repo's frontend testing convention)

| Target | Covers |
|---|---|
| `lib/build-vault-tree.ts` | nested folders, notes at multiple depths, empty vault |
| `lib/frontmatter.ts` | split/join round-trip, note with no frontmatter |
| `actions/create-vault-folder.ts`, `delete-vault-folder.ts` | mocked client |

`e2e/` (Playwright) gains a spec for: create folder → create note inside it
→ edit with visible formatting → save → reload → content persisted; delete
the folder → note gone too.

## 6. Build order (→ `tasks.md`)

1. `lib/build-vault-tree.ts` + `lib/frontmatter.ts` + tests.
2. `knowledge-store-client.ts` gains `vault-folders` methods + actions
   (`create-vault-folder.ts`, `delete-vault-folder.ts`).
3. `VaultTree.tsx` (read-only tree first, no create/delete yet).
4. `CreateEntryMenu.tsx` wired to the create actions (AC2).
5. `NoteEditor.tsx` rewritten with TipTap + frontmatter split/join (AC3).
6. Delete-folder affordance in the tree (AC5).
7. `globals.css` TipTap output styling per the design system (plan §2).
8. E2E spec (plan §5).
