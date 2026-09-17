'use client';

import { useState } from 'react';
import { getKnowledgeEntry } from '../../actions/get-knowledge-entry';
import type { KnowledgeEntryDetail, KnowledgeEntrySummary } from '../../lib/knowledge-store-client';
import { NoteEditor } from './NoteEditor';
import { NoteList } from './NoteList';

export function ExplorerPanel({ initialEntries }: { initialEntries: KnowledgeEntrySummary[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<KnowledgeEntryDetail | null>(null);

  async function handleSelect(id: string) {
    setSelectedId(id);
    const entry = await getKnowledgeEntry(id);
    setSelectedEntry(entry);
  }

  return (
    <section className="explorer-panel">
      <div className="explorer-panel__header">
        <h2 className="text-heading">Tu conocimiento</h2>
      </div>
      <div className="explorer-panel__body">
        <NoteList entries={initialEntries} selectedId={selectedId} onSelect={handleSelect} />
        <NoteEditor entry={selectedEntry} />
      </div>
    </section>
  );
}
