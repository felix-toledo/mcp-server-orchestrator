'use server';

import { orchestratorClient, type ChatMessage } from '../lib/orchestrator-client';

export async function sendChatMessage(history: ChatMessage[]): Promise<ChatMessage> {
  try {
    return await orchestratorClient.inquire(history);
  } catch {
    return { role: 'assistant', content: 'No pude procesar tu mensaje. Intentá de nuevo en un momento.' };
  }
}
