'use server';

import { orchestratorClient, type ChatMessage } from '../lib/orchestrator-client';

export interface SendChatMessageResult {
  message: ChatMessage;
  sessionId?: string;
}

/** Live-status amendment — `requestId`, when given, lets the caller poll `getInquireStatus` while this is in flight. */
export async function sendChatMessage(
  history: ChatMessage[],
  sessionId?: string,
  requestId?: string,
): Promise<SendChatMessageResult> {
  try {
    return await orchestratorClient.inquire(history, sessionId, undefined, requestId);
  } catch {
    return {
      message: { role: 'assistant', content: 'No pude procesar tu mensaje. Intentá de nuevo en un momento.' },
      sessionId,
    };
  }
}
