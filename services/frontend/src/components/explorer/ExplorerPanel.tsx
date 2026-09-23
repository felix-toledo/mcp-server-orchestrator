'use client';

import { useState } from 'react';
import { createKnowledgeEntry } from '../../actions/create-knowledge-entry';
import { createVaultFolder } from '../../actions/create-vault-folder';
import { deleteVaultFolder } from '../../actions/delete-vault-folder';
import { getKnowledgeEntry } from '../../actions/get-knowledge-entry';
import { listKnowledgeEntries } from '../../actions/list-knowledge-entries';
import { listVaultFolders } from '../../actions/list-vault-folders';
import { buildVaultTree } from '../../lib/build-vault-tree';
import type { KnowledgeEntryDetail, KnowledgeEntrySummary, VaultFolder } from '../../lib/knowledge-store-client';
import { CreateEntryMenu } from './CreateEntryMenu';
import { NoteEditor } from './NoteEditor';
import { VaultTree } from './VaultTree';

export function ExplorerPanel({
  initialEntries,
  initialFolders,
}: {
  initialEntries: KnowledgeEntrySummary[];
  initialFolders: VaultFolder[];
}) {
  const [entries, setEntries] = useState(initialEntries);
  const [folders, setFolders] = useState(initialFolders);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<KnowledgeEntryDetail | null>(null);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);

  const tree = buildVaultTree(folders, entries);
  const currentFolderPath = folders.find((f) => f.id === currentFolderId)?.path ?? null;

  async function refresh() {
    const [nextEntries, nextFolders] = await Promise.all([listKnowledgeEntries(), listVaultFolders()]);
    setEntries(nextEntries);
    setFolders(nextFolders);
  }

  async function handleSelectEntry(id: string) {
    setSelectedEntryId(id);
    const entry = await getKnowledgeEntry(id);
    setSelectedEntry(entry);
  }

  async function handleCreateFolder(path: string) {
    await createVaultFolder(path);
    await refresh();
  }

  async function handleCreateNote(title: string) {
    const result = await createKnowledgeEntry(title, currentFolderPath ?? undefined);
    await refresh();
    if (result.ok) {
      await handleSelectEntry(result.entry.id);
    }
  }

  async function handleDeleteFolder(id: string) {
    await deleteVaultFolder(id);
    if (id === currentFolderId) {
      setCurrentFolderId(null);
    }
    await refresh();
  }

  return (
    <section className="explorer-panel">
      <div className="explorer-panel__header">
        <h2 className="text-heading">Tu conocimiento</h2>
      </div>
      <div className="explorer-panel__body">
        <div className="explorer-panel__tree-column">
          <CreateEntryMenu
            currentFolderPath={currentFolderPath}
            onCreateFolder={handleCreateFolder}
            onCreateNote={handleCreateNote}
          />
          <VaultTree
            tree={tree}
            selectedEntryId={selectedEntryId}
            currentFolderId={currentFolderId}
            onSelectEntry={handleSelectEntry}
            onSelectFolder={(id) => setCurrentFolderId(id)}
            onDeleteFolder={handleDeleteFolder}
          />
        </div>
        <NoteEditor entry={selectedEntry} />
      </div>
    </section>
  );
}
