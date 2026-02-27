import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { LlmToolDefinition } from '../llm/ILlmProvider.js';

/**
 * Cliente MCP que se conecta al mcp-server para descubrir y ejecutar herramientas
 */
export class McpClient {
  private client: Client;
  private transport: StreamableHTTPClientTransport;
  private connected: boolean = false;
  private mcpServerUrl: string;

  constructor(mcpServerUrl: string) {
    this.mcpServerUrl = mcpServerUrl;
    this.client = new Client(
      {
        name: 'orchestrator-client',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      },
    );

    this.transport = new StreamableHTTPClientTransport(new URL(this.mcpServerUrl));
  }

  /**
   * Conecta al servidor MCP
   */
  async connect(): Promise<void> {
    if (this.connected) {
      console.log('ℹ️ Ya conectado al servidor MCP, reutilizando conexión');
      return;
    }

    try {
      console.log(`🔌 Intentando conectar al servidor MCP en ${this.mcpServerUrl}...`);
      await this.client.connect(this.transport);
      this.connected = true;
      console.log(`✅ Conectado al servidor MCP en ${this.mcpServerUrl}`);
    } catch (error) {
      console.error('Error al conectar con el servidor MCP:', error);
      this.connected = false;
      throw new Error(`No se pudo conectar al servidor MCP: ${error}`);
    }
  }

  /**
   * Desconecta del servidor MCP
   */
  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.client.close();
      this.connected = false;
      console.log('🔌 Desconectado del servidor MCP');
    }
  }

  /**
   * Obtiene la lista de herramientas disponibles en el servidor MCP
   */
  async listTools(): Promise<any[]> {
    if (!this.connected) {
      await this.connect();
    }

    try {
      const response = await this.client.listTools();
      return response.tools;
    } catch (error) {
      console.error('Error al listar herramientas:', error);
      throw new Error(`Error al obtener herramientas del servidor MCP: ${error}`);
    }
  }

  /**
   * Convierte las herramientas MCP al formato agnóstico LlmToolDefinition
   */
  async getTools(): Promise<LlmToolDefinition[]> {
    const mcpTools = await this.listTools();

    return mcpTools.map((tool) => ({
      name: tool.name,
      description: tool.description || '',
      parameters: (tool.inputSchema as Record<string, unknown>) || {},
    }));
  }

  /**
   * Ejecuta una herramienta en el servidor MCP
   * @param toolName Nombre de la herramienta
   * @param args Argumentos de la herramienta
   */
  async callTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
    if (!this.connected) {
      await this.connect();
    }

    try {
      const response = await this.client.callTool({
        name: toolName,
        arguments: args,
      });

      return response;
    } catch (error) {
      console.error(`Error al ejecutar la herramienta ${toolName}:`, error);
      throw new Error(`Error al ejecutar la herramienta: ${error}`);
    }
  }

  /**
   * Verifica si el cliente está conectado
   */
  isConnected(): boolean {
    return this.connected;
  }
}
