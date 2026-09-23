import { listKnowledgeEntries } from '../../../actions/list-knowledge-entries';
import { listTeams } from '../../../actions/list-teams';
import { listVaultFolders } from '../../../actions/list-vault-folders';
import { ProjectsPanel } from '../../../components/projects/ProjectsPanel';

export default async function ProjectsPage() {
  const [folders, entries, teams] = await Promise.all([listVaultFolders(), listKnowledgeEntries(), listTeams()]);

  return <ProjectsPanel initialFolders={folders} initialEntries={entries} teams={teams} />;
}
