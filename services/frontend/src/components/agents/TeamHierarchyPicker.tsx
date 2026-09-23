import type { Agent } from '../../actions/list-agents';

function agentName(agents: Agent[], id: string): string {
  return agents.find((a) => a.id === id)?.name ?? id;
}

/**
 * hierarchy amendment — opt-in "reporta a" picker shown once a team has a
 * coordinator and at least one other member. Split out of TeamList so that
 * component's own complexity stays under the lint threshold.
 */
export function TeamHierarchyPicker({
  agents,
  memberAgentIds,
  coordinatorAgentId,
  managerByAgentId,
  onChangeManager,
}: {
  agents: Agent[];
  memberAgentIds: string[];
  coordinatorAgentId: string;
  managerByAgentId: Record<string, string>;
  onChangeManager: (agentId: string, managerAgentId: string) => void;
}) {
  if (!coordinatorAgentId || memberAgentIds.length <= 1) {
    return null;
  }

  const reports = memberAgentIds.filter((id) => id !== coordinatorAgentId);

  return (
    <div className="field">
      <span className="field__label">Jerarquía (opcional)</span>
      <div className="team-list__hierarchy">
        {reports.map((agentId) => (
          <div key={agentId} className="team-list__hierarchy-row">
            <span className="text-body-sm">{agentName(agents, agentId)} reporta a</span>
            <select
              className="input"
              value={managerByAgentId[agentId] ?? ''}
              onChange={(event) => onChangeManager(agentId, event.target.value)}
            >
              <option value="">— sin asignar —</option>
              {memberAgentIds
                .filter((id) => id !== agentId)
                .map((id) => (
                  <option key={id} value={id}>
                    {agentName(agents, id)}
                  </option>
                ))}
            </select>
          </div>
        ))}
      </div>
      <p className="field__hint">
        Si no asignás nadie, los agentes del equipo se ven todos entre sí como hoy. Si armás el organigrama, cada uno
        solo va a poder delegarle a su jefe y a quienes le reportan.
      </p>
    </div>
  );
}
