import { listAgents } from '../../../actions/list-agents';
import { listSkills } from '../../../actions/list-skills';
import { listTeams } from '../../../actions/list-teams';
import { listVaultFolders } from '../../../actions/list-vault-folders';
import { AgentsSkillsTeamsPanel } from '../../../components/agents/AgentsSkillsTeamsPanel';

export default async function AgentsPage() {
  const [agents, skills, teams, vaultFolders] = await Promise.all([
    listAgents(),
    listSkills(),
    listTeams(),
    listVaultFolders(),
  ]);
  return <AgentsSkillsTeamsPanel agents={agents} skills={skills} teams={teams} vaultFolders={vaultFolders} />;
}
