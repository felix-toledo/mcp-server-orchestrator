/**
 * Tipos para la configuración de servidores MCP (mcp_config.json)
 * Soporta múltiples transportes: stdio, sse, streamableHttp
 */

/**
 * Servidor MCP que se conecta vía stdio (spawneando un proceso)
 */
export interface StdioMcpServerConfig {
  transport: 'stdio';
  /** Comando ejecutable (ej: "npx", "node", "python") */
  command: string;
  /** Argumentos del comando */
  args?: string[];
  /** Variables de entorno para el proceso */
  env?: Record<string, string>;
  /** Directorio de trabajo */
  cwd?: string;
}

/**
 * Servidor MCP que se conecta vía Streamable HTTP (protocolo actual)
 */
export interface StreamableHttpMcpServerConfig {
  transport: 'streamableHttp';
  /** URL del servidor MCP (ej: "http://localhost:3000/mcp") */
  url: string;
  /** Headers adicionales para las requests */
  headers?: Record<string, string>;
}

/**
 * Servidor MCP que se conecta vía SSE (protocolo legacy 2024-11-05)
 */
export interface SseMcpServerConfig {
  transport: 'sse';
  /** URL del endpoint SSE */
  url: string;
  /** Headers adicionales para las requests */
  headers?: Record<string, string>;
}

/**
 * Unión de todas las configuraciones posibles de un servidor MCP
 */
export type McpServerConfig = StdioMcpServerConfig | StreamableHttpMcpServerConfig | SseMcpServerConfig;

/**
 * Entrada raw del JSON antes de normalizar (el campo transport es opcional)
 * Compatible con formato Claude Desktop / Cursor / etc.
 */
export type McpServerConfigRaw = McpServerConfig | Omit<StdioMcpServerConfig, 'transport'> & { transport?: string };

/**
 * Estructura raíz del archivo mcp_config.json
 * Las keys son nombres lógicos para cada servidor
 */
export interface McpConfig {
  mcpServers: Record<string, McpServerConfig>;
}

/**
 * Estructura raw del archivo (transport puede no estar)
 */
export interface McpConfigRaw {
  mcpServers: Record<string, McpServerConfigRaw>;
}
