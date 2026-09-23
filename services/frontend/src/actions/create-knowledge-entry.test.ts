import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createKnowledgeEntryMock } = vi.hoisted(() => ({ createKnowledgeEntryMock: vi.fn() }));

vi.mock('../lib/knowledge-store-client', () => ({
  knowledgeStoreClient: { createKnowledgeEntry: createKnowledgeEntryMock },
}));

import { createKnowledgeEntry } from './create-knowledge-entry';

describe('createKnowledgeEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a note with a placeholder body, not a copy of the title', async () => {
    createKnowledgeEntryMock.mockResolvedValue({ id: 'k1', title: 'Nueva nota' });

    const result = await createKnowledgeEntry('Nueva nota', 'proyectos');

    expect(result).toEqual({ ok: true, entry: { id: 'k1', title: 'Nueva nota' } });
    expect(createKnowledgeEntryMock).toHaveBeenCalledWith({
      title: 'Nueva nota',
      content: ' ',
      folderPath: 'proyectos',
    });
  });

  it('returns a graceful error when the client throws', async () => {
    createKnowledgeEntryMock.mockRejectedValue(new Error('knowledge-store down'));

    const result = await createKnowledgeEntry('Nueva nota');

    expect(result).toEqual({ ok: false, error: 'knowledge-store down' });
  });
});
