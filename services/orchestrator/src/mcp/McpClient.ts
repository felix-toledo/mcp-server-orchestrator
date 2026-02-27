import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { LlmToolDefinition } from '../llm/ILlmProvider.js';
import { McpServerConfig } from './McpConfigTypes.js';

/**
 * Cliente MCP genérico que se conecta a cualquier servidor MCP
 * Soporta transportes: stdio, sse, streamableHttp
 */
export class McpClient {
  private client: Client;
  private transport: Transport;
  private connected: boolean = false;
  private serverName: string;
  private config: McpServerConfig;

  constructor(serverName: string, config: McpServerConfig) {
    this.serverName = serverName;
    this.config = config;

    this.client = new Client(
      {
        name: `orchestrator-client-${serverName}`,
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      },
    );

    this.transport = McpClient.createTransport(config);
  }

  /**
   * Crea el transporte adecuado según la configuración
   */
  private static createTransport(config: McpServerConfig): Transport {
    switch (config.transport) {
      case 'stdio':
        return new StdioClientTransport({
          command: config.command,
          args: config.args,
          env: config.env,
          cwd: config.cwd,
        });

      case 'streamableHttp':
        return new StreamableHTTPClientTransport(new URL(config.url), {
          requestInit: config.headers
            ? { headers: config.headers }
            : undefined,
        });

      case 'sse':
        return new SSEClientTransport(new URL(config.url), {
          requestInit: config.headers
            ? { headers: config.headers }
            : undefined,
        });

      default:
        throw new Error(`Transporte no soportado: ${(config as any).transport}`);
    }
  }

  /**
   * Retorna el nombre lógico del servidor
   */
  getName(): string {
    return this.serverName;
  }

  /**
   * Conecta al servidor MCP
   */
  async connect(): Promise<void> {
    if (this.connected) {
      console.log(`ℹ️ [${this.serverName}] Ya conectado, reutilizando conexión`);
      return;
    }

    try {
      const label = this.config.transport === 'stdio'
        ? `${this.config.command} ${(this.config.args || []).join(' ')}`
        : (this.config as any).url;
      console.log(`🔌 [${this.serverName}] Conectando vía ${this.config.transport} → ${label}...`);
      await this.client.connect(this.transport);
      this.connected = true;
      console.log(`✅ [${this.serverName}] Conectado`);
    } catch (error) {
      console.error(`❌ [${this.serverName}] Error al conectar:`, error);
      this.connected = false;
      throw new Error(`No se pudo conectar al servidor MCP "${this.serverName}": ${error}`);
    }
  }

  /**
   * Desconecta del servidor MCP
   */
  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.client.close();
      this.connected = false;
      console.log(`🔌 [${this.serverName}] Desconectado`);
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
   * Sanitiza los schemas para que sean compatibles con todos los proveedores LLM
   */
  async getTools(): Promise<LlmToolDefinition[]> {
    const mcpTools = await this.listTools();

    return mcpTools.map((tool) => ({
      name: tool.name,
      description: tool.description || '',
      parameters: McpClient.sanitizeSchema(
        (tool.inputSchema as Record<string, unknown>) || {},
      ),
    }));
  }

  /**
   * Elimina propiedades del JSON Schema que no son compatibles con ciertos LLMs
   * (ej: Gemini no acepta $schema, additionalProperties, default, $ref, etc.)
   */
  private static sanitizeSchema(schema: Record<string, unknown>): Record<string, unknown> {
    const disallowedKeys = new Set([
      '$schema',
      'additionalProperties',
      '$id',
      '$ref',
      '$comment',
      'default',
      'examples',
      'title',
    ]);

    const clean: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(schema)) {
      if (disallowedKeys.has(key)) continue;

      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        clean[key] = McpClient.sanitizeSchema(value as Record<string, unknown>);
      } else if (Array.isArray(value)) {
        clean[key] = value.map((item) =>
          item !== null && typeof item === 'object' && !Array.isArray(item)
            ? McpClient.sanitizeSchema(item as Record<string, unknown>)
            : item,
        );
      } else {
        clean[key] = value;
      }
    }

    return clean;
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
