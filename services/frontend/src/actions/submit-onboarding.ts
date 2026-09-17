'use server';

import { z } from 'zod';
import { knowledgeStoreClient } from '../lib/knowledge-store-client';

const PurposeSchema = z.enum([
  'PERSONAL_DAILY',
  'AUTOMATION_PRODUCTIVITY',
  'PROJECTS_WORK',
  'SECOND_BRAIN_STUDY',
  'TEAM_BUSINESS',
]);

const OnboardingInputSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  purpose: PurposeSchema,
});

export interface OnboardingFormState {
  status: 'idle' | 'error' | 'success';
  error?: string;
}

function buildOnboardingNote(input: z.infer<typeof OnboardingInputSchema>): string {
  return [
    `# Conocimientos`,
    '',
    `- **Nombre**: ${input.name}`,
    `- **Email**: ${input.email}`,
    `- **Para qué usa ALMA**: ${input.purpose}`,
  ].join('\n');
}

export async function submitOnboarding(
  _prevState: OnboardingFormState,
  formData: FormData,
): Promise<OnboardingFormState> {
  const parsed = OnboardingInputSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    purpose: formData.get('purpose'),
  });

  if (!parsed.success) {
    return { status: 'error', error: 'Revisá los datos: nombre, email válido, y un propósito seleccionado.' };
  }

  try {
    await knowledgeStoreClient.createUser(parsed.data);
    await knowledgeStoreClient.createKnowledgeEntry({
      title: 'Conocimientos',
      content: buildOnboardingNote(parsed.data),
    });
  } catch (error) {
    return { status: 'error', error: error instanceof Error ? error.message : 'Error desconocido' };
  }

  return { status: 'success' };
}
