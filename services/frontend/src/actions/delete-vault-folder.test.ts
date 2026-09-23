import { beforeEach, describe, expect, it, vi } from 'vitest';

const { deleteVaultFolderMock } = vi.hoisted(() => ({ deleteVaultFolderMock: vi.fn() }));

vi.mock('../lib/knowledge-store-client', () => ({
  knowledgeStoreClient: { deleteVaultFolder: deleteVaultFolderMock },
}));

import { deleteVaultFolder } from './delete-vault-folder';

describe('deleteVaultFolder', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns ok on success', async () => {
    deleteVaultFolderMock.mockResolvedValue(undefined);
    await expect(deleteVaultFolder('f1')).resolves.toEqual({ ok: true });
  });

  it('returns a graceful failure when the client throws', async () => {
    deleteVaultFolderMock.mockRejectedValue(new Error('down'));
    await expect(deleteVaultFolder('f1')).resolves.toEqual({ ok: false });
  });
});
