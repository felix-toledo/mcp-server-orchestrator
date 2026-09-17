'use server';

import { knowledgeStoreClient, type KnowledgeEntrySummary } from '../lib/knowledge-store-client';

export async function listKnowledgeEntries(): Promise<KnowledgeEntrySummary[]> {
  return knowledgeStoreClient.listKnowledgeEntries();
}
