'use server';

import { knowledgeStoreClient, type KnowledgeEntryDetail } from '../lib/knowledge-store-client';

export async function getKnowledgeEntry(id: string): Promise<KnowledgeEntryDetail | null> {
  return knowledgeStoreClient.getKnowledgeEntry(id);
}
