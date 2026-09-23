import { describe, expect, it, vi } from 'vitest';

vi.mock('node:os', () => ({
  homedir: () => 'C:\\Users\\felix',
}));

import { resolveVoiceProfileStoragePath } from './resolveVoiceProfileStoragePath.js';

describe('resolveVoiceProfileStoragePath', () => {
  it('points at Documents/alma/voice-profile under the current user home', () => {
    expect(resolveVoiceProfileStoragePath()).toBe('C:\\Users\\felix\\Documents\\alma\\voice-profile');
  });
});
