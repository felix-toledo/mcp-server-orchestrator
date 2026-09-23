'use client';

import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown, type MarkdownStorage } from 'tiptap-markdown';
import { useEffect, useState } from 'react';
import { saveKnowledgeEntry } from '../../actions/save-knowledge-entry';
import { joinFrontmatter, splitFrontmatter } from '../../lib/frontmatter';
import type { KnowledgeEntryDetail } from '../../lib/knowledge-store-client';

// tiptap-markdown doesn't module-augment @tiptap/core's Storage type, so
// its own MarkdownStorage export is the only way to type this access.
function getMarkdown(storage: unknown): string {
  return (storage as { markdown: MarkdownStorage }).markdown.getMarkdown();
}

export function NoteEditor({ entry }: { entry: KnowledgeEntryDetail | null }) {
  const [frontmatter, setFrontmatter] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const editor = useEditor({
    extensions: [StarterKit, Markdown],
    content: '',
    immediatelyRender: false,
  });

  useEffect(() => {
    if (!editor) return;
    const { frontmatter: fm, body } = splitFrontmatter(entry?.content ?? '');
    setFrontmatter(fm);
    setError(null);
    editor.commands.setContent(body);
  }, [entry, editor]);

  if (!entry) {
    return <p className="note-editor__empty">Elegí una nota de la lista para verla acá.</p>;
  }

  async function handleSave() {
    if (!entry || !editor) {
      return;
    }
    setIsSaving(true);
    setError(null);
    const body = getMarkdown(editor.storage);
    const content = joinFrontmatter(frontmatter, body);
    const result = await saveKnowledgeEntry(entry.id, content);
    setIsSaving(false);
    if (!result.ok) {
      setError(result.error);
    }
  }

  return (
    <div className="note-editor">
      <h3 className="note-editor__title">{entry.title}</h3>
      <EditorContent editor={editor} className="note-editor__tiptap" />
      {error && (
        <p role="alert" className="alert alert--danger">
          <span className="alert__icon" aria-hidden="true">
            ⚠
          </span>
          {error}
        </p>
      )}
      <div className="note-editor__footer">
        <button type="button" className="btn btn--primary" onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </div>
  );
}
