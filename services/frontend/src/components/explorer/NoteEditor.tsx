'use client';

import { useEffect, useState } from 'react';
import { saveKnowledgeEntry } from '../../actions/save-knowledge-entry';
import type { KnowledgeEntryDetail } from '../../lib/knowledge-store-client';

export function NoteEditor({ entry }: { entry: KnowledgeEntryDetail | null }) {
  const [content, setContent] = useState(entry?.content ?? '');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setContent(entry?.content ?? '');
    setError(null);
  }, [entry]);

  if (!entry) {
    return <p className="note-editor__empty">Elegí una nota de la lista para verla acá.</p>;
  }

  async function handleSave() {
    if (!entry) {
      return;
    }
    setIsSaving(true);
    setError(null);
    const result = await saveKnowledgeEntry(entry.id, content);
    setIsSaving(false);
    if (!result.ok) {
      setError(result.error);
    }
  }

  return (
    <div className="note-editor">
      <h3 className="note-editor__title">{entry.title}</h3>
      <textarea
        className="textarea note-editor__body"
        value={content}
        onChange={(event) => setContent(event.target.value)}
        rows={20}
      />
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
