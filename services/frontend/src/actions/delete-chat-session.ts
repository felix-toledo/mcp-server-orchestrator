'use server';

import { knowledgeStoreClient } from '../lib/knowledge-store-client';

export async function deleteChatSession(id: string): Promise<{ ok: boolean }> {
  try {
    await knowledgeStoreClient.deleteChatSession(id);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
