import { redirect } from 'next/navigation';
import { listKnowledgeEntries } from '../actions/list-knowledge-entries';
import { ChatPanel } from '../components/chat/ChatPanel';
import { ExplorerPanel } from '../components/explorer/ExplorerPanel';
import { knowledgeStoreClient } from '../lib/knowledge-store-client';

export default async function HomePage() {
  const user = await knowledgeStoreClient.getCurrentUser();
  if (!user) {
    redirect('/onboarding');
  }

  const entries = await listKnowledgeEntries();

  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="app-header__mark">Alma</span>
        <span className="app-header__tagline">tu conocimiento, en tu propio disco</span>
      </header>
      <main className="main-layout">
        <ChatPanel />
        <ExplorerPanel initialEntries={entries} />
      </main>
    </div>
  );
}
