import type { Request, Response } from 'express';
import type { ChatSessionService } from '../services/chatSessionService.js';
import { AppendChatMessageInputSchema, CreateChatSessionInputSchema } from './schemas.js';

export function createChatSessionsController(chatSessionService: ChatSessionService) {
  return {
    create: async (req: Request, res: Response): Promise<void> => {
      const parsed = CreateChatSessionInputSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid request body', details: parsed.error.issues });
        return;
      }
      const session = await chatSessionService.create(parsed.data.teamId);
      res.status(201).json(session);
    },

    list: async (_req: Request, res: Response): Promise<void> => {
      const sessions = await chatSessionService.list();
      res.status(200).json(sessions);
    },

    getById: async (req: Request, res: Response): Promise<void> => {
      const session = await chatSessionService.getById(req.params.id);
      if (!session) {
        res.status(404).json({ error: 'Chat session not found' });
        return;
      }
      res.status(200).json(session);
    },

    appendMessage: async (req: Request, res: Response): Promise<void> => {
      const parsed = AppendChatMessageInputSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid request body', details: parsed.error.issues });
        return;
      }
      try {
        const message = await chatSessionService.appendMessage(req.params.id, parsed.data);
        res.status(201).json(message);
      } catch {
        res.status(404).json({ error: 'Chat session not found' });
      }
    },

    remove: async (req: Request, res: Response): Promise<void> => {
      try {
        await chatSessionService.delete(req.params.id);
        res.status(204).send();
      } catch {
        res.status(404).json({ error: 'Chat session not found' });
      }
    },
  };
}
