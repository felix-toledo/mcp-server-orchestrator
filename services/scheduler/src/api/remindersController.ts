import type { Request, Response } from 'express';
import type { CreateReminderInput, ReminderService } from '../services/reminderService.js';
import { CreateReminderInputSchema } from './schemas.js';

function toServiceInput(body: { actionDescription: string; schedule: { type: 'once' | 'recurring'; at?: string; cron?: string } }): CreateReminderInput {
  return {
    actionDescription: body.actionDescription,
    schedule:
      body.schedule.type === 'once'
        ? { type: 'ONCE', at: body.schedule.at! }
        : { type: 'RECURRING', cron: body.schedule.cron! },
  };
}

export function createRemindersController(reminderService: ReminderService) {
  return {
    create: async (req: Request, res: Response): Promise<void> => {
      const parsed = CreateReminderInputSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid request body', details: parsed.error.issues });
        return;
      }
      const reminder = await reminderService.create(toServiceInput(parsed.data));
      res.status(201).json(reminder);
    },

    list: async (_req: Request, res: Response): Promise<void> => {
      const reminders = await reminderService.list();
      res.status(200).json(reminders);
    },

    remove: async (req: Request, res: Response): Promise<void> => {
      try {
        await reminderService.delete(req.params.id);
        res.status(204).send();
      } catch {
        res.status(404).json({ error: 'Reminder not found' });
      }
    },
  };
}
