'use server';

import { knowledgeStoreClient, type VoiceProfileStatus } from '../lib/knowledge-store-client';

export type EnrollVoiceProfileResult =
  | { ok: true; status: VoiceProfileStatus; trainedAt: string }
  | { ok: false; error: string };

export async function enrollVoiceProfile(formData: FormData): Promise<EnrollVoiceProfileResult> {
  try {
    const result = await knowledgeStoreClient.enrollVoiceProfile(formData);
    if (!result.trainedAt) {
      return { ok: false, error: 'knowledge-store no devolvió una fecha de entrenamiento' };
    }
    return { ok: true, status: result.status, trainedAt: result.trainedAt };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'No se pudo entrenar el perfil de voz' };
  }
}
