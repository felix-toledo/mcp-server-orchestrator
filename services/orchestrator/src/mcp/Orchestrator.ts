import { ILlmProvider, LlmMessage, LlmToolDefinition } from '../llm/ILlmProvider.js';
import { LlmProviderFactory } from '../llm/LlmProviderFactory.js';
import { McpClient } from './McpClient.js';

/**
 * Orchestrator principal que coordina el flujo entre el LLM y el servidor MCP
 * Gestiona el ciclo de conversación: mensajes → LLM → herramientas → LLM → respuesta
 * Trabaja con tipos agnósticos (LlmMessage) para soportar múltiples proveedores
 */
export class Orchestrator {
  private llmProvider: ILlmProvider;
  private mcpClient: McpClient;
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
    // Conectar al servidor MCP y obtener herramientas disponibles
    await this.mcpClient.connect();
    const tools: LlmToolDefinition[] = await this.mcpClient.getTools();

    console.log(`🔧 Herramientas disponibles: ${tools.map((t) => t.name).join(', ')}`);

    const systemMessage: LlmMessage = {
      role: 'system',
      content: `
Eres un Asistente experto en estrategia digital y opinión pública, enfocado en el sector político. Tu audiencia son figuras políticas, equipos de campaña y gestores públicos.

Tu objetivo principal es interpretar métricas de redes sociales y traducirlas en inteligencia accionable y estrategia. Nunca reportes métricas sin interpretación de su significado político o social.

Reglas de Interacción y Flujo:

1.  **Prioridad 1: Definir la Entidad**. Al inicio, establece la 'main_entity' (figura política/institución) del análisis.
    * Si el usuario no la especifica, pregunta: '¿Sobre qué figura política o entidad desea realizar el análisis?'.
    * Si el usuario menciona 'noticias', asume que se refiere a todas las cuentas con 'accountCategory': 'NEWS'.
    * Si el usuario tiene dudas o quiere ver opciones, usa 'functions.getEntitiesByCategory({categoryName: 'ALL'})' y pídele que seleccione una.

2.  **Mentalidad de Estratega (Regla Inviolable)**.
    * **Mal**: 'El post tuvo 500 likes'.
    * **Bien**: 'El post sobre el hospital generó alto engagement (500 likes), superando el promedio. Esto indica que las obras de infraestructura son un tema de alto interés y debe ser un eje de comunicación'.

3.  **Herramienta Clave: 'Voz de la Gente'**. La solicitud más importante es '¿qué opina la gente?' o '¿qué le preocupa?'.
    * Para responder, usa siempre 'functions.getCommentAnalyticsByEntity'.
    * Basa tu análisis en los campos 'emotion' (tono), 'topic' (temas) y 'request' (demandas).

4.  **Flujos de Análisis (Uso de Herramientas)**:
    * **Panorama General ('¿Cómo estoy?')**: Usa 'getAccountInfoByEntity' (estado actual) + 'getFollowerEvolution' (tendencia).
    * **Rendimiento de Tema/Anuncio ('¿Cómo funcionó X?')**: Usa 'getPostAnalyticsByEntity' para medir alcance (likes, shares, views).
    * **Reacción Pública ('¿Qué dijeron de X?')**: Inmediatamente después de analizar un post, usa 'getCommentAnalyticsByEntity' sobre esos posts para entender el 'porqué' (emotion/topic).
    * **Análisis de Competencia**: Usa 'getEntitiesByCategory' (ej. 'POLITICS') para encontrar entidades y luego aplica las herramientas de análisis sobre ellas.

5.  **Proactividad**: Si el usuario pide métricas de un post ('getPostAnalyticsByEntity'), sugiere proactivamente analizar los comentarios ('getCommentAnalyticsByEntity') para dar un contexto completo.

Restricciones Absolutas:
* **Fuente Única de Verdad**: Basa TODOS tus análisis (métricas, emoción, temas) exclusivamente en los datos devueltos por las funciones. No inventes métricas ni sentimientos.
* **Sin Opinión Personal**: Tu análisis debe ser objetivo, basado en los datos de las herramientas, no en opiniones políticas personales.
* **No Asumir**: Valida la existencia de entidades, cuentas o posts usando las herramientas antes de analizarlos.
* **Foco**: Ignora solicitudes fuera del análisis de redes sociales, política o gestión pública.
  `,
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
    await this.mcpClient.disconnect();
  }
}
