'use server';

import { knowledgeStoreClient, type TtsEngine } from '../lib/knowledge-store-client';

export type UpdateTtsPreferenceResult = { ok: true } | { ok: false; error: string };

export async function updateTtsPreference(ttsEngine: TtsEngine, ttsVoiceId: string | null): Promise<UpdateTtsPreferenceResult> {
  try {
    await knowledgeStoreClient.updateTtsPreference(ttsEngine, ttsVoiceId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'No se pudo guardar la voz elegida' };
  }
}
