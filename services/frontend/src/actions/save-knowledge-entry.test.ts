import { beforeEach, describe, expect, it, vi } from 'vitest';

const { updateKnowledgeEntryMock } = vi.hoisted(() => ({ updateKnowledgeEntryMock: vi.fn() }));

vi.mock('../lib/knowledge-store-client', () => ({
  knowledgeStoreClient: { updateKnowledgeEntry: updateKnowledgeEntryMock },
}));

import { saveKnowledgeEntry } from './save-knowledge-entry';

describe('saveKnowledgeEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('AC3: returns ok:true with the updated entry on success', async () => {
    updateKnowledgeEntryMock.mockResolvedValue({ id: 'k1', summary: 'nuevo' });

    const result = await saveKnowledgeEntry('k1', 'nuevo contenido');

    expect(result).toEqual({ ok: true, entry: { id: 'k1', summary: 'nuevo' } });
  });

  it('AC4: returns ok:false with an error message instead of throwing', async () => {
    updateKnowledgeEntryMock.mockRejectedValue(new Error('knowledge-store unreachable'));

    const result = await saveKnowledgeEntry('k1', 'nuevo contenido');

    expect(result).toEqual({ ok: false, error: 'knowledge-store unreachable' });
  });
});
