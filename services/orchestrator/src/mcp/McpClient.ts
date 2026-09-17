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
   *
   * Las claves bajo "properties" son NOMBRES DE CAMPO, nunca metadatos del
   * schema — aunque coincidan textualmente con una clave de la disallow-list
   * (ej: un tool con un parámetro que se llama justo "title"). Tratarlas
   * igual que las claves meta borraba el parámetro entero antes de que
   * llegara al LLM (bug real: pasó con createKnowledgeEntry's "title").
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
      if (key === 'properties' && value !== null && typeof value === 'object' && !Array.isArray(value)) {
        const properties: Record<string, unknown> = {};
        for (const [propName, propDefinition] of Object.entries(value as Record<string, unknown>)) {
          properties[propName] =
            propDefinition !== null && typeof propDefinition === 'object' && !Array.isArray(propDefinition)
              ? McpClient.sanitizeSchema(propDefinition as Record<string, unknown>)
              : propDefinition;
        }
        clean[key] = properties;
        continue;
      }

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
   * Ejecuta una herramienta en el servidor MCP.
   *
   * Para streamableHttp, reintenta una vez tras reconectar si el error indica
   * una sesión MCP inválida — pasa en dev cuando el servidor MCP se reinicia
   * (ej: `--watch`) mientras este cliente sigue vivo con un Mcp-Session-Id
   * que el servidor, tras reiniciar, ya no reconoce. Bug real observado en
   * vivo (2026-09-18): sin este retry, cada llamada fallaba en silencio para
   * el resto de la vida del proceso del orchestrator hasta reiniciarlo a mano.
   * @param toolName Nombre de la herramienta
   * @param args Argumentos de la herramienta
   */
  async callTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
    if (!this.connected) {
      await this.connect();
    }

    try {
      return await this.client.callTool({ name: toolName, arguments: args });
    } catch (error) {
      if (McpClient.isStaleSessionError(error)) {
        console.warn(`⚠️ [${this.serverName}] Sesión MCP inválida, reconectando y reintentando...`);
        await this.reconnect();
        try {
          return await this.client.callTool({ name: toolName, arguments: args });
        } catch (retryError) {
          console.error(`Error al ejecutar la herramienta ${toolName} (tras reconectar):`, retryError);
          throw new Error(`Error al ejecutar la herramienta: ${retryError}`);
        }
      }

      console.error(`Error al ejecutar la herramienta ${toolName}:`, error);
      throw new Error(`Error al ejecutar la herramienta: ${error}`);
    }
  }

  private static isStaleSessionError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return /Mcp-Session-Id|session/i.test(message);
  }

  /**
   * Descarta la conexión/transporte actual y crea uno nuevo desde cero —
   * un `connect()` normal no alcanza porque StreamableHTTPClientTransport
   * mantiene el Mcp-Session-Id viejo internamente.
   */
  private async reconnect(): Promise<void> {
    try {
      await this.client.close();
    } catch {
      // best-effort: la conexión ya puede estar rota
    }

    this.connected = false;
    this.transport = McpClient.createTransport(this.config);
    this.client = new Client(
      { name: `orchestrator-client-${this.serverName}`, version: '1.0.0' },
      { capabilities: { tools: {} } },
    );
    await this.connect();
  }

  /**
   * Verifica si el cliente está conectado
   */
  isConnected(): boolean {
    return this.connected;
  }
}
