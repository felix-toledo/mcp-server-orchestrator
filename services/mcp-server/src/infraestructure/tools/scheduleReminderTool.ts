import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { SchedulerClient } from '../http/schedulerClient.js';

const ScheduleReminderInputSchema = z.object({
  actionDescription: z
    .string()
    .min(1)
    .describe('Literal text to deliver when the reminder fires, exactly as it should read to the user'),
  schedule: z.discriminatedUnion('type', [
    z.object({
      type: z.literal('once').describe('A one-off reminder'),
      at: z
        .string()
        .datetime()
        .describe(
          'ISO 8601 UTC timestamp (must end in "Z") for when it should fire. Before computing a relative ' +
            'offset ("en 2 minutos", "mañana a las 9"), call get-current-time (if available) to get the real ' +
            'current date/time/timezone first — never guess "now," and always convert the final result to UTC, ' +
            'not the user\'s local time with a "Z" suffix slapped on.',
        ),
    }),
    z.object({
      type: z.literal('recurring').describe('A recurring reminder'),
      cron: z.string().min(1).describe('Standard cron expression, e.g. "30 15 * * *" for every day at 15:30'),
    }),
  ]),
});

type ScheduleReminderInput = z.infer<typeof ScheduleReminderInputSchema>;

export function registerScheduleReminderTool(server: McpServer, schedulerClient: SchedulerClient): void {
  server.registerTool(
    'scheduleReminder',
    {
      title: 'Schedule Reminder',
      description:
        'Creates a one-off or recurring reminder that gets delivered to the user over Telegram when it fires. ' +
        'Translate the user\'s phrasing ("mañana a las 9", "todos los días a las 15:30") into an explicit ISO ' +
        'timestamp or cron expression yourself — this tool does no natural-language parsing.',
      inputSchema: ScheduleReminderInputSchema.shape,
    },
    async (input: ScheduleReminderInput): Promise<CallToolResult> => {
      const validatedInput = ScheduleReminderInputSchema.parse(input);

      try {
        const reminder = await schedulerClient.createReminder(validatedInput);
        return {
          content: [{ type: 'text', text: `Recordatorio creado: "${reminder.actionDescription}" (id: ${reminder.id}).` }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `No pude crear el recordatorio: ${error instanceof Error ? error.message : 'error desconocido'}`,
            },
          ],
        };
      }
    },
  );
}
