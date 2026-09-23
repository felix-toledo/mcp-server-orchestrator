import type { ILlmProvider } from '../../llm/ILlmProvider.js';
import type { PipelineState, PipelineStateUpdate } from '../state.js';

/** AC5 — complex tasks get a short plan before the call/tool loop starts. */
export function createMakePlanNode(deps: { llmProvider: ILlmProvider }) {
  return async (state: PipelineState): Promise<PipelineStateUpdate> => {
    const lastUserMessage = [...state.messages].reverse().find((m) => m.role === 'user');
    if (!lastUserMessage?.content) {
      return { plan: undefined };
    }

    try {
      const response = await deps.llmProvider.generateResponse([
        {
          role: 'user',
          content: `Antes de actuar, armá un plan breve (una lista numerada de 2-5 pasos, sin ejecutar nada todavía) para resolver esto: "${lastUserMessage.content}"`,
        },
      ]);
      return { plan: response.content ?? undefined };
    } catch (error) {
      console.warn('⚠️ No se pudo generar el plan, sigo sin uno:', error);
      return { plan: undefined };
    }
  };
}
