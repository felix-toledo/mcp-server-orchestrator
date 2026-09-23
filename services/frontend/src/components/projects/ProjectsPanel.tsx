'use client';

import { useMemo, useState } from 'react';
import { createKnowledgeEntry } from '../../actions/create-knowledge-entry';
import { createVaultFolder } from '../../actions/create-vault-folder';
import { deleteVaultFolder } from '../../actions/delete-vault-folder';
import { getKnowledgeEntry } from '../../actions/get-knowledge-entry';
import { listKnowledgeEntries } from '../../actions/list-knowledge-entries';
import { listVaultFolders } from '../../actions/list-vault-folders';
import type { Team } from '../../actions/list-teams';
import type { KnowledgeEntryDetail, KnowledgeEntrySummary, VaultFolder } from '../../lib/knowledge-store-client';
import { NoteEditor } from '../explorer/NoteEditor';

/**
 * "Proyectos" (Felix's ask) is a friendlier, project-centric view of the
 * same `VaultFolder` entity the Explorer and the Teams tab's own folder
 * picker already use — not a new domain concept. Reuses every existing
 * action (`createKnowledgeEntry`, `NoteEditor`, ...) rather than
 * duplicating the Explorer's note-editing machinery.
 */
export function ProjectsPanel({
  initialFolders,
  initialEntries,
  teams,
}: {
  initialFolders: VaultFolder[];
  initialEntries: KnowledgeEntrySummary[];
  teams: Team[];
}) {
  const [folders, setFolders] = useState(initialFolders);
  const [entries, setEntries] = useState(initialEntries);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<KnowledgeEntryDetail | null>(null);
  const [newProjectPath, setNewProjectPath] = useState('');
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [isCreatingNote, setIsCreatingNote] = useState(false);

  const selectedFolder = folders.find((f) => f.id === selectedFolderId) ?? null;
  const notesForSelected = useMemo(
    () => entries.filter((e) => e.folderId === selectedFolderId),
    [entries, selectedFolderId],
  );

  function teamsFor(folderId: string): Team[] {
    return teams.filter((t) => t.projectFolderIds.includes(folderId));
  }

  async function refresh() {
    const [nextFolders, nextEntries] = await Promise.all([listVaultFolders(), listKnowledgeEntries()]);
    setFolders(nextFolders);
    setEntries(nextEntries);
  }

  async function handleCreateProject() {
    const path = newProjectPath.trim();
    if (!path || isCreatingProject) return;
    setIsCreatingProject(true);
    const folder = await createVaultFolder(path);
    setNewProjectPath('');
    setIsCreatingProject(false);
    await refresh();
    setSelectedFolderId(folder.id);
  }

  async function handleDeleteProject(id: string) {
    await deleteVaultFolder(id);
    if (id === selectedFolderId) {
      setSelectedFolderId(null);
      setSelectedEntryId(null);
      setSelectedEntry(null);
    }
    await refresh();
  }

  async function handleSelectEntry(id: string) {
    setSelectedEntryId(id);
    setSelectedEntry(await getKnowledgeEntry(id));
  }

  async function handleCreateNote() {
    const title = newNoteTitle.trim();
    if (!title || !selectedFolder || isCreatingNote) return;
    setIsCreatingNote(true);
    const result = await createKnowledgeEntry(title, selectedFolder.path);
    setNewNoteTitle('');
    setIsCreatingNote(false);
    await refresh();
    if (result.ok) {
      await handleSelectEntry(result.entry.id);
    }
  }

  return (
    <section className="projects-panel">
      <div className="projects-panel__header">
        <h2 className="text-heading">Proyectos</h2>
        <p className="text-caption">
          Cada proyecto es una carpeta de tu bóveda — guardá notas ahí y asignáselo a un equipo desde la pestaña de
          Equipos.
        </p>
      </div>
      <div className="projects-panel__body">
        <div className="projects-panel__column">
          <div className="projects-panel__new-project">
            <input
              className="input"
              placeholder="ej: marketing/campañas"
              value={newProjectPath}
              onChange={(event) => setNewProjectPath(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && handleCreateProject()}
            />
            <button
              type="button"
              className="btn btn--primary"
              onClick={handleCreateProject}
              disabled={isCreatingProject || !newProjectPath.trim()}
            >
              {isCreatingProject ? '…' : '+ Proyecto'}
            </button>
          </div>

          {folders.length === 0 ? (
            <p className="card card--empty">Todavía no creaste ningún proyecto.</p>
          ) : (
            <ul className="projects-panel__list">
              {folders.map((folder) => {
                const assignedTeams = teamsFor(folder.id);
                return (
                  <li key={folder.id} className="project-card-wrap">
                    <button
                      type="button"
                      className={`project-card ${selectedFolderId === folder.id ? 'project-card--active' : ''}`}
                      onClick={() => setSelectedFolderId(folder.id)}
                    >
                      <span className="text-body-strong">{folder.path}</span>
                      <span className="project-card__summary">{folder.summary}</span>
                      <span className="project-card__teams">
                        {assignedTeams.length > 0
                          ? `Equipo: ${assignedTeams.map((t) => t.name).join(', ')}`
                          : 'Sin equipo asignado'}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost project-card__delete"
                      onClick={() => handleDeleteProject(folder.id)}
                    >
                      Borrar
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="projects-panel__column">
          {!selectedFolder ? (
            <p className="card card--empty">Elegí un proyecto para ver sus notas.</p>
          ) : (
            <>
              <div className="projects-panel__new-note">
                <input
                  className="input"
                  placeholder="título de la nota"
                  value={newNoteTitle}
                  onChange={(event) => setNewNoteTitle(event.target.value)}
                  onKeyDown={(event) => event.key === 'Enter' && handleCreateNote()}
                />
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={handleCreateNote}
                  disabled={isCreatingNote || !newNoteTitle.trim()}
                >
                  {isCreatingNote ? '…' : '+ Nota'}
                </button>
              </div>

              {notesForSelected.length === 0 ? (
                <p className="vault-tree__empty">Este proyecto todavía no tiene notas.</p>
              ) : (
                <ul className="vault-tree">
                  {notesForSelected.map((entry) => (
                    <li key={entry.id}>
                      <button
                        type="button"
                        className={`vault-tree__item ${selectedEntryId === entry.id ? 'vault-tree__item--active' : ''}`}
                        onClick={() => handleSelectEntry(entry.id)}
                      >
                        {entry.title}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        <NoteEditor entry={selectedEntry} />
      </div>
    </section>
  );
}
