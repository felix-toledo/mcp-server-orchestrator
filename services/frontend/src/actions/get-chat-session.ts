'use server';

import { knowledgeStoreClient, type ChatSessionDetail } from '../lib/knowledge-store-client';

export async function getChatSession(id: string): Promise<ChatSessionDetail | null> {
  return knowledgeStoreClient.getChatSession(id);
}
