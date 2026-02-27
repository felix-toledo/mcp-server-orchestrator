import { ILlmProvider, LlmMessage, LlmToolDefinition } from '../llm/ILlmProvider.js';
import { LlmProviderFactory } from '../llm/LlmProviderFactory.js';
import { McpClient } from './McpClient.js';



const systemInstructions = `Eres un asistente inteligente`
/**
 * Orchestrator principal que coordina el flujo entre el LLM y el servidor MCP
 * Gestiona el ciclo de conversación: mensajes → LLM → herramientas → LLM → respuesta
 * Trabaja con tipos agnósticos (LlmMessage) para soportar múltiples proveedores
 */
export class Orchestrator {
  private llmProvider: ILlmProvider;
  private mcpClient: McpClient;
  private mcpAvailable: boolean = false;
  private maxIterations: number = 10; // Prevenir loops infinitos

  constructor(mcpServerUrl?: string, llmProvider?: ILlmProvider) {
    // Usar proveedor LLM por defecto o el proporcionado
    this.llmProvider = llmProvider || LlmProviderFactory.createDefault();

    // Conectar al servidor MCP (por defecto localhost:3000/mcp)
    let serverUrl = mcpServerUrl || process.env.MCP_SERVER_URL || 'http://localhost:3000/mcp';

    // Asegurar que la URL termine en /mcp
    if (!serverUrl.endsWith('/mcp')) {
      serverUrl = serverUrl + '/mcp';
    }

    this.mcpClient = new McpClient(serverUrl);
  }

  /**
   * Procesa una conversación completa, manejando múltiples iteraciones de tool calls
   * @param messages Historial de mensajes de la conversación (tipos agnósticos)
   * @returns La respuesta final del asistente
   */
  async processConversation(messages: LlmMessage[]): Promise<LlmMessage> {
    // Intentar conectar al servidor MCP (no es bloqueante si falla)
    let tools: LlmToolDefinition[] = [];
    try {
      await this.mcpClient.connect();
      tools = await this.mcpClient.getTools();
      this.mcpAvailable = true;
      console.log(`🔧 Herramientas disponibles: ${tools.map((t) => t.name).join(', ')}`);
    } catch (error) {
      this.mcpAvailable = false;
      console.warn('⚠️ No se pudo conectar al servidor MCP. El LLM funcionará sin herramientas.');
      console.warn(`   Detalle: ${error instanceof Error ? error.message : error}`);
    }

    const systemMessage: LlmMessage = {
      role: 'system',
      content: systemInstructions,
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
      if (!this.mcpAvailable) {
        console.warn('⚠️ El LLM solicitó herramientas pero MCP no está disponible.');
        return {
          role: 'assistant',
          content:
            'En este momento no tengo acceso a las herramientas de análisis. Por favor, verifica que el servidor MCP esté activo e intenta de nuevo.',
        };
      }

      console.log(`🛠️ El LLM solicita ${response.toolCalls.length} tool call(s)`);

      // Ejecutar todas las tool calls solicitadas
      for (const toolCall of response.toolCalls) {
        try {
          console.log(`  → Ejecutando: ${toolCall.name}`);
          const args = JSON.parse(toolCall.arguments);
          const result = await this.mcpClient.callTool(toolCall.name, args);

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
   * Cierra la conexión con el servidor MCP
   */
  async disconnect(): Promise<void> {
    if (this.mcpAvailable) {
      await this.mcpClient.disconnect();
    }
  }
}
