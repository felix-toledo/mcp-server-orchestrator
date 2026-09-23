import type { ILlmProvider, LlmMessage, LlmToolDefinition } from '../../llm/ILlmProvider.js';
import type { SkillManager } from '../../skills/SkillManager.js';
import { formatProfileNoteContext } from '../formatProfileNoteContext.js';
import { formatRerankedContext } from '../formatRerankedContext.js';
import { appendPartialText, resetPartialText } from '../inquireStatusStore.js';
import { BASE_SYSTEM_INSTRUCTIONS, STATUS_MARKER_INSTRUCTIONS } from '../systemInstructions.js';
import type { PipelineState, PipelineStateUpdate } from '../state.js';

const RETRIEVAL_TOOL_NAME = 'searchKnowledgeEntries';

function buildSystemContent(state: PipelineState, skillInstructions: string, systemPromptAddendum?: string): string {
  const withAddendum = systemPromptAddendum
    ? `${BASE_SYSTEM_INSTRUCTIONS}\n\n${systemPromptAddendum}`
    : BASE_SYSTEM_INSTRUCTIONS;
  // orchestrator/002-multi-agent AC3: an Agent's addendum is appended to the
  // base instructions, never a replacement — the "don't narrate saving" /
  // "don't invent when ungrounded" rules always stay in.
  const base = state.isComplex ? `${withAddendum}\n\n${STATUS_MARKER_INSTRUCTIONS}` : withAddendum;

  const extraParts = [
    skillInstructions || undefined,
    formatProfileNoteContext(state.profileNote),
    formatRerankedContext(state.rerankedTop5),
    state.plan ? `Plan para esta tarea:\n${state.plan}` : undefined,
  ].filter((part): part is string => Boolean(part));

  if (extraParts.length === 0) {
    return base;
  }

  const extraInstructions = extraParts.join('\n\n---\n\n');
  return `${base}\n\n---\n[CONTEXTO ADICIONAL — ya disponible a continuación, NO es una herramienta externa, NO necesitás buscarla ni instalarla, usá esta información directamente para responder]:\n\n${extraInstructions}\n\n[FIN DEL CONTEXTO]`;
}

/** AC6/AC7 — the actual LLM call (plan-first for complex tasks, direct otherwise). */
export function createCallLlmNode(deps: {
  llmProvider: ILlmProvider;
  tools: LlmToolDefinition[];
  skillManager: SkillManager;
  systemPromptAddendum?: string;
}) {
  return async (state: PipelineState): Promise<PipelineStateUpdate> => {
    const skillInstructions = deps.skillManager.resolve(state.skillsToUse);
    const systemContent = buildSystemContent(state, skillInstructions, deps.systemPromptAddendum);
    const systemMessage: LlmMessage = { role: 'system', content: systemContent };

    const nonSystemMessages = state.messages.filter((m) => m.role !== 'system');

    // 2026-09-18 — verified live that a long-enough conversation history
    // containing the assistant's OWN earlier "no tengo nada guardado"
    // denials (true before the profile note existed, stale after) makes
    // the LLM keep repeating that denial even with a forceful system-prompt
    // instruction telling it not to — reproduced deterministically outside
    // the graph, a single stale denial turn was enough, and it survived
    // three escalating instruction rewrites. What actually fixed it: a
    // second copy of the profile context placed as the LAST message before
    // generation, not just the first (system prompts this far back in a
    // long history lose out to conversational precedent; recency wins).
    // Not needed when nothing's there yet (nothing to anchor away from).
    const profileReminder = formatProfileNoteContext(state.profileNote);
    const conversationMessages: LlmMessage[] = [
      systemMessage,
      ...nonSystemMessages,
      ...(profileReminder
        ? [
            {
              role: 'system' as const,
              content: `Recordatorio para esta respuesta puntual — no repitas una negación anterior de esta misma charla si contradice esto:\n${profileReminder}`,
            },
          ]
        : []),
    ];

    const llmVisibleTools = deps.tools.filter((t) => t.name !== RETRIEVAL_TOOL_NAME);

    // 2026-09-18 web live-typing addendum — stream when the active
    // provider supports it (`OpenAIProvider`/DeepSeek today) and there's
    // a requestId to stream into (always true for a real chat turn; only
    // absent for graph.invoke() calls with no live-status tracking, e.g.
    // most tests). A pure tool-call turn just streams nothing (no
    // `content` deltas arrive), harmless — the frontend only shows
    // `partialText` once it's actually non-empty.
    let response;
    if (deps.llmProvider.streamResponse && state.requestId) {
      const requestId = state.requestId;
      resetPartialText(requestId);
      response = await deps.llmProvider.streamResponse(conversationMessages, llmVisibleTools, (chunk) =>
        appendPartialText(requestId, chunk),
      );
    } else {
      response = await deps.llmProvider.generateResponse(conversationMessages, llmVisibleTools);
    }

    return { messages: [...nonSystemMessages, response.assistantMessage] };
  };
}
