import { describe, expect, it, vi } from 'vitest';
import { createFetchProfileNoteNode } from './fetchProfileNote.js';

describe('createFetchProfileNoteNode', () => {
  it('returns the profile note content when one exists', async () => {
    const knowledgeStoreClient = { getProfileNote: vi.fn().mockResolvedValue({ title: 'Perfil', content: '- Mi novia: Melisa' }) };
    const node = createFetchProfileNoteNode({ knowledgeStoreClient });

    await expect(node()).resolves.toEqual({ profileNote: '- Mi novia: Melisa' });
  });

  it('returns null when no profile note exists yet', async () => {
    const knowledgeStoreClient = { getProfileNote: vi.fn().mockResolvedValue(null) };
    const node = createFetchProfileNoteNode({ knowledgeStoreClient });

    await expect(node()).resolves.toEqual({ profileNote: null });
  });
});
