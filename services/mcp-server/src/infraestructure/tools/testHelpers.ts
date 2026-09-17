import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

type ToolHandler = (input: unknown) => Promise<unknown>;

export interface FakeMcpServer {
  server: McpServer;
  getHandler: (toolName: string) => ToolHandler;
}

/**
 * A minimal double for McpServer that only implements registerTool,
 * capturing each tool's handler so it can be invoked directly in a test —
 * no real MCP protocol/transport involved.
 */
export function createFakeMcpServer(): FakeMcpServer {
  const handlers = new Map<string, ToolHandler>();

  const server = {
    registerTool: (name: string, _config: unknown, handler: ToolHandler) => {
      handlers.set(name, handler);
    },
  } as unknown as McpServer;

  return {
    server,
    getHandler: (toolName: string) => {
      const handler = handlers.get(toolName);
      if (!handler) {
        throw new Error(`No handler registered for tool "${toolName}"`);
      }
      return handler;
    },
  };
}
