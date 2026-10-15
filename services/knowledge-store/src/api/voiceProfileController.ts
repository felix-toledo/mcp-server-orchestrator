import type { Request, Response } from 'express';
import multer from 'multer';
import type { VoiceProfileService } from '../services/voiceProfileService.js';
import { UpdateTtsPreferenceInputSchema, UpdateVoiceProfileInputSchema } from './schemas.js';

// This service's first multipart endpoint (voice-assistant/001-wake-word-channel
// plan §1) — memory storage since the controller only needs the buffer to
// hand off to VoiceProfileService.enroll, never a temp file on disk itself.
const upload = multer({ storage: multer.memoryStorage() });

export function createVoiceProfileController(voiceProfileService: VoiceProfileService) {
  return {
    uploadMiddleware: upload.single('audio'),

    get: async (_req: Request, res: Response): Promise<void> => {
      const profile = await voiceProfileService.get();
      if (!profile) {
        res.status(404).json({ error: 'No voice profile configured yet' });
        return;
      }
      res.status(200).json(profile);
    },

    enroll: async (req: Request, res: Response): Promise<void> => {
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: 'Missing audio file' });
        return;
      }
      const profile = await voiceProfileService.enroll(file.buffer, file.originalname);
      res.status(200).json(profile);
    },

    updateCurrentSession: async (req: Request, res: Response): Promise<void> => {
      const parsed = UpdateVoiceProfileInputSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid request body', details: parsed.error.issues });
        return;
      }
      try {
        const profile = await voiceProfileService.updateCurrentSession(parsed.data.currentSessionId);
        res.status(200).json(profile);
      } catch {
        res.status(404).json({ error: 'No voice profile configured yet' });
      }
    },

    updateTtsPreference: async (req: Request, res: Response): Promise<void> => {
      const parsed = UpdateTtsPreferenceInputSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid request body', details: parsed.error.issues });
        return;
      }
      try {
        const profile = await voiceProfileService.updateTtsPreference(
          parsed.data.ttsEngine,
          parsed.data.ttsVoiceId ?? null,
        );
        res.status(200).json(profile);
      } catch {
        res.status(400).json({ error: 'Cannot set a voice preference before onboarding' });
      }
    },

    reset: async (_req: Request, res: Response): Promise<void> => {
      await voiceProfileService.reset();
      res.status(204).send();
    },
  };
}
