import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getVoiceProfileMock } = vi.hoisted(() => ({ getVoiceProfileMock: vi.fn() }));

vi.mock('../lib/knowledge-store-client', () => ({
  knowledgeStoreClient: { getVoiceProfile: getVoiceProfileMock },
}));

import { getVoiceProfileStatus } from './get-voice-profile-status';

describe('getVoiceProfileStatus', () => {
  beforeEach(() => vi.clearAllMocks());

  it('resolves with the status/trainedAt on the happy path', async () => {
    getVoiceProfileMock.mockResolvedValue({
      status: 'TRAINED',
      trainedAt: '2026-09-22T10:00:00.000Z',
      enrollmentAudioPath: 'C:\\voice-profile\\sample.webm',
      currentSessionId: null,
    });
    await expect(getVoiceProfileStatus()).resolves.toEqual({
      status: 'TRAINED',
      trainedAt: '2026-09-22T10:00:00.000Z',
    });
  });

  it('fails open to NOT_TRAINED when no profile has been enrolled yet (null)', async () => {
    getVoiceProfileMock.mockResolvedValue(null);
    await expect(getVoiceProfileStatus()).resolves.toEqual({ status: 'NOT_TRAINED', trainedAt: null });
  });

  it('fails open to NOT_TRAINED, not throw, when knowledge-store is unreachable', async () => {
    getVoiceProfileMock.mockRejectedValue(new Error('fetch failed'));
    await expect(getVoiceProfileStatus()).resolves.toEqual({ status: 'NOT_TRAINED', trainedAt: null });
  });
});
