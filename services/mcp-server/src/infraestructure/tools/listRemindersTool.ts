import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { SchedulerClient } from '../http/schedulerClient.js';

export function registerListRemindersTool(server: McpServer, schedulerClient: SchedulerClient): void {
  server.registerTool(
    'listReminders',
    {
      title: 'List Reminders',
      description: "Lists the user's configured reminders — one-off and recurring, active or not.",
      inputSchema: {},
    },
    async (): Promise<CallToolResult> => {
      try {
        const reminders = await schedulerClient.listReminders();
        return { content: [{ type: 'text', text: JSON.stringify(reminders) }] };
      } catch (error) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `No pude listar los recordatorios: ${error instanceof Error ? error.message : 'error desconocido'}`,
            },
          ],
        };
      }
    },
  );
}
