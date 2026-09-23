import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { KnowledgeStoreClient } from '../infraestructure/http/knowledgeStoreClient.js';
import { SchedulerClient } from '../infraestructure/http/schedulerClient.js';
import { registerCancelReminderTool } from '../infraestructure/tools/cancelReminderTool.js';
import { registerCreateKnowledgeEntryTool } from '../infraestructure/tools/createKnowledgeEntryTool.js';
import { registerCreateVaultFolderTool } from '../infraestructure/tools/createVaultFolderTool.js';
import { registerHelloWorldTool } from '../infraestructure/tools/helloWorldTool.js';
import { registerListRemindersTool } from '../infraestructure/tools/listRemindersTool.js';
import { registerScheduleReminderTool } from '../infraestructure/tools/scheduleReminderTool.js';
import { registerSearchKnowledgeEntriesTool } from '../infraestructure/tools/searchKnowledgeEntriesTool.js';

const knowledgeStoreClient = new KnowledgeStoreClient(process.env.KNOWLEDGE_STORE_URL || 'http://localhost:30025');
const schedulerClient = new SchedulerClient(process.env.SCHEDULER_URL || 'http://localhost:30026');

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
  registerCreateVaultFolderTool(server, knowledgeStoreClient);
  registerScheduleReminderTool(server, schedulerClient);
  registerListRemindersTool(server, schedulerClient);
  registerCancelReminderTool(server, schedulerClient);

  return server;
}
