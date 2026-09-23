import { z } from 'zod';

// spec AC1's HTTP contract uses lowercase `type` values ('once'/'recurring');
// the Prisma enum (ReminderScheduleType) is uppercase — ReminderService's own
// CreateReminderInput matches the enum directly, so the controller maps
// between the two, not this schema.
export const CreateReminderInputSchema = z.object({
  actionDescription: z.string().min(1),
  schedule: z.discriminatedUnion('type', [
    z.object({ type: z.literal('once'), at: z.string().datetime() }),
    z.object({ type: z.literal('recurring'), cron: z.string().min(1) }),
  ]),
});

export type CreateReminderInputBody = z.infer<typeof CreateReminderInputSchema>;
