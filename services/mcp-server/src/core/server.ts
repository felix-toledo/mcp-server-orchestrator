import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerHelloWorldTool } from '../infraestructure/tools/helloWorldTool.js';

/**
 * Crea y configura una nueva instancia del servidor MCP.
 * Aquí es donde centralizaremos el registro de todas nuestras herramientas.
 * @returns Una instancia de McpServer configurada.
 */
export async function createMcpServer(): Promise<McpServer> {
  // Inicializamos el servidor con su información básica
  const server = new McpServer({
    name: 'mcp-server-sma',
    version: '1.0.0',
  });

  // Registramos la herramienta hello world
  registerHelloWorldTool(server);

  return server;
}
