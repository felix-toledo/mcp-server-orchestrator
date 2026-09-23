import { beforeEach, describe, expect, it, vi } from 'vitest';

const { enrollVoiceProfileMock } = vi.hoisted(() => ({ enrollVoiceProfileMock: vi.fn() }));

vi.mock('../lib/knowledge-store-client', () => ({
  knowledgeStoreClient: { enrollVoiceProfile: enrollVoiceProfileMock },
}));

import { enrollVoiceProfile } from './enroll-voice-profile';

describe('enrollVoiceProfile', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns ok:true with status/trainedAt on a successful upload', async () => {
    enrollVoiceProfileMock.mockResolvedValue({
      status: 'TRAINED',
      trainedAt: '2026-09-22T10:00:00.000Z',
      enrollmentAudioPath: 'C:\\voice-profile\\sample.webm',
    });

    const formData = new FormData();
    formData.append('audio', new Blob(['fake-audio']), 'sample.webm');

    await expect(enrollVoiceProfile(formData)).resolves.toEqual({
      ok: true,
      status: 'TRAINED',
      trainedAt: '2026-09-22T10:00:00.000Z',
    });
    expect(enrollVoiceProfileMock).toHaveBeenCalledWith(formData);
  });

  it('returns ok:false without throwing when the client throws', async () => {
    enrollVoiceProfileMock.mockRejectedValue(new Error('knowledge-store down'));
    const formData = new FormData();

    const result = await enrollVoiceProfile(formData);

    expect(result).toEqual({ ok: false, error: 'knowledge-store down' });
  });

  it('returns ok:false when the response has no trainedAt', async () => {
    enrollVoiceProfileMock.mockResolvedValue({ status: 'NOT_TRAINED', trainedAt: null, enrollmentAudioPath: null });
    const formData = new FormData();

    const result = await enrollVoiceProfile(formData);

    expect(result.ok).toBe(false);
  });
});
