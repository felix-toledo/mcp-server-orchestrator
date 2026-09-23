import { listKnowledgeEntries } from '../../../actions/list-knowledge-entries';
import { listVaultFolders } from '../../../actions/list-vault-folders';
import { ExplorerPanel } from '../../../components/explorer/ExplorerPanel';

export default async function ExplorerPage() {
  const [entries, folders] = await Promise.all([listKnowledgeEntries(), listVaultFolders()]);

  return <ExplorerPanel initialEntries={entries} initialFolders={folders} />;
}
