'use server';

import { knowledgeStoreClient, type KnowledgeEntrySummary } from '../lib/knowledge-store-client';

export type SaveKnowledgeEntryResult = { ok: true; entry: KnowledgeEntrySummary } | { ok: false; error: string };

export async function saveKnowledgeEntry(id: string, content: string): Promise<SaveKnowledgeEntryResult> {
  try {
    const entry = await knowledgeStoreClient.updateKnowledgeEntry(id, content);
    return { ok: true, entry };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Error desconocido' };
  }
}
