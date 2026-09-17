import { ILlmProvider, LlmMessage, LlmToolDefinition } from '../llm/ILlmProvider.js';
import { LlmProviderFactory } from '../llm/LlmProviderFactory.js';
import { formatRetrievalContext } from './formatRetrievalContext.js';
import { McpManager } from './McpManager.js';

// Corre automáticamente cada turno (spec 002-retrieval AC1) — nunca se
// ofrece como tool al LLM (AC5), se filtra de `tools` antes de pasarlo al
// proveedor.
const RETRIEVAL_TOOL_NAME = 'searchKnowledgeEntries';
const RETRIEVAL_RESULT_LIMIT = 5;

const systemInstructions = `Sos ALMA, un asistente de conocimiento personal. Respondés siempre en español, de forma breve y directa.

Cuando el usuario te cuente algo que valga la pena recordar (una idea, una preferencia, un dato personal, una nota que pida guardar explícitamente), usá la herramienta createKnowledgeEntry para guardarlo como una nota nueva en su bóveda. No la uses para cada mensaje — solo cuando haya algo concreto para persistir.

Guardar es un detalle interno, no algo que el usuario necesite escuchar: nunca anuncies que vas a guardar algo, nunca ofrezcas guardarlo como si fuera una función a promocionar, y nunca repitas de vuelta el nombre del archivo, la ruta, la palabra "bóveda" o que usaste una herramienta. Simplemente recordalo y seguí la conversación con naturalidad, como lo haría alguien que ya lo tiene anotado en la cabeza. Si la herramienta falla, no se lo menciones al usuario ni le des detalles técnicos — seguí la charla con normalidad, sin fingir que quedó guardado.

Antes de cada respuesta ya se buscó automáticamente en la bóveda del usuario información relacionada con su mensaje — la vas a encontrar, si hay algo, en el contexto adicional. Usala con la misma naturalidad que el resto de lo que ya sabés: nunca menciones que "buscaste", nunca digas cuántos resultados hubo, y nunca repitas título/ruta/id de una nota salvo que el usuario pida explícitamente ver esa nota puntual. Si el contexto dice que no se encontró nada relacionado, no lo inventes — decí que no tenés ese dato.`;
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
    // searchKnowledgeEntries nunca se ofrece como tool al LLM (spec
    // 002-retrieval AC5) — se dispara automáticamente más abajo en su lugar.
    const allTools: LlmToolDefinition[] = this.mcpManager ? this.mcpManager.getAllTools() : [];
    const tools: LlmToolDefinition[] = allTools.filter((tool) => tool.name !== RETRIEVAL_TOOL_NAME);

    // Si el caller ya envía un system message, respetarlo como base.
    // Si no, usar las instrucciones internas por defecto.
    const incomingSystem = messages.find((m) => m.role === 'system');
    const baseInstructions = incomingSystem?.content || systemInstructions;
    const nonSystemMessages = messages.filter((m) => m.role !== 'system');

    // Búsqueda automática en la bóveda por el último mensaje del usuario
    // (spec 002-retrieval AC1/AC7).
    const retrievalContext = await this.searchVaultForContext(nonSystemMessages);
    const combinedExtraInstructions = [extraInstructions, retrievalContext].filter(Boolean).join('\n\n---\n\n');

    // Cuando hay skills y/o contexto recuperado, agregar un encabezado explícito para
    // que el LLM entienda que el contexto ya está incluido inline y NO es una
    // herramienta externa a llamar.
    const systemContent = combinedExtraInstructions
      ? `${baseInstructions}\n\n---\n[CONTEXTO ADICIONAL — ya disponible a continuación, NO es una herramienta externa, NO necesitás buscarla ni instalarla, usá esta información directamente para responder]:\n\n${combinedExtraInstructions}\n\n[FIN DEL CONTEXTO]`
      : baseInstructions;

    console.log(`📋 System message (${systemContent.length} chars):`);
    console.log(systemContent.slice(0, 300) + (systemContent.length > 300 ? '...' : ''));

    const systemMessage: LlmMessage = {
      role: 'system',
      content: systemContent,
    };

    const conversationMessages: LlmMessage[] = [systemMessage, ...nonSystemMessages];

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
   * Busca en la bóveda por el último mensaje del usuario y devuelve el
   * bloque de texto listo para extraInstructions (spec 002-retrieval).
   * Nunca lanza: una búsqueda fallida solo deja el contexto vacío (AC7).
   */
  private async searchVaultForContext(nonSystemMessages: LlmMessage[]): Promise<string> {
    const lastUserMessage = [...nonSystemMessages].reverse().find((m) => m.role === 'user');
    if (!lastUserMessage?.content || !this.mcpManager?.hasTools()) {
      return '';
    }

    try {
      const toolResult = await this.mcpManager.callTool(RETRIEVAL_TOOL_NAME, {
        query: lastUserMessage.content,
        limit: RETRIEVAL_RESULT_LIMIT,
      });
      return formatRetrievalContext(toolResult);
    } catch (error) {
      console.warn('⚠️ Búsqueda semántica en la bóveda falló, sigo sin ese contexto:', error);
      return '';
    }
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
