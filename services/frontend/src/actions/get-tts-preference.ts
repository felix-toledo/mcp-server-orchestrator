'use server';

import { knowledgeStoreClient, type TtsEngine } from '../lib/knowledge-store-client';

export interface TtsPreferenceResult {
  ttsEngine: TtsEngine;
  ttsVoiceId: string | null;
}

const FAIL_OPEN_PREFERENCE: TtsPreferenceResult = { ttsEngine: 'KOKORO', ttsVoiceId: null };

export async function getTtsPreference(): Promise<TtsPreferenceResult> {
  try {
    const profile = await knowledgeStoreClient.getVoiceProfile();
    if (!profile) {
      return FAIL_OPEN_PREFERENCE;
    }
    return { ttsEngine: profile.ttsEngine, ttsVoiceId: profile.ttsVoiceId };
  } catch {
    return FAIL_OPEN_PREFERENCE;
  }
}
