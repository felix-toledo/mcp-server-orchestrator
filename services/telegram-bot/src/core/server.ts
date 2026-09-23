import express, { Express, NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import type { KnowledgeStoreClient } from '../infrastructure/knowledgeStoreClient.js';
import type { TelegramRuntime } from './telegramRuntime.js';
import { asyncHandler } from './asyncHandler.js';

const ConfigInputSchema = z.object({
  botToken: z.string().min(1),
  allowedUsernames: z.array(z.string()).optional(),
});
const PushInputSchema = z.object({ text: z.string().min(1) });

export interface AppDependencies {
  knowledgeStoreClient: KnowledgeStoreClient;
  telegramRuntime: TelegramRuntime;
}

export function createApp({ knowledgeStoreClient, telegramRuntime }: AppDependencies): Express {
  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  // AC1 — persists the token via knowledge-store, then (re)starts polling with it.
  app.put(
    '/config',
    asyncHandler(async (req, res) => {
      const parsed = ConfigInputSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid request body', details: parsed.error.issues });
        return;
      }
      await knowledgeStoreClient.upsertTelegramLink(parsed.data.botToken, parsed.data.allowedUsernames);
      await telegramRuntime.start(parsed.data.botToken);
      res.status(200).json({ status: 'ok' });
    }),
  );

  // Settings UX fix (2026-09-17) — lets the frontend show "already
  // connected" + a link/QR to the bot instead of always re-prompting for
  // a token. Never exposes the raw botToken.
  app.get(
    '/status',
    asyncHandler(async (_req, res) => {
      const link = await knowledgeStoreClient.getTelegramLink();
      res.status(200).json({
        configured: Boolean(link),
        botUsername: telegramRuntime.getBotUsername(),
        chatId: link?.chatId ?? null,
        allowedUsernames: link?.allowedUsernames ?? [],
      });
    }),
  );

  // AC4 — internal only (scheduler → here), never exposed to the LLM or the frontend.
  app.post(
    '/push',
    asyncHandler(async (req, res) => {
      const parsed = PushInputSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid request body', details: parsed.error.issues });
        return;
      }
      const result = await telegramRuntime.push(parsed.data.text);
      res.status(200).json(result);
    }),
  );

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error('❌ Unhandled error in telegram-bot request:', err);
    res.status(500).json({ error: 'Internal server error', message: err instanceof Error ? err.message : 'Unknown error' });
  });

  return app;
}
