import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mkdirMock, writeFileMock } = vi.hoisted(() => ({
  mkdirMock: vi.fn(),
  writeFileMock: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  mkdir: mkdirMock,
  writeFile: writeFileMock,
}));

import { VoiceProfileStorage } from './voiceProfileStorage.js';

describe('VoiceProfileStorage', () => {
  const storageRoot = 'C:\\voice-profile';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes the sample to a fixed enrollment filename, preserving the upload extension', async () => {
    const storage = new VoiceProfileStorage(storageRoot);
    const buffer = Buffer.from('audio bytes');

    const result = await storage.write(buffer, 'sample.wav');

    expect(mkdirMock).toHaveBeenCalledWith(storageRoot, { recursive: true });
    expect(writeFileMock).toHaveBeenCalledWith(`${storageRoot}\\enrollment.wav`, buffer);
    expect(result.path).toBe(`${storageRoot}\\enrollment.wav`);
  });

  it('defaults to .wav when the upload has no extension', async () => {
    const storage = new VoiceProfileStorage(storageRoot);

    const result = await storage.write(Buffer.from('audio bytes'), 'sample');

    expect(result.path).toBe(`${storageRoot}\\enrollment.wav`);
  });

  it('re-enrolling overwrites the same fixed filename (single-profile system)', async () => {
    const storage = new VoiceProfileStorage(storageRoot);

    await storage.write(Buffer.from('first'), 'a.m4a');
    await storage.write(Buffer.from('second'), 'b.m4a');

    expect(writeFileMock).toHaveBeenNthCalledWith(1, `${storageRoot}\\enrollment.m4a`, Buffer.from('first'));
    expect(writeFileMock).toHaveBeenNthCalledWith(2, `${storageRoot}\\enrollment.m4a`, Buffer.from('second'));
  });
});
