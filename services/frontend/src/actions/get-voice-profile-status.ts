'use server';

import { knowledgeStoreClient, type VoiceProfileStatus } from '../lib/knowledge-store-client';

export interface VoiceProfileStatusResult {
  status: VoiceProfileStatus;
  trainedAt: string | null;
}

const FAIL_OPEN_STATUS: VoiceProfileStatusResult = { status: 'NOT_TRAINED', trainedAt: null };

export async function getVoiceProfileStatus(): Promise<VoiceProfileStatusResult> {
  try {
    const profile = await knowledgeStoreClient.getVoiceProfile();
    if (!profile) {
      return FAIL_OPEN_STATUS;
    }
    return { status: profile.status, trainedAt: profile.trainedAt };
  } catch {
    return FAIL_OPEN_STATUS;
  }
}
