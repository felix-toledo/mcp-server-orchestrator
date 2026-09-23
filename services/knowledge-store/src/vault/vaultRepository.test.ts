import { beforeEach, describe, expect, it, vi } from 'vitest';

const { existsSyncMock } = vi.hoisted(() => ({ existsSyncMock: vi.fn() }));
const { mkdirMock, readFileMock, rmMock, writeFileMock } = vi.hoisted(() => ({
  mkdirMock: vi.fn(),
  readFileMock: vi.fn(),
  rmMock: vi.fn(),
  writeFileMock: vi.fn(),
}));

vi.mock('node:fs', () => ({ existsSync: existsSyncMock }));
vi.mock('node:fs/promises', () => ({
  mkdir: mkdirMock,
  readFile: readFileMock,
  rm: rmMock,
  writeFile: writeFileMock,
}));

import { VaultRepository } from './vaultRepository.js';

describe('VaultRepository', () => {
  const vaultRoot = 'C:\\vault';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes to <slug>.md at the root when no folder is given', async () => {
    existsSyncMock.mockReturnValue(false);
    const repo = new VaultRepository(vaultRoot);

    const result = await repo.write(null, 'mi-nota', '# contenido');

    expect(result.path).toBe('mi-nota.md');
    expect(mkdirMock).toHaveBeenCalledWith(vaultRoot, { recursive: true });
    expect(writeFileMock).toHaveBeenCalledWith(`${vaultRoot}\\mi-nota.md`, '# contenido', 'utf-8');
  });

  it('writes inside a folder when folderPath is given (knowledge-store/004 AC5)', async () => {
    existsSyncMock.mockReturnValue(false);
    const repo = new VaultRepository(vaultRoot);

    const result = await repo.write('proyectos/tfg', 'mi-nota', '# contenido');

    expect(result.path).toBe('proyectos/tfg/mi-nota.md');
    expect(mkdirMock).toHaveBeenCalledWith(`${vaultRoot}\\proyectos\\tfg`, { recursive: true });
    expect(writeFileMock).toHaveBeenCalledWith(`${vaultRoot}\\proyectos\\tfg\\mi-nota.md`, '# contenido', 'utf-8');
  });

  it('appends a numeric suffix on collision, never overwriting', async () => {
    existsSyncMock
      .mockReturnValueOnce(true) // mi-nota.md taken
      .mockReturnValueOnce(true) // mi-nota-2.md taken
      .mockReturnValueOnce(false); // mi-nota-3.md free
    const repo = new VaultRepository(vaultRoot);

    const result = await repo.write(null, 'mi-nota', 'contenido');

    expect(result.path).toBe('mi-nota-3.md');
  });

  it('read/overwrite/delete round-trip through the vault root', async () => {
    readFileMock.mockResolvedValue('contenido existente');
    const repo = new VaultRepository(vaultRoot);

    await expect(repo.read('mi-nota.md')).resolves.toBe('contenido existente');
    expect(readFileMock).toHaveBeenCalledWith(`${vaultRoot}\\mi-nota.md`, 'utf-8');

    await repo.overwrite('mi-nota.md', 'nuevo contenido');
    expect(writeFileMock).toHaveBeenCalledWith(`${vaultRoot}\\mi-nota.md`, 'nuevo contenido', 'utf-8');

    await repo.delete('mi-nota.md');
    expect(rmMock).toHaveBeenCalledWith(`${vaultRoot}\\mi-nota.md`, { force: true });
  });

  it('ensureFolder creates every missing ancestor (mkdir -p, AC1)', async () => {
    const repo = new VaultRepository(vaultRoot);
    await repo.ensureFolder('proyectos/tfg');
    expect(mkdirMock).toHaveBeenCalledWith(`${vaultRoot}\\proyectos\\tfg`, { recursive: true });
  });

  it('deleteFolder recursively removes the folder (AC7)', async () => {
    const repo = new VaultRepository(vaultRoot);
    await repo.deleteFolder('proyectos/tfg');
    expect(rmMock).toHaveBeenCalledWith(`${vaultRoot}\\proyectos\\tfg`, { recursive: true, force: true });
  });
});
