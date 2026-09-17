import type { KnowledgeEntrySummary } from '../../lib/knowledge-store-client';

export function NoteList({
  entries,
  selectedId,
  onSelect,
}: {
  entries: KnowledgeEntrySummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (entries.length === 0) {
    return <p className="note-list__empty">Todavía no hay notas.</p>;
  }

  return (
    <ul className="note-list">
      {entries.map((entry) => (
        <li key={entry.id}>
          <button
            type="button"
            className={`note-list__item ${entry.id === selectedId ? 'note-list__item--active' : ''}`}
            onClick={() => onSelect(entry.id)}
          >
            <span className="note-list__item-title">{entry.title}</span>
            <span className="note-list__item-summary">{entry.summary}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
