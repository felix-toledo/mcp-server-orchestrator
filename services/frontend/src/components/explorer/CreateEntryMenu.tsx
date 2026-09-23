'use client';

import { useState } from 'react';

type PendingKind = 'folder' | 'note' | null;

export function CreateEntryMenu({
  currentFolderPath,
  onCreateFolder,
  onCreateNote,
}: {
  currentFolderPath: string | null;
  onCreateFolder: (path: string) => Promise<void>;
  onCreateNote: (title: string) => Promise<void>;
}) {
  const [pending, setPending] = useState<PendingKind>(null);
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    const value = name.trim();
    if (!value || isSubmitting) {
      return;
    }
    setIsSubmitting(true);
    if (pending === 'folder') {
      const path = currentFolderPath ? `${currentFolderPath}/${value}` : value;
      await onCreateFolder(path);
    } else if (pending === 'note') {
      await onCreateNote(value);
    }
    setIsSubmitting(false);
    setPending(null);
    setName('');
  }

  if (pending) {
    return (
      <div className="create-entry-menu create-entry-menu--active">
        <input
          className="input"
          autoFocus
          value={name}
          placeholder={pending === 'folder' ? 'nombre de la carpeta' : 'título de la nota'}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') handleSubmit();
            if (event.key === 'Escape') {
              setPending(null);
              setName('');
            }
          }}
        />
        <button type="button" className="btn btn--primary" disabled={isSubmitting} onClick={handleSubmit}>
          Crear
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => setPending(null)}>
          Cancelar
        </button>
      </div>
    );
  }

  return (
    <div className="create-entry-menu">
      <button type="button" className="btn btn--secondary" onClick={() => setPending('folder')}>
        + Carpeta
      </button>
      <button type="button" className="btn btn--secondary" onClick={() => setPending('note')}>
        + Nota
      </button>
    </div>
  );
}
