import { describe, expect, it, vi } from 'vitest';
import type { KnowledgeStoreClient } from '../http/knowledgeStoreClient.js';
import { registerCreateVaultFolderTool } from './createVaultFolderTool.js';
import { createFakeMcpServer } from './testHelpers.js';

function createClientMock() {
  return { createVaultFolder: vi.fn() } as unknown as KnowledgeStoreClient;
}

describe('createVaultFolderTool', () => {
  it('returns a confirmation message on success', async () => {
    const client = createClientMock();
    vi.mocked(client.createVaultFolder).mockResolvedValue({ id: 'f1', path: 'proyectos/tfg' });

    const fake = createFakeMcpServer();
    registerCreateVaultFolderTool(fake.server, client);

    const result = (await fake.getHandler('createVaultFolder')({ path: 'proyectos/tfg' })) as {
      isError?: boolean;
      content: Array<{ text: string }>;
    };

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('proyectos/tfg');
    expect(client.createVaultFolder).toHaveBeenCalledWith('proyectos/tfg');
  });

  it('returns an MCP tool error (not a thrown exception) when knowledge-store is unreachable', async () => {
    const client = createClientMock();
    vi.mocked(client.createVaultFolder).mockRejectedValue(new Error('fetch failed'));

    const fake = createFakeMcpServer();
    registerCreateVaultFolderTool(fake.server, client);

    const result = (await fake.getHandler('createVaultFolder')({ path: 'proyectos/tfg' })) as {
      isError?: boolean;
      content: Array<{ text: string }>;
    };

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/No pude crear la carpeta/);
  });
});
