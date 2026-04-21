import { ILlmProvider, LlmMessage, LlmToolDefinition } from '../llm/ILlmProvider.js';
import { LlmProviderFactory } from '../llm/LlmProviderFactory.js';
import { McpManager } from './McpManager.js';



const systemInstructions = `Eres un asistente inteligente`
/**
 * Orchestrator principal que coordina el flujo entre el LLM y múltiples servidores MCP
 * Gestiona el ciclo de conversación: mensajes → LLM → herramientas → LLM → respuesta
 * Carga servidores MCP desde mcp_config.json (soporta stdio, sse, streamableHttp)
 */
export class Orchestrator {
  private llmProvider: ILlmProvider;
  private mcpManager: McpManager | null = null;
  private maxIterations: number = 10; // Prevenir loops infinitos

  constructor(llmProvider?: ILlmProvider) {
    // Usar proveedor LLM por defecto o el proporcionado
    this.llmProvider = llmProvider || LlmProviderFactory.createDefault();
  }

  /**
   * Pre-inicializa las conexiones MCP. Llamar al arrancar el servidor para que el
   * primer request no tenga que esperar la conexión.
   * Idempotente: si ya está inicializado, no hace nada.
   */
  async initialize(): Promise<void> {
    if (this.mcpManager) return;
    try {
      this.mcpManager = await McpManager.fromConfig();
      const tools = this.mcpManager.getAllTools();
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
  }

  /**
   * Procesa una conversación completa, manejando múltiples iteraciones de tool calls
   * @param messages Historial de mensajes de la conversación (tipos agnósticos)
   * @param extraInstructions Instrucciones adicionales de skills, inyectadas en el system message
   * @returns La respuesta final del asistente
   */
  async processConversation(messages: LlmMessage[], extraInstructions?: string): Promise<LlmMessage> {
    // Inicializar MCP si todavía no se hizo (lazy fallback para el primer request)
    if (!this.mcpManager) {
      await this.initialize();
    }
    const tools: LlmToolDefinition[] = this.mcpManager ? this.mcpManager.getAllTools() : [];

    // Si el caller ya envía un system message, respetarlo como base.
    // Si no, usar las instrucciones internas por defecto.
    const incomingSystem = messages.find((m) => m.role === 'system');
    const baseInstructions = incomingSystem?.content || systemInstructions;
    const nonSystemMessages = messages.filter((m) => m.role !== 'system');

    // Cuando hay skills, agregar un encabezado explícito para que el LLM entienda
    // que el contexto ya está incluido inline y NO es una herramienta externa a llamar.
    const systemContent = extraInstructions
      ? `${baseInstructions}\n\n---\n[CONTEXTO ADICIONAL — ya disponible a continuación, NO es una herramienta externa, NO necesitás buscarla ni instalarla, usá esta información directamente para responder]:\n\n${extraInstructions}\n\n[FIN DEL CONTEXTO]`
      : baseInstructions;

    console.log(`📋 System message (${systemContent.length} chars):`);
    console.log(systemContent.slice(0, 300) + (systemContent.length > 300 ? '...' : ''));

    const systemMessage: LlmMessage = {
      role: 'system',
      content: systemContent,
    };

    let conversationMessages: LlmMessage[] = [systemMessage, ...nonSystemMessages];

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
        const provider = this.llmProvider.getName?.() ?? 'llm';
        const note = provider === 'copilot' ? '(Copilot maneja herramientas internamente)' : '(sin tool calls)';
        console.log(`✅ Conversación completada ${note}`);
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
