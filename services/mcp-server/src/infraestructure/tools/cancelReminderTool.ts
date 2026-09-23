import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { SchedulerClient } from '../http/schedulerClient.js';

const CancelReminderInputSchema = z.object({
  id: z.string().min(1).describe('The id of the reminder to cancel, from listReminders'),
});

type CancelReminderInput = z.infer<typeof CancelReminderInputSchema>;

export function registerCancelReminderTool(server: McpServer, schedulerClient: SchedulerClient): void {
  server.registerTool(
    'cancelReminder',
    {
      title: 'Cancel Reminder',
      description: 'Cancels an existing reminder by id — stops it from firing again and removes it.',
      inputSchema: CancelReminderInputSchema.shape,
    },
    async (input: CancelReminderInput): Promise<CallToolResult> => {
      const validatedInput = CancelReminderInputSchema.parse(input);

      try {
        await schedulerClient.deleteReminder(validatedInput.id);
        return { content: [{ type: 'text', text: `Recordatorio ${validatedInput.id} cancelado.` }] };
      } catch (error) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `No pude cancelar el recordatorio: ${error instanceof Error ? error.message : 'error desconocido'}`,
            },
          ],
        };
      }
    },
  );
}
