import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { KnowledgeStoreClient } from '../infraestructure/http/knowledgeStoreClient.js';
import { registerCreateKnowledgeEntryTool } from '../infraestructure/tools/createKnowledgeEntryTool.js';
import { registerHelloWorldTool } from '../infraestructure/tools/helloWorldTool.js';
import { registerSearchKnowledgeEntriesTool } from '../infraestructure/tools/searchKnowledgeEntriesTool.js';

const knowledgeStoreClient = new KnowledgeStoreClient(process.env.KNOWLEDGE_STORE_URL || 'http://localhost:30025');

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

  // Registramos las herramientas
  registerHelloWorldTool(server);
  registerCreateKnowledgeEntryTool(server, knowledgeStoreClient);
  registerSearchKnowledgeEntriesTool(server, knowledgeStoreClient);

  return server;
}
