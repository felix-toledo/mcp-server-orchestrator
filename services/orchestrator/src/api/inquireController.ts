import { Request, Response } from 'express';
import { z } from 'zod';
import { disconnectGraphRuntime, initializeGraphRuntime, runReasoningGraph } from '../graph/graphRuntime.js';
import { clearInquireStatus, getInquireStatus } from '../graph/inquireStatusStore.js';
import { KnowledgeStoreClient } from '../knowledge/knowledgeStoreClient.js';
import { LlmMessage } from '../llm/ILlmProvider.js';

const knowledgeStoreClient = new KnowledgeStoreClient(
  process.env.KNOWLEDGE_STORE_URL || 'http://localhost:30025',
);

// Schema para validar los mensajes del chat
const MessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant', 'tool']),
  content: z.string().nullable(),
  name: z.string().optional(), // Para identificar la herramienta en mensajes de tipo "tool"
  tool_call_id: z.string().optional(), // ID de la llamada a la herramienta
  tool_calls: z
    .array(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        arguments: z.string().optional(),
        function: z
          .object({
            name: z.string(),
            arguments: z.string(),
          })
          .optional(),
      }),
    )
    .optional(), // Para mensajes del asistente con tool calls
});

const InquireRequestSchema = z.object({
  messages: z.array(MessageSchema).min(1, 'El array de mensajes no puede estar vacío'),
  sessionId: z.string().optional(), // knowledge-store/003-chat-sessions
  teamId: z.string().optional(), // orchestrator/003-teams team-chat amendment
  requestId: z.string().optional(), // live-status amendment — key for polling GET /api/inquire/status/:requestId
});

export type Message = z.infer<typeof MessageSchema>;
export type InquireRequest = z.infer<typeof InquireRequestSchema>;

/**
 * Pre-inicializa el motor de razonamiento (LangGraph) y conecta los
 * servidores MCP. Llamar al arrancar el servidor para que el primer
 * request no espere.
 */
export async function initializeOrchestrator(): Promise<void> {
  await initializeGraphRuntime();
}

/**
 * Persists one chat turn (knowledge-store/003-chat-sessions AC7/AC8) —
 * creates a session if none was given, appends the user + assistant
 * messages. Never throws: a failure here must never block the reply, so
 * it's swallowed and logged, and the caller gets back whatever sessionId
 * it has (possibly still undefined if even creation failed).
 */
async function persistChatTurn(
  incomingSessionId: string | undefined,
  llmMessages: LlmMessage[],
  response: LlmMessage,
  teamId?: string,
): Promise<string | undefined> {
  let sessionId = incomingSessionId;
  try {
    if (!sessionId) {
      sessionId = (await knowledgeStoreClient.createChatSession(teamId)).id;
    }
    const lastUserMessage = [...llmMessages].reverse().find((m) => m.role === 'user');
    if (lastUserMessage?.content) {
      await knowledgeStoreClient.appendChatMessage(sessionId, 'USER', lastUserMessage.content);
    }
    if (response.content) {
      await knowledgeStoreClient.appendChatMessage(sessionId, 'ASSISTANT', response.content);
    }
  } catch (error) {
    console.warn('⚠️ No se pudo persistir la sesión de chat:', error);
  }
  return sessionId;
}

function toLlmMessage(msg: Message): LlmMessage {
  if (msg.role === 'tool') {
    return {
      role: 'tool',
      toolCallId: msg.tool_call_id || 'unknown',
      name: msg.name,
      content: msg.content || '',
    };
  }

  if (msg.role === 'assistant' && msg.tool_calls) {
    return {
      role: 'assistant',
      content: msg.content,
      toolCalls: msg.tool_calls.map((tc) => ({
        id: tc.id,
        name: tc.function?.name || tc.name || 'unknown',
        arguments: tc.function?.arguments || tc.arguments || '{}',
      })),
    };
  }

  return { role: msg.role, content: msg.content || '' };
}

export const inquireController = async (req: Request, res: Response): Promise<void> => {
  let requestId: string | undefined;
  try {
    const validationResult = InquireRequestSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        error: 'Invalid request body',
        details: validationResult.error.errors,
      });
      return;
    }

    const { messages, sessionId: incomingSessionId, teamId, requestId: parsedRequestId } = validationResult.data;
    requestId = parsedRequestId;

    // Real bug found live (2026-09-18): the onboarding gate
    // (frontend/001-onboarding) only ever lived in the Next.js route tree
    // ((shell)/layout.tsx's redirect) — any caller that reaches this
    // endpoint directly (a raw curl, the Telegram channel) skipped it
    // entirely and got a normal ALMA reply with no `User` row at all.
    // This is the one place every channel funnels through, so the check
    // belongs here, not duplicated per-channel.
    if (!(await knowledgeStoreClient.hasCompletedOnboarding())) {
      res.json({
        success: true,
        message: {
          role: 'assistant',
          content:
            'Todavía no completaste el onboarding de ALMA. Abrí la app web y seguí los pasos iniciales antes de que pueda ayudarte.',
        },
        sessionId: incomingSessionId,
      });
      return;
    }

    console.log(`\n📨 Nueva petición recibida con ${messages.length} mensajes`);

    const llmMessages: LlmMessage[] = messages.map(toLlmMessage);

    // El SkillRouter (orchestrator/001-reasoning-pipeline) decide qué
    // skills aplican por mensaje — el pipeline ya no depende de que el
    // caller las nombre explícitamente en el body.
    const response = await runReasoningGraph(llmMessages, { teamId, requestId });

    console.log('✅ Respuesta generada exitosamente');
    console.log(`📋 Contenido: ${String(response.content ?? '').slice(0, 500)}\n`);

    // Persistencia de la sesión de chat (knowledge-store/003-chat-sessions
    // AC7/AC8) — nunca bloquea la respuesta si falla.
    const sessionId = await persistChatTurn(incomingSessionId, llmMessages, response, teamId);

    res.json({
      success: true,
      message: response,
      sessionId,
    });
  } catch (error) {
    console.error('❌ Error in inquireController:', error);

    try {
      await disconnectGraphRuntime();
    } catch (disconnectError) {
      console.error('Error al desconectar:', disconnectError);
    }

    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  } finally {
    // Live-status amendment — a finished request (success, error, or the
    // onboarding-gate early exit) has nothing left to poll for.
    if (requestId) {
      clearInquireStatus(requestId);
    }
  }
};

/**
 * Live-status amendment — polled by the frontend while a request is in
 * flight. `label: null` means finished/unknown. `partialText` (2026-09-18
 * web live-typing addendum) carries the final answer's text as it streams
 * in from the LLM provider — `''` until streaming starts or when the
 * active provider doesn't support it.
 */
export const inquireStatusController = (req: Request, res: Response): void => {
  const status = getInquireStatus(req.params.requestId);
  res.json({ label: status?.label ?? null, partialText: status?.partialText ?? '' });
};
