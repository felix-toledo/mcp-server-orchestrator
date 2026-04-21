import { Request, Response } from 'express';
import { z } from 'zod';
import { LlmMessage } from '../llm/ILlmProvider.js';
import { Orchestrator } from '../mcp/Orchestrator.js';
import { skillManager } from '../skills/SkillManager.js';

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
  skills: z.array(z.string()).optional(), // Nombres de skills a aplicar en esta llamada
});

export type Message = z.infer<typeof MessageSchema>;
export type InquireRequest = z.infer<typeof InquireRequestSchema>;

/**
 * Controller principal para manejar las consultas al orchestrator
 * Recibe el historial del chat y coordina la respuesta usando el LLM y MCP
 */
// Instancia global del orchestrator para reutilizar la conexión MCP
let globalOrchestrator: Orchestrator | null = null;

/**
 * Pre-inicializa el orchestrator y conecta los servidores MCP.
 * Llamar al arrancar el servidor para que el primer request no espere.
 */
export async function initializeOrchestrator(): Promise<void> {
  if (!globalOrchestrator) {
    globalOrchestrator = new Orchestrator();
  }
  await globalOrchestrator.initialize();
}

export const inquireController = async (req: Request, res: Response): Promise<void> => {
  try {
    // Validar el body de la petición
    const validationResult = InquireRequestSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        error: 'Invalid request body',
        details: validationResult.error.errors,
      });
      return;
    }

    const { messages, skills = [] } = validationResult.data;

    console.log(`\n📨 Nueva petición recibida con ${messages.length} mensajes`);
    if (skills.length > 0) {
      console.log(`🎯 Skills solicitadas: [${skills.join(', ')}]`);
    } else {
      console.log(`🎯 Skills solicitadas: (ninguna)`);
    }

    // Convertir mensajes al formato agnóstico LlmMessage
    const llmMessages: LlmMessage[] = messages.map((msg): LlmMessage => {
      // Manejar mensajes de tipo tool (requieren toolCallId)
      if (msg.role === 'tool') {
        return {
          role: 'tool',
          toolCallId: msg.tool_call_id || 'unknown',
          name: msg.name,
          content: msg.content || '',
        };
      }

      // Manejar mensajes del asistente con tool_calls
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

      // Mensajes simples (system, user, assistant)
      return {
        role: msg.role,
        content: msg.content || '',
      };
    });

    // Reutilizar orchestrator global o crear uno nuevo si no existe
    if (!globalOrchestrator) {
      console.log('🔧 Creando nueva instancia de orchestrator...');
      globalOrchestrator = new Orchestrator();
    }

    // Resolver instrucciones de skills
    const skillInstructions = skillManager.resolve(skills);
    if (skillInstructions) {
      console.log(`📝 Skills resueltas OK. Instrucciones inyectadas (${skillInstructions.length} chars)`);
    }

    // Procesar la conversación
    const response = await globalOrchestrator.processConversation(llmMessages, skillInstructions || undefined);

    console.log('✅ Respuesta generada exitosamente');
    console.log(`📋 Contenido: ${String(response.content ?? '').slice(0, 500)}\n`);

    // Devolver la respuesta
    res.json({
      success: true,
      message: response,
    });
  } catch (error) {
    console.error('❌ Error in inquireController:', error);

    // Si hay error, limpiar la conexión para forzar una nueva en el próximo intento
    if (globalOrchestrator) {
      try {
        await globalOrchestrator.disconnect();
      } catch (disconnectError) {
        console.error('Error al desconectar:', disconnectError);
      }
      globalOrchestrator = null;
    }

    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
