import { redirect } from 'next/navigation';
import { OnboardingForm } from '../../components/onboarding/OnboardingForm';
import { knowledgeStoreClient } from '../../lib/knowledge-store-client';

export default async function OnboardingPage() {
  const user = await knowledgeStoreClient.getCurrentUser();
  if (user) {
    redirect('/');
  }

  return (
    <div className="onboarding">
      <OnboardingForm />
    </div>
  );
}
