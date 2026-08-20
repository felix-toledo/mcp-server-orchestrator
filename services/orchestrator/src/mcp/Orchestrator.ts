import { ILlmProvider, LlmMessage, LlmToolDefinition } from '../llm/ILlmProvider.js';
import { LlmProviderFactory } from '../llm/LlmProviderFactory.js';
import { McpManager } from './McpManager.js';

const systemInstructions = () => {
  const now = new Date();
  const formatted = now.toLocaleString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    dateStyle: 'full',
    timeStyle: 'short',
  });
  return `Eres el asistente personal de Felix. La fecha y hora actual es: ${formatted}.`;
};
/**
 * Orchestrator principal que coordina el flujo entre el LLM y múltiples servidores MCP
 * Gestiona el ciclo de conversación: mensajes → LLM → herramientas → LLM → respuesta
 * Carga servidores MCP desde mcp_config.json (soporta stdio, sse, streamableHttp)
 */
export class Orchestrator {
  private llmProvider: ILlmProvider;
  private mcpManager: McpManager | null = null;
  private maxIterations: number = 20; // Prevenir loops infinitos

  constructor(llmProvider?: ILlmProvider) {
    // Usar proveedor LLM por defecto o el proporcionado
    this.llmProvider = llmProvider || LlmProviderFactory.createDefault();
  }

  /**
   * Procesa una conversación completa, manejando múltiples iteraciones de tool calls
   * @param messages Historial de mensajes de la conversación (tipos agnósticos)
   * @returns La respuesta final del asistente
   */
  async processConversation(messages: LlmMessage[]): Promise<LlmMessage> {
    // Conectar a todos los servidores MCP configurados en mcp_config.json
    let tools: LlmToolDefinition[] = [];
    try {
      this.mcpManager = await McpManager.fromConfig();
      tools = this.mcpManager.getAllTools();

      if (tools.length > 0) {
        console.log(`🔧 Herramientas disponibles: ${tools.map((t) => t.name).join(', ')}`);
      } else {
        console.warn('⚠️ Se conectaron servidores MCP pero no se encontraron herramientas.');
      }
    } catch (error) {
      this.mcpManager = null;
      console.warn('⚠️ No se pudieron cargar servidores MCP. El LLM funcionará sin herramientas.');
      console.warn(`   Detalle: ${error instanceof Error ? error.message : error}`);
    }

    const systemMessage: LlmMessage = {
      role: 'system',
      content: systemInstructions(),
    };

    let conversationMessages: LlmMessage[] = [systemMessage, ...messages];

    console.log('MENSAJES QUE RECIBE EL LLM: ', conversationMessages);

    let iteration = 0;

    // Loop de conversación: LLM puede llamar herramientas múltiples veces
    while (iteration < this.maxIterations) {
      iteration++;
      console.log(`\n🔄 Iteración ${iteration}`);

      // Generar respuesta del LLM
      const response = await this.llmProvider.generateResponse(conversationMessages, tools);

      // Agregar la respuesta del asistente al historial
      conversationMessages.push(response.assistantMessage);

      // Si no hay tool calls, hemos terminado
      if (!response.toolCalls || response.toolCalls.length === 0) {
        console.log('✅ Conversación completada (sin tool calls)');
        return response.assistantMessage;
      }

      // Si el LLM pide herramientas pero MCP no está disponible, informar y terminar
      if (!this.mcpManager || !this.mcpManager.hasTools()) {
        console.warn('⚠️ El LLM solicitó herramientas pero no hay servidores MCP disponibles.');
        return {
          role: 'assistant',
          content:
            'En este momento no tengo acceso a las herramientas de análisis. Por favor, verifica que los servidores MCP estén configurados y activos e intenta de nuevo.',
        };
      }

      console.log(`🛠️ El LLM solicita ${response.toolCalls.length} tool call(s)`);

      // Ejecutar todas las tool calls solicitadas
      for (const toolCall of response.toolCalls) {
        try {
          console.log(`  → Ejecutando: ${toolCall.name}`);
          const args = JSON.parse(toolCall.arguments);
          const result = await this.mcpManager!.callTool(toolCall.name, args);

          // Agregar el resultado al historial (con name para compatibilidad con Gemini)
          const toolMessage: LlmMessage = {
            role: 'tool',
            toolCallId: toolCall.id,
            name: toolCall.name,
            content: JSON.stringify(result),
          };
          conversationMessages.push(toolMessage);
          console.log(`  ✓ Resultado: ${JSON.stringify(result)}`);
        } catch (error) {
          console.error(`  ✗ Error ejecutando ${toolCall.name}:`, error);
          // Agregar mensaje de error al historial
          const errorMessage: LlmMessage = {
            role: 'tool',
            toolCallId: toolCall.id,
            name: toolCall.name,
            content: JSON.stringify({
              error: error instanceof Error ? error.message : 'Unknown error',
            }),
          };
          conversationMessages.push(errorMessage);
        }
      }

      // Continuar el loop: el LLM procesará los resultados de las herramientas
    }

    // Si llegamos aquí, alcanzamos el límite de iteraciones
    console.warn(`⚠️ Se alcanzó el límite de iteraciones (${this.maxIterations})`);
    return {
      role: 'assistant',
      content:
        'He alcanzado el límite de iteraciones. Por favor, reformula tu pregunta o divide la tarea en pasos más pequeños.',
    };
  }

  /**
   * Cierra todas las conexiones MCP
   */
  async disconnect(): Promise<void> {
    if (this.mcpManager) {
      await this.mcpManager.disconnectAll();
    }
  }
}
