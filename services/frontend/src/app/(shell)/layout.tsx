import { redirect } from 'next/navigation';
import { AppNav } from '../../components/shell/AppNav';
import { knowledgeStoreClient } from '../../lib/knowledge-store-client';

export default async function ShellLayout({ children }: { children: React.ReactNode }) {
  const user = await knowledgeStoreClient.getCurrentUser();
  if (!user) {
    redirect('/onboarding');
  }

  return (
    <div className="app-shell">
      <AppNav />
      <main className="shell-main">{children}</main>
    </div>
  );
}
