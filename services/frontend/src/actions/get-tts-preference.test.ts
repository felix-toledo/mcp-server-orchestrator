import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getVoiceProfileMock } = vi.hoisted(() => ({ getVoiceProfileMock: vi.fn() }));

vi.mock('../lib/knowledge-store-client', () => ({
  knowledgeStoreClient: { getVoiceProfile: getVoiceProfileMock },
}));

import { getTtsPreference } from './get-tts-preference';

describe('getTtsPreference', () => {
  beforeEach(() => vi.clearAllMocks());

  it('resolves with the engine/voice on the happy path', async () => {
    getVoiceProfileMock.mockResolvedValue({
      status: 'TRAINED',
      trainedAt: '2026-09-22T10:00:00.000Z',
      enrollmentAudioPath: 'C:\\voice-profile\\sample.webm',
      currentSessionId: null,
      ttsEngine: 'ELEVENLABS',
      ttsVoiceId: 'voice-123',
    });
    await expect(getTtsPreference()).resolves.toEqual({ ttsEngine: 'ELEVENLABS', ttsVoiceId: 'voice-123' });
  });

  it('fails open to KOKORO when no profile has been configured yet (null)', async () => {
    getVoiceProfileMock.mockResolvedValue(null);
    await expect(getTtsPreference()).resolves.toEqual({ ttsEngine: 'KOKORO', ttsVoiceId: null });
  });

  it('fails open to KOKORO, not throw, when knowledge-store is unreachable', async () => {
    getVoiceProfileMock.mockRejectedValue(new Error('fetch failed'));
    await expect(getTtsPreference()).resolves.toEqual({ ttsEngine: 'KOKORO', ttsVoiceId: null });
  });
});
