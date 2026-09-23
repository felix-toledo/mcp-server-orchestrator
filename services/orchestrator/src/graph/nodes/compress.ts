import type { ILlmProvider, LlmMessage } from '../../llm/ILlmProvider.js';
import type { PipelineState, PipelineStateUpdate } from '../state.js';

const RECENT_MESSAGES_KEPT = 2;

/**
 * AC9 — for a complex task still in progress, replaces the in-flight
 * transcript with a short summary + the most recent exchange, so the next
 * `callLlm` iteration doesn't resend the whole growing history. Scoped to
 * this one request only (never persisted) — see
 * `knowledge-store/003-chat-sessions` §8 OQ1 for why that's a deliberate,
 * different thing from that spec's persisted `ChatMessage` history.
 */
export function createCompressNode(deps: { smallLlmProvider: ILlmProvider }) {
  return async (state: PipelineState): Promise<PipelineStateUpdate> => {
    const transcript = state.messages
      .map((m) => `${m.role}: ${m.content ?? (m.toolCalls ? JSON.stringify(m.toolCalls) : '')}`)
      .join('\n');

    try {
      const response = await deps.smallLlmProvider.generateResponse([
        {
          role: 'user',
          content: `Resumí en 2-4 frases el progreso de esta tarea hasta ahora, para que se pueda continuar sin perder contexto:\n\n${transcript}`,
        },
      ]);

      const summaryMessage: LlmMessage = {
        role: 'assistant',
        content: `[Resumen del progreso hasta ahora]: ${response.content ?? 'sin resumen disponible'}`,
      };
      return { messages: [summaryMessage, ...state.messages.slice(-RECENT_MESSAGES_KEPT)] };
    } catch (error) {
      console.warn('⚠️ Compresor falló, sigo con el historial completo:', error);
      return {};
    }
  };
}
