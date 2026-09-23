'use server';

import { knowledgeStoreClient } from '../lib/knowledge-store-client';

export async function deleteVaultFolder(id: string): Promise<{ ok: boolean }> {
  try {
    await knowledgeStoreClient.deleteVaultFolder(id);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
