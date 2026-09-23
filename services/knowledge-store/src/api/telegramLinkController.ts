import type { Request, Response } from 'express';
import type { TelegramLinkService } from '../services/telegramLinkService.js';
import { UpdateTelegramLinkBindingInputSchema, UpsertTelegramLinkInputSchema } from './schemas.js';

export function createTelegramLinkController(telegramLinkService: TelegramLinkService) {
  return {
    upsert: async (req: Request, res: Response): Promise<void> => {
      const parsed = UpsertTelegramLinkInputSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid request body', details: parsed.error.issues });
        return;
      }
      const link = await telegramLinkService.upsert(parsed.data.botToken, parsed.data.allowedUsernames);
      res.status(200).json(link);
    },

    get: async (_req: Request, res: Response): Promise<void> => {
      const link = await telegramLinkService.get();
      if (!link) {
        res.status(404).json({ error: 'No Telegram link configured yet' });
        return;
      }
      res.status(200).json(link);
    },

    updateBinding: async (req: Request, res: Response): Promise<void> => {
      const parsed = UpdateTelegramLinkBindingInputSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid request body', details: parsed.error.issues });
        return;
      }
      try {
        const link = await telegramLinkService.updateBinding(parsed.data);
        res.status(200).json(link);
      } catch {
        res.status(404).json({ error: 'No Telegram link configured yet' });
      }
    },
  };
}
