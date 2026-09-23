'use server';

import { orchestratorClient, type ChatMessage } from '../lib/orchestrator-client';

export interface SendTeamChatMessageResult {
  message: ChatMessage;
  sessionId?: string;
}

/**
 * team-chat amendment (orchestrator/003-teams) — kept separate from
 * send-chat-message.ts so the main chat is untouched. Live-status
 * amendment — `requestId`, when given, lets the caller poll
 * `getInquireStatus` while this is in flight.
 */
export async function sendTeamChatMessage(
  history: ChatMessage[],
  teamId: string,
  sessionId?: string,
  requestId?: string,
): Promise<SendTeamChatMessageResult> {
  try {
    return await orchestratorClient.inquire(history, sessionId, teamId, requestId);
  } catch {
    return {
      message: { role: 'assistant', content: 'No pude procesar tu mensaje. Intentá de nuevo en un momento.' },
      sessionId,
    };
  }
}
