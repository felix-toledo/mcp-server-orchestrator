import fs from 'fs';
import path from 'path';
import { McpClient } from './McpClient.js';
import { McpConfig, McpConfigRaw, McpServerConfig, McpServerConfigRaw } from './McpConfigTypes.js';
import { LlmToolDefinition } from '../llm/ILlmProvider.js';

/**
 * Herramienta con metadata del servidor que la provee
 */
export interface ToolWithOrigin {
  tool: LlmToolDefinition;
  serverName: string;
}

/**
 * Gestiona múltiples conexiones MCP a partir de un archivo mcp_config.json
 * Agrega las herramientas de todos los servidores y rutea las llamadas al servidor correcto
 */
export class McpManager {
  private clients: Map<string, McpClient> = new Map();
  private toolRegistry: Map<string, ToolWithOrigin> = new Map();
  private connectedServers: string[] = [];

  /**
   * Carga la configuración desde un archivo JSON
   * Busca en orden: ruta proporcionada, variable de entorno MCP_CONFIG_PATH, o rutas por defecto
   */
  static loadConfig(configPath?: string): McpConfig {
    const paths = [
      configPath,
      process.env.MCP_CONFIG_PATH,
      path.resolve(process.cwd(), 'mcp_config.json'),
      path.resolve(process.cwd(), '.mcp_config.json'),
      path.resolve(process.cwd(), 'mcp.config.json'),
    ].filter(Boolean) as string[];

    for (const p of paths) {
      if (fs.existsSync(p)) {
        console.log(`📄 Cargando configuración MCP desde ${p}`);
        const raw = fs.readFileSync(p, 'utf-8');
        const parsed = JSON.parse(raw) as McpConfigRaw;
        return McpManager.normalizeConfig(parsed);
      }
    }

    throw new Error(
      'No se encontró mcp_config.json. Crea uno en la raíz del proyecto o usa MCP_CONFIG_PATH.',
    );
  }

  /**
   * Normaliza la configuración raw: auto-detecta el transport si no está definido
   * Compatible con formato Claude Desktop / Cursor (sin campo "transport")
   *   - Si tiene "command" → stdio
   *   - Si tiene "url" → streamableHttp
   */
  private static normalizeConfig(raw: McpConfigRaw): McpConfig {
    const normalized: McpConfig = { mcpServers: {} };

    for (const [name, entry] of Object.entries(raw.mcpServers)) {
      const config = entry as Record<string, any>;

      if (config.transport) {
        // Transport explícito, usar directamente
        normalized.mcpServers[name] = config as McpServerConfig;
      } else if (config.command) {
        // Auto-detect: tiene command → stdio
        normalized.mcpServers[name] = { ...config, transport: 'stdio' } as McpServerConfig;
        console.log(`   ℹ️ "${name}": transport auto-detectado → stdio`);
      } else if (config.url) {
        // Auto-detect: tiene url → streamableHttp
        normalized.mcpServers[name] = { ...config, transport: 'streamableHttp' } as McpServerConfig;
        console.log(`   ℹ️ "${name}": transport auto-detectado → streamableHttp`);
      } else {
        console.warn(`   ⚠️ "${name}": No se pudo determinar el tipo de transporte. Necesita "command" o "url".`);
      }
    }

    return normalized;
  }

  /**
   * Inicializa el manager desde un archivo de configuración
   * Conecta a todos los servidores configurados (los que fallen se omiten)
   */
  static async fromConfig(configPath?: string): Promise<McpManager> {
    const config = McpManager.loadConfig(configPath);
    const manager = new McpManager();
    await manager.connectAll(config);
    return manager;
  }

  /**
   * Conecta a todos los servidores definidos en la configuración
   * Los servidores que fallen se omiten con un warning (no bloquean el resto)
   */
  async connectAll(config: McpConfig): Promise<void> {
    const entries = Object.entries(config.mcpServers);

    if (entries.length === 0) {
      console.warn('⚠️ No hay servidores MCP configurados en mcp_config.json');
      return;
    }

    console.log(`\n🔧 Conectando a ${entries.length} servidor(es) MCP en paralelo...`);

    await Promise.allSettled(
      entries.map(([name, serverConfig]) => this.connectServer(name, serverConfig)),
    );

    console.log(
      `\n📊 Resumen: ${this.connectedServers.length}/${entries.length} servidores conectados`,
    );

    if (this.toolRegistry.size > 0) {
      console.log(`🔧 Total de herramientas disponibles: ${this.toolRegistry.size}`);
      for (const [toolName, info] of this.toolRegistry) {
        console.log(`   • ${toolName} (de "${info.serverName}")`);
      }
    }
  }

  /**
   * Conecta a un servidor MCP individual y registra sus herramientas
   */
  async connectServer(name: string, config: McpServerConfig): Promise<void> {
    try {
      const client = new McpClient(name, config);
      await client.connect();

      // Obtener y registrar herramientas
      const tools = await client.getTools();
      this.clients.set(name, client);
      this.connectedServers.push(name);

      for (const tool of tools) {
        if (this.toolRegistry.has(tool.name)) {
          const existing = this.toolRegistry.get(tool.name)!;
          console.warn(
            `⚠️ Herramienta "${tool.name}" duplicada: "${name}" sobreescribe a "${existing.serverName}"`,
          );
        }
        this.toolRegistry.set(tool.name, { tool, serverName: name });
      }

      console.log(`   ✅ "${name}": ${tools.length} herramienta(s)`);
    } catch (error) {
      console.warn(`   ⚠️ "${name}": Error al conectar - ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Retorna todas las herramientas disponibles de todos los servidores conectados
   */
  getAllTools(): LlmToolDefinition[] {
    return Array.from(this.toolRegistry.values()).map((t) => t.tool);
  }

  /**
   * Ejecuta una herramienta, ruteando automáticamente al servidor correcto
   */
  async callTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
    const entry = this.toolRegistry.get(toolName);

    if (!entry) {
      throw new Error(
        `Herramienta "${toolName}" no encontrada en ningún servidor MCP conectado`,
      );
    }

    const client = this.clients.get(entry.serverName);
    if (!client) {
      throw new Error(
        `El servidor "${entry.serverName}" para la herramienta "${toolName}" no está disponible`,
      );
    }

    return client.callTool(toolName, args);
  }

  /**
   * Indica si hay al menos un servidor conectado con herramientas
   */
  hasTools(): boolean {
    return this.toolRegistry.size > 0;
  }

  /**
   * Retorna el número de servidores conectados
   */
  getConnectedServerCount(): number {
    return this.connectedServers.length;
  }

  /**
   * Retorna los nombres de los servidores conectados
   */
  getConnectedServerNames(): string[] {
    return [...this.connectedServers];
  }

  /**
   * Desconecta todos los servidores MCP
   */
  async disconnectAll(): Promise<void> {
    for (const [name, client] of this.clients) {
      try {
        await client.disconnect();
      } catch (error) {
        console.warn(`⚠️ Error al desconectar "${name}":`, error);
      }
    }
    this.clients.clear();
    this.toolRegistry.clear();
    this.connectedServers = [];
  }
}
