'use client';

import { useState } from 'react';
import type { Agent } from '../../actions/list-agents';
import { createTeam } from '../../actions/create-team';
import { createVaultFolder } from '../../actions/create-vault-folder';
import { deleteTeam } from '../../actions/delete-team';
import { listTeams, type Team } from '../../actions/list-teams';
import type { VaultFolder } from '../../lib/knowledge-store-client';
import { TeamChatPanel } from './TeamChatPanel';
import { TeamHierarchyPicker } from './TeamHierarchyPicker';

function agentName(agents: Agent[], id: string): string {
  return agents.find((a) => a.id === id)?.name ?? id;
}

function teamItemClassName(isChatOpen: boolean): string {
  const base = 'card agent-list__item team-list__item';
  return isChatOpen ? `${base} team-list__item--chat-open` : base;
}

export function TeamList({
  initialTeams,
  agents,
  vaultFolders: initialVaultFolders,
}: {
  initialTeams: Team[];
  agents: Agent[];
  vaultFolders: VaultFolder[];
}) {
  const [teams, setTeams] = useState(initialTeams);
  const [vaultFolders, setVaultFolders] = useState(initialVaultFolders);
  const [name, setName] = useState('');
  const [memberAgentIds, setMemberAgentIds] = useState<string[]>([]);
  const [coordinatorAgentId, setCoordinatorAgentId] = useState('');
  const [projectFolderIds, setProjectFolderIds] = useState<string[]>([]);
  const [managerByAgentId, setManagerByAgentId] = useState<Record<string, string>>({});
  const [newFolderPath, setNewFolderPath] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openChatTeamId, setOpenChatTeamId] = useState<string | null>(null);

  async function refresh() {
    setTeams(await listTeams());
  }

  function toggleMember(agentId: string) {
    setMemberAgentIds((current) => {
      const next = current.includes(agentId) ? current.filter((id) => id !== agentId) : [...current, agentId];
      // AC1: the coordinator must stay a real member — drop it if it just got unchecked.
      if (!next.includes(coordinatorAgentId)) {
        setCoordinatorAgentId('');
      }
      return next;
    });
    // hierarchy amendment — dropping a member also drops it as someone's
    // manager pick, and its own "reporta a" pick (if any); a stale
    // reference to an agent no longer on the team would otherwise sneak
    // into the submitted hierarchy.
    setManagerByAgentId((current) => {
      const next = { ...current };
      delete next[agentId];
      for (const [reportId, managerId] of Object.entries(next)) {
        if (managerId === agentId) delete next[reportId];
      }
      return next;
    });
  }

  function setManagerFor(agentId: string, managerAgentId: string) {
    setManagerByAgentId((current) => {
      const next = { ...current };
      if (managerAgentId) {
        next[agentId] = managerAgentId;
      } else {
        delete next[agentId];
      }
      return next;
    });
  }

  function toggleProjectFolder(folderId: string) {
    setProjectFolderIds((current) =>
      current.includes(folderId) ? current.filter((id) => id !== folderId) : [...current, folderId],
    );
  }

  async function handleCreateFolder() {
    if (!newFolderPath.trim()) return;
    setIsCreatingFolder(true);
    try {
      const folder = await createVaultFolder(newFolderPath.trim());
      setVaultFolders((current) => [...current, folder]);
      setProjectFolderIds((current) => [...current, folder.id]);
      setNewFolderPath('');
    } finally {
      setIsCreatingFolder(false);
    }
  }

  async function handleCreate() {
    if (!name.trim() || memberAgentIds.length === 0 || !coordinatorAgentId) return;
    setIsCreating(true);
    setError(null);

    // hierarchy amendment — an org chart is entirely opt-in: only sent once
    // at least one non-coordinator member has a "reporta a" pick, so
    // creating a team without touching this section behaves exactly like
    // before (null hierarchy, full mesh).
    const reportEntries = Object.entries(managerByAgentId).filter(
      ([agentId, managerAgentId]) => memberAgentIds.includes(agentId) && memberAgentIds.includes(managerAgentId),
    );
    const hierarchy =
      reportEntries.length > 0
        ? [
            { agentId: coordinatorAgentId, managerAgentId: null },
            ...reportEntries.map(([agentId, managerAgentId]) => ({ agentId, managerAgentId })),
          ]
        : null;

    const result = await createTeam({
      name: name.trim(),
      memberAgentIds,
      coordinatorAgentId,
      projectFolderIds,
      hierarchy,
    });
    setIsCreating(false);
    if (result.ok) {
      setName('');
      setMemberAgentIds([]);
      setCoordinatorAgentId('');
      setProjectFolderIds([]);
      setManagerByAgentId({});
      await refresh();
    } else {
      setError(result.error);
    }
  }

  async function handleDelete(id: string) {
    await deleteTeam(id);
    await refresh();
  }

  return (
    <section className="agent-list">
      <div className="agent-list__header">
        <h2 className="text-heading">Equipos</h2>
        <p className="text-caption">
          Un equipo agrupa agentes que ya configuraste. El coordinador recibe el pedido primero y decide si lo
          resuelve solo o lo reparte entre sus compañeros de equipo.
        </p>
      </div>

      {agents.length === 0 ? (
        <p className="card card--empty">Configurá al menos un agente antes de armar un equipo.</p>
      ) : (
        <div className="card agent-list__form">
          <div className="field">
            <label className="field__label" htmlFor="team-name">
              Nombre
            </label>
            <input id="team-name" className="input" value={name} onChange={(event) => setName(event.target.value)} />
          </div>

          <div className="field">
            <span className="field__label">Miembros</span>
            <div className="team-list__checkboxes">
              {agents.map((agent) => (
                <label key={agent.id} className="team-list__checkbox-item">
                  <input
                    type="checkbox"
                    checked={memberAgentIds.includes(agent.id)}
                    onChange={() => toggleMember(agent.id)}
                  />
                  {agent.name}
                </label>
              ))}
            </div>
          </div>

          <div className="field">
            <label className="field__label" htmlFor="team-coordinator">
              Coordinador
            </label>
            <select
              id="team-coordinator"
              className="input"
              value={coordinatorAgentId}
              onChange={(event) => setCoordinatorAgentId(event.target.value)}
              disabled={memberAgentIds.length === 0}
            >
              <option value="">Elegí un miembro…</option>
              {memberAgentIds.map((id) => (
                <option key={id} value={id}>
                  {agentName(agents, id)}
                </option>
              ))}
            </select>
            <p className="field__hint">Recibe el pedido primero — tiene que ser uno de los miembros de arriba.</p>
          </div>

          <TeamHierarchyPicker
            agents={agents}
            memberAgentIds={memberAgentIds}
            coordinatorAgentId={coordinatorAgentId}
            managerByAgentId={managerByAgentId}
            onChangeManager={setManagerFor}
          />

          <div className="field">
            <span className="field__label">Carpetas (opcional)</span>
            {vaultFolders.length > 0 && (
              <div className="team-list__checkboxes">
                {vaultFolders.map((folder) => (
                  <label key={folder.id} className="team-list__checkbox-item">
                    <input
                      type="checkbox"
                      checked={projectFolderIds.includes(folder.id)}
                      onChange={() => toggleProjectFolder(folder.id)}
                    />
                    {folder.path}
                  </label>
                ))}
              </div>
            )}
            <div className="team-list__new-folder">
              <input
                className="input"
                placeholder="ej: proyectos/marketing"
                value={newFolderPath}
                onChange={(event) => setNewFolderPath(event.target.value)}
              />
              <button
                type="button"
                className="btn btn--secondary"
                onClick={handleCreateFolder}
                disabled={isCreatingFolder || !newFolderPath.trim()}
              >
                {isCreatingFolder ? 'Creando…' : '+ Nueva carpeta'}
              </button>
            </div>
            <p className="field__hint">
              Carpetas de tu bóveda donde el equipo trabaja y de donde saca conocimiento de base.
            </p>
          </div>

          {error && (
            <p role="alert" className="alert alert--danger">
              <span className="alert__icon" aria-hidden="true">
                ⚠
              </span>
              {error}
            </p>
          )}
          <button
            type="button"
            className="btn btn--primary"
            onClick={handleCreate}
            disabled={isCreating || !name.trim() || memberAgentIds.length === 0 || !coordinatorAgentId}
          >
            {isCreating ? 'Creando…' : 'Crear equipo'}
          </button>
        </div>
      )}

      {teams.length === 0 ? (
        <p className="card card--empty">Todavía no configuraste ningún equipo.</p>
      ) : (
        <ul className="agent-list__items">
          {teams.map((team) => (
            <li key={team.id} className={teamItemClassName(openChatTeamId === team.id)}>
              <div className="team-list__item-row">
                <div className="agent-list__item-info">
                  <p className="text-body-strong">{team.name}</p>
                  <p className="text-body-sm">
                    Coordina {agentName(agents, team.coordinatorAgentId)} · {team.memberAgentIds.length} miembro
                    {team.memberAgentIds.length === 1 ? '' : 's'}
                    {team.hierarchy && team.hierarchy.length > 0 ? ' · con organigrama' : ''}
                  </p>
                </div>
                <div className="team-list__item-actions">
                  <button
                    type="button"
                    className="btn btn--secondary"
                    onClick={() => setOpenChatTeamId((current) => (current === team.id ? null : team.id))}
                  >
                    {openChatTeamId === team.id ? 'Ocultar chat' : 'Chatear'}
                  </button>
                  <button type="button" className="btn btn--ghost" onClick={() => handleDelete(team.id)}>
                    Borrar
                  </button>
                </div>
              </div>
              {openChatTeamId === team.id && (
                <TeamChatPanel teamId={team.id} teamName={team.name} onClose={() => setOpenChatTeamId(null)} />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
