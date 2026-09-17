/**
 * Types for MCP server configuration (mcp_config.json).
 * Supports multiple transports: stdio, sse, streamableHttp.
 */

/**
 * An MCP server reached via stdio (spawning a child process).
 */
export interface StdioMcpServerConfig {
  transport: 'stdio';
  /** Executable command (e.g. "npx", "node", "python") */
  command: string;
  /** Command arguments */
  args?: string[];
  /** Environment variables for the spawned process */
  env?: Record<string, string>;
  /** Working directory */
  cwd?: string;
}

/**
 * An MCP server reached via Streamable HTTP (the current protocol).
 */
export interface StreamableHttpMcpServerConfig {
  transport: 'streamableHttp';
  /** MCP server URL (e.g. "http://localhost:30020/mcp") */
  url: string;
  /** Extra headers to send with each request */
  headers?: Record<string, string>;
}

/**
 * An MCP server reached via SSE (legacy 2024-11-05 protocol).
 */
export interface SseMcpServerConfig {
  transport: 'sse';
  /** SSE endpoint URL */
  url: string;
  /** Extra headers to send with each request */
  headers?: Record<string, string>;
}

/**
 * Union of every possible MCP server configuration.
 */
export type McpServerConfig = StdioMcpServerConfig | StreamableHttpMcpServerConfig | SseMcpServerConfig;

/**
 * Raw JSON entry before normalization (the `transport` field is optional).
 * Compatible with the Claude Desktop / Cursor / etc. config format.
 */
export type McpServerConfigRaw = McpServerConfig | Omit<StdioMcpServerConfig, 'transport'> & { transport?: string };

/**
 * Root shape of mcp_config.json. Keys are logical names for each server.
 */
export interface McpConfig {
  mcpServers: Record<string, McpServerConfig>;
}

/**
 * Raw shape of the file (transport may be missing).
 */
export interface McpConfigRaw {
  mcpServers: Record<string, McpServerConfigRaw>;
}
