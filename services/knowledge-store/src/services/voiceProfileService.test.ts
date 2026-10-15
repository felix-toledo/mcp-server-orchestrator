import type { PrismaClient } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { VoiceProfileStorage } from '../voiceProfile/voiceProfileStorage.js';
import type { UserService } from './userService.js';
import { VoiceProfileService } from './voiceProfileService.js';

function createPrismaMock() {
  return {
    voiceProfile: {
      findFirst: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
  };
}

describe('VoiceProfileService', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let userService: { getCurrent: ReturnType<typeof vi.fn> };
  let storage: { write: ReturnType<typeof vi.fn> };
  let service: VoiceProfileService;

  beforeEach(() => {
    prisma = createPrismaMock();
    userService = { getCurrent: vi.fn().mockResolvedValue({ id: 'user-1' }) };
    storage = { write: vi.fn().mockResolvedValue({ path: 'C:\\voice-profile\\enrollment.wav' }) };
    service = new VoiceProfileService(
      prisma as unknown as PrismaClient,
      userService as unknown as UserService,
      storage as unknown as VoiceProfileStorage,
    );
  });

  describe('get', () => {
    it('returns null when no profile is configured yet (AC3 "runs, never forwards" case)', async () => {
      prisma.voiceProfile.findFirst.mockResolvedValue(null);
      await expect(service.get()).resolves.toBeNull();
    });

    it('returns the configured profile', async () => {
      prisma.voiceProfile.findFirst.mockResolvedValue({
        id: 'v1',
        status: 'TRAINED',
        enrollmentAudioPath: 'C:\\voice-profile\\enrollment.wav',
        currentSessionId: 's1',
        trainedAt: new Date('2026-09-22T00:00:00Z'),
      });
      const result = await service.get();
      expect(result?.status).toBe('TRAINED');
    });
  });

  describe('enroll', () => {
    it('writes the sample to disk and sets status: TRAINED + trainedAt', async () => {
      const trainedAt = new Date('2026-09-22T00:00:00Z');
      prisma.voiceProfile.upsert.mockResolvedValue({
        id: 'v1',
        status: 'TRAINED',
        enrollmentAudioPath: 'C:\\voice-profile\\enrollment.wav',
        currentSessionId: null,
        trainedAt,
      });

      const buffer = Buffer.from('audio bytes');
      const result = await service.enroll(buffer, 'sample.wav');

      expect(storage.write).toHaveBeenCalledWith(buffer, 'sample.wav');
      expect(prisma.voiceProfile.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1' },
          create: expect.objectContaining({ status: 'TRAINED', enrollmentAudioPath: 'C:\\voice-profile\\enrollment.wav' }),
          update: expect.objectContaining({ status: 'TRAINED', enrollmentAudioPath: 'C:\\voice-profile\\enrollment.wav' }),
        }),
      );
      expect(result.status).toBe('TRAINED');
      expect(result.enrollmentAudioPath).toBe('C:\\voice-profile\\enrollment.wav');
    });

    it('throws when no user has completed onboarding yet', async () => {
      userService.getCurrent.mockResolvedValue(null);
      await expect(service.enroll(Buffer.from('x'), 'x.wav')).rejects.toThrow(/onboarding/);
      expect(storage.write).not.toHaveBeenCalled();
    });
  });

  describe('updateCurrentSession', () => {
    it('only touches currentSessionId and nothing else', async () => {
      prisma.voiceProfile.findFirst.mockResolvedValue({ id: 'v1' });
      prisma.voiceProfile.update.mockResolvedValue({
        id: 'v1',
        status: 'TRAINED',
        enrollmentAudioPath: 'C:\\voice-profile\\enrollment.wav',
        currentSessionId: 's2',
        trainedAt: new Date('2026-09-22T00:00:00Z'),
      });

      const result = await service.updateCurrentSession('s2');

      expect(prisma.voiceProfile.update).toHaveBeenCalledWith({ where: { id: 'v1' }, data: { currentSessionId: 's2' } });
      expect(result.currentSessionId).toBe('s2');
    });

    it('throws when no profile is configured yet', async () => {
      prisma.voiceProfile.findFirst.mockResolvedValue(null);
      await expect(service.updateCurrentSession('s2')).rejects.toThrow(/No voice profile configured/);
    });
  });

  describe('updateTtsPreference', () => {
    it('upserts the engine/voice choice, no prior enrollment required', async () => {
      prisma.voiceProfile.upsert.mockResolvedValue({
        id: 'v1',
        status: 'NOT_TRAINED',
        enrollmentAudioPath: null,
        currentSessionId: null,
        trainedAt: null,
        ttsEngine: 'ELEVENLABS',
        ttsVoiceId: 'voice-123',
      });

      const result = await service.updateTtsPreference('ELEVENLABS', 'voice-123');

      expect(prisma.voiceProfile.upsert).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        create: { userId: 'user-1', ttsEngine: 'ELEVENLABS', ttsVoiceId: 'voice-123' },
        update: { ttsEngine: 'ELEVENLABS', ttsVoiceId: 'voice-123' },
      });
      expect(result.ttsEngine).toBe('ELEVENLABS');
      expect(result.ttsVoiceId).toBe('voice-123');
    });

    it('throws when no user has completed onboarding yet', async () => {
      userService.getCurrent.mockResolvedValue(null);
      await expect(service.updateTtsPreference('KOKORO', null)).rejects.toThrow(/onboarding/);
      expect(prisma.voiceProfile.upsert).not.toHaveBeenCalled();
    });
  });

  describe('reset', () => {
    it('clears status, trainedAt, and enrollmentAudioPath', async () => {
      prisma.voiceProfile.findFirst.mockResolvedValue({ id: 'v1' });
      prisma.voiceProfile.update.mockResolvedValue({});

      await service.reset();

      expect(prisma.voiceProfile.update).toHaveBeenCalledWith({
        where: { id: 'v1' },
        data: { status: 'NOT_TRAINED', enrollmentAudioPath: null, trainedAt: null },
      });
    });

    it('is a no-op when no profile is configured yet', async () => {
      prisma.voiceProfile.findFirst.mockResolvedValue(null);
      await service.reset();
      expect(prisma.voiceProfile.update).not.toHaveBeenCalled();
    });
  });
});
