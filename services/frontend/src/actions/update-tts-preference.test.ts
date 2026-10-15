import { beforeEach, describe, expect, it, vi } from 'vitest';

const { updateTtsPreferenceMock } = vi.hoisted(() => ({ updateTtsPreferenceMock: vi.fn() }));

vi.mock('../lib/knowledge-store-client', () => ({
  knowledgeStoreClient: { updateTtsPreference: updateTtsPreferenceMock },
}));

import { updateTtsPreference } from './update-tts-preference';

describe('updateTtsPreference', () => {
  beforeEach(() => vi.clearAllMocks());

  it('resolves ok on success', async () => {
    updateTtsPreferenceMock.mockResolvedValue({
      status: 'NOT_TRAINED',
      trainedAt: null,
      enrollmentAudioPath: null,
      currentSessionId: null,
      ttsEngine: 'ELEVENLABS',
      ttsVoiceId: 'voice-123',
    });
    await expect(updateTtsPreference('ELEVENLABS', 'voice-123')).resolves.toEqual({ ok: true });
    expect(updateTtsPreferenceMock).toHaveBeenCalledWith('ELEVENLABS', 'voice-123');
  });

  it('resolves with an error message when the client call rejects', async () => {
    updateTtsPreferenceMock.mockRejectedValue(new Error('invalid voice'));
    await expect(updateTtsPreference('ELEVENLABS', 'bad-id')).resolves.toEqual({ ok: false, error: 'invalid voice' });
  });
});
