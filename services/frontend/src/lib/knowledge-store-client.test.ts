import { beforeEach, describe, expect, it, vi } from 'vitest';
import { KnowledgeStoreClient } from './knowledge-store-client';

describe('KnowledgeStoreClient', () => {
  const baseUrl = 'http://localhost:30025';
  let client: KnowledgeStoreClient;

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    client = new KnowledgeStoreClient(baseUrl);
  });

  it('createUser resolves on 201', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ id: 'u1' }), { status: 201 }));
    const result = await client.createUser({ name: 'Felix', email: 'f@x.com', purpose: 'PERSONAL_DAILY' });
    expect(result.id).toBe('u1');
    expect(fetch).toHaveBeenCalledWith(`${baseUrl}/users`, expect.objectContaining({ method: 'POST' }));
  });

  it('createUser throws a recognizable error on 409', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: 'A user already exists' }), { status: 409 }),
    );
    await expect(
      client.createUser({ name: 'Felix', email: 'f@x.com', purpose: 'PERSONAL_DAILY' }),
    ).rejects.toThrow(/A user already exists/);
  });

  it('getCurrentUser returns null on 404', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 404 }));
    await expect(client.getCurrentUser()).resolves.toBeNull();
  });

  it('getCurrentUser returns the user on 200', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ id: 'u1' }), { status: 200 }));
    await expect(client.getCurrentUser()).resolves.toEqual({ id: 'u1' });
  });

  it('createKnowledgeEntry resolves on 201', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ id: 'k1', path: 'nota.md' }), { status: 201 }),
    );
    const result = await client.createKnowledgeEntry({ title: 'Nota', content: 'contenido' });
    expect(result.path).toBe('nota.md');
  });

  it('listKnowledgeEntries returns the list', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify([{ id: 'k1' }]), { status: 200 }));
    await expect(client.listKnowledgeEntries()).resolves.toEqual([{ id: 'k1' }]);
  });

  it('getKnowledgeEntry returns null on 404', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 404 }));
    await expect(client.getKnowledgeEntry('missing')).resolves.toBeNull();
  });

  it('updateKnowledgeEntry resolves on 200', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ id: 'k1' }), { status: 200 }));
    await expect(client.updateKnowledgeEntry('k1', 'nuevo contenido')).resolves.toEqual({ id: 'k1' });
  });

  it('listChatSessions returns the list', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify([{ id: 's1' }]), { status: 200 }));
    await expect(client.listChatSessions()).resolves.toEqual([{ id: 's1' }]);
  });

  it('getChatSession returns null on 404', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 404 }));
    await expect(client.getChatSession('missing')).resolves.toBeNull();
  });

  it('getChatSession returns the session on 200', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ id: 's1', messages: [] }), { status: 200 }));
    await expect(client.getChatSession('s1')).resolves.toEqual({ id: 's1', messages: [] });
  });

  it('deleteChatSession resolves on 204', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }));
    await expect(client.deleteChatSession('s1')).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledWith(`${baseUrl}/chat-sessions/s1`, expect.objectContaining({ method: 'DELETE' }));
  });

  it('listVaultFolders returns the list', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify([{ id: 'f1' }]), { status: 200 }));
    await expect(client.listVaultFolders()).resolves.toEqual([{ id: 'f1' }]);
  });

  it('createVaultFolder resolves on 201', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ id: 'f1', path: 'proyectos' }), { status: 201 }));
    await expect(client.createVaultFolder('proyectos')).resolves.toEqual({ id: 'f1', path: 'proyectos' });
  });

  it('deleteVaultFolder resolves on 204', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }));
    await expect(client.deleteVaultFolder('f1')).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledWith(`${baseUrl}/vault-folders/f1`, expect.objectContaining({ method: 'DELETE' }));
  });

  it('getVoiceProfile returns the profile on 200, including status and trainedAt', async () => {
    const profile = {
      status: 'TRAINED',
      trainedAt: '2026-09-22T10:00:00.000Z',
      enrollmentAudioPath: 'C:\\voice-profile\\sample.webm',
      currentSessionId: null,
    };
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(profile), { status: 200 }));
    await expect(client.getVoiceProfile()).resolves.toEqual(profile);
    expect(fetch).toHaveBeenCalledWith(`${baseUrl}/voice-profile`, expect.objectContaining({ cache: 'no-store' }));
  });

  it('getVoiceProfile returns null on 404 (no profile enrolled yet)', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 404 }));
    await expect(client.getVoiceProfile()).resolves.toBeNull();
  });

  it('getVoiceProfile throws a recognizable error on a non-2xx, non-404 status', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ error: 'boom' }), { status: 500 }));
    await expect(client.getVoiceProfile()).rejects.toThrow(/boom/);
  });

  it('enrollVoiceProfile posts the given FormData as multipart and resolves with status/trainedAt', async () => {
    const result = {
      status: 'TRAINED',
      trainedAt: '2026-09-22T10:00:00.000Z',
      enrollmentAudioPath: 'C:\\voice-profile\\sample.webm',
    };
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(result), { status: 200 }));
    const formData = new FormData();
    formData.append('audio', new Blob(['fake-audio']), 'sample.webm');

    await expect(client.enrollVoiceProfile(formData)).resolves.toEqual(result);
    expect(fetch).toHaveBeenCalledWith(
      `${baseUrl}/voice-profile/enroll`,
      expect.objectContaining({ method: 'POST', body: formData }),
    );
  });

  it('enrollVoiceProfile throws a recognizable error on a non-2xx status', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ error: 'file too large' }), { status: 400 }));
    const formData = new FormData();
    formData.append('audio', new Blob(['fake-audio']), 'sample.webm');
    await expect(client.enrollVoiceProfile(formData)).rejects.toThrow(/file too large/);
  });

  it('updateTtsPreference PATCHes the engine/voice choice and resolves with the profile', async () => {
    const profile = {
      status: 'NOT_TRAINED',
      trainedAt: null,
      enrollmentAudioPath: null,
      currentSessionId: null,
      ttsEngine: 'ELEVENLABS',
      ttsVoiceId: 'voice-123',
    };
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(profile), { status: 200 }));

    await expect(client.updateTtsPreference('ELEVENLABS', 'voice-123')).resolves.toEqual(profile);
    expect(fetch).toHaveBeenCalledWith(
      `${baseUrl}/voice-profile/tts-preference`,
      expect.objectContaining({
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ttsEngine: 'ELEVENLABS', ttsVoiceId: 'voice-123' }),
      }),
    );
  });

  it('updateTtsPreference throws a recognizable error on a non-2xx status', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ error: 'invalid voice' }), { status: 400 }));
    await expect(client.updateTtsPreference('ELEVENLABS', 'bad-id')).rejects.toThrow(/invalid voice/);
  });
});
