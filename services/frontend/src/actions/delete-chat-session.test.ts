import { beforeEach, describe, expect, it, vi } from 'vitest';

const { deleteChatSessionMock } = vi.hoisted(() => ({ deleteChatSessionMock: vi.fn() }));

vi.mock('../lib/knowledge-store-client', () => ({
  knowledgeStoreClient: { deleteChatSession: deleteChatSessionMock },
}));

import { deleteChatSession } from './delete-chat-session';

describe('deleteChatSession', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns ok on success', async () => {
    deleteChatSessionMock.mockResolvedValue(undefined);
    await expect(deleteChatSession('s1')).resolves.toEqual({ ok: true });
  });

  it('returns a graceful failure when the client throws', async () => {
    deleteChatSessionMock.mockRejectedValue(new Error('down'));
    await expect(deleteChatSession('s1')).resolves.toEqual({ ok: false });
  });
});
