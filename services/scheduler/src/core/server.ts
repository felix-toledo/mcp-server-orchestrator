import express, { Express, NextFunction, Request, Response } from 'express';
import { createRemindersController } from '../api/remindersController.js';
import type { ReminderService } from '../services/reminderService.js';
import { asyncHandler } from './asyncHandler.js';

export interface AppDependencies {
  reminderService: ReminderService;
}

export function createApp({ reminderService }: AppDependencies): Express {
  const remindersController = createRemindersController(reminderService);

  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.post('/reminders', asyncHandler(remindersController.create));
  app.get('/reminders', asyncHandler(remindersController.list));
  app.delete('/reminders/:id', asyncHandler(remindersController.remove));

  // Same class of bug knowledge-store hit and fixed (see its core/server.ts) —
  // never let a rejected route handler crash the whole process, especially
  // here where a crash would also kill pg-boss's in-process job worker.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error('❌ Unhandled error in scheduler request:', err);
    res.status(500).json({ error: 'Internal server error', message: err instanceof Error ? err.message : 'Unknown error' });
  });

  return app;
}
