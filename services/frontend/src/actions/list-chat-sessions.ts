'use server';

import { knowledgeStoreClient, type ChatSessionSummary } from '../lib/knowledge-store-client';

export async function listChatSessions(): Promise<ChatSessionSummary[]> {
  return knowledgeStoreClient.listChatSessions();
}
