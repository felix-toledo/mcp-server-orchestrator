import { describe, expect, it, vi } from 'vitest';

vi.mock('node:os', () => ({
  homedir: () => 'C:\\Users\\felix',
}));

import { resolveVaultPath } from './resolveVaultPath.js';

describe('resolveVaultPath', () => {
  it('points at Documents/alma/vault under the current user home', () => {
    expect(resolveVaultPath()).toBe('C:\\Users\\felix\\Documents\\alma\\vault');
  });
});
