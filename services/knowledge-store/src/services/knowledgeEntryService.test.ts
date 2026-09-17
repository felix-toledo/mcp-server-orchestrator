import type { PrismaClient } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { VaultRepository } from '../vault/vaultRepository.js';
import type { EmbeddingsProvider } from './embeddingsProvider.js';
import { KnowledgeEntryService } from './knowledgeEntryService.js';
import type { UserService } from './userService.js';

const now = new Date('2026-09-18T00:00:00.000Z');

function createPrismaMock() {
  return {
    knowledgeEntry: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
    $executeRaw: vi.fn(),
    $queryRaw: vi.fn(),
  };
}

function createVaultMock() {
  return {
    write: vi.fn(),
    read: vi.fn(),
    overwrite: vi.fn(),
    delete: vi.fn(),
  };
}

describe('KnowledgeEntryService', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let vault: ReturnType<typeof createVaultMock>;
  let embeddings: { embed: ReturnType<typeof vi.fn> };
  let userService: { getCurrent: ReturnType<typeof vi.fn> };
  let service: KnowledgeEntryService;

  beforeEach(() => {
    prisma = createPrismaMock();
    vault = createVaultMock();
    embeddings = { embed: vi.fn() };
    userService = { getCurrent: vi.fn().mockResolvedValue({ id: 'user-1' }) };
    service = new KnowledgeEntryService(
      prisma as unknown as PrismaClient,
      vault as unknown as VaultRepository,
      embeddings as unknown as EmbeddingsProvider,
      userService as unknown as UserService,
    );
  });

  it('AC1: writes the file, embeds, and persists the row', async () => {
    vault.write.mockResolvedValue({ path: 'mi-nota.md' });
    embeddings.embed.mockResolvedValue([0.1, 0.2]);
    prisma.knowledgeEntry.create.mockResolvedValue({
      id: 'k1',
      path: 'mi-nota.md',
      title: 'Mi nota',
      summary: 'contenido',
      createdAt: now,
      updatedAt: now,
    });

    const result = await service.create({ title: 'Mi nota', content: 'contenido' });

    expect(vault.write).toHaveBeenCalledWith('mi-nota', expect.stringContaining('contenido'));
    expect(prisma.knowledgeEntry.create).toHaveBeenCalledWith({
      data: { userId: 'user-1', path: 'mi-nota.md', title: 'Mi nota', summary: 'contenido' },
    });
    expect(prisma.$executeRaw).toHaveBeenCalled();
    expect(result.id).toBe('k1');
    expect(vault.delete).not.toHaveBeenCalled();
  });

  it('AC2: filename collisions are delegated to VaultRepository, not re-checked here', async () => {
    vault.write.mockResolvedValue({ path: 'mi-nota-3.md' });
    embeddings.embed.mockResolvedValue([0.1]);
    prisma.knowledgeEntry.create.mockResolvedValue({
      id: 'k2',
      path: 'mi-nota-3.md',
      title: 'Mi nota',
      summary: 'contenido',
      createdAt: now,
      updatedAt: now,
    });

    const result = await service.create({ title: 'Mi nota', content: 'contenido' });

    expect(result.path).toBe('mi-nota-3.md');
    expect(vault.write).toHaveBeenCalledTimes(1);
  });

  it('AC3: rolls back the vault write when embedding fails, never persists a row', async () => {
    vault.write.mockResolvedValue({ path: 'mi-nota.md' });
    embeddings.embed.mockRejectedValue(new Error('OpenAI embeddings request failed'));

    await expect(service.create({ title: 'Mi nota', content: 'contenido' })).rejects.toThrow(
      'OpenAI embeddings request failed',
    );

    expect(prisma.knowledgeEntry.create).not.toHaveBeenCalled();
    expect(vault.delete).toHaveBeenCalledWith('mi-nota.md');
  });

  it('AC3: rolls back the vault write when the Prisma insert fails', async () => {
    vault.write.mockResolvedValue({ path: 'mi-nota.md' });
    embeddings.embed.mockResolvedValue([0.1]);
    prisma.knowledgeEntry.create.mockRejectedValue(new Error('db down'));

    await expect(service.create({ title: 'Mi nota', content: 'contenido' })).rejects.toThrow('db down');

    expect(vault.delete).toHaveBeenCalledWith('mi-nota.md');
  });

  it('throws when no user has completed onboarding yet', async () => {
    userService.getCurrent.mockResolvedValue(null);

    await expect(service.create({ title: 'Mi nota', content: 'contenido' })).rejects.toThrow(/onboarding/);
    expect(vault.write).not.toHaveBeenCalled();
  });

  it('list() returns entries sorted by updatedAt desc (delegated to Prisma orderBy)', async () => {
    prisma.knowledgeEntry.findMany.mockResolvedValue([]);
    await service.list();
    expect(prisma.knowledgeEntry.findMany).toHaveBeenCalledWith({ orderBy: { updatedAt: 'desc' } });
  });

  it('getById() reads the live file content from the vault', async () => {
    prisma.knowledgeEntry.findUnique.mockResolvedValue({
      id: 'k1',
      path: 'mi-nota.md',
      title: 'Mi nota',
      summary: 'contenido',
      createdAt: now,
      updatedAt: now,
    });
    vault.read.mockResolvedValue('# contenido completo');

    const result = await service.getById('k1');

    expect(result?.content).toBe('# contenido completo');
  });

  it('getById() returns null when the id does not exist', async () => {
    prisma.knowledgeEntry.findUnique.mockResolvedValue(null);
    await expect(service.getById('missing')).resolves.toBeNull();
    expect(vault.read).not.toHaveBeenCalled();
  });

  it('update() overwrites the file and regenerates summary/embedding', async () => {
    prisma.knowledgeEntry.findUniqueOrThrow.mockResolvedValue({ id: 'k1', path: 'mi-nota.md' });
    embeddings.embed.mockResolvedValue([0.3]);
    prisma.knowledgeEntry.update.mockResolvedValue({
      id: 'k1',
      path: 'mi-nota.md',
      title: 'Mi nota',
      summary: 'nuevo',
      createdAt: now,
      updatedAt: now,
    });

    await service.update('k1', { content: 'nuevo contenido' });

    expect(vault.overwrite).toHaveBeenCalledWith('mi-nota.md', 'nuevo contenido');
    expect(prisma.knowledgeEntry.update).toHaveBeenCalledWith({
      where: { id: 'k1' },
      data: { summary: 'nuevo contenido' },
    });
    expect(prisma.$executeRaw).toHaveBeenCalled();
  });

  describe('search', () => {
    it('AC2: embeds the query and returns what the threshold/limit query gives back', async () => {
      embeddings.embed.mockResolvedValue([0.1, 0.2]);
      const rows = [
        { id: 'k1', path: 'a.md', title: 'A', summary: 'resumen a', similarity: 0.91 },
        { id: 'k2', path: 'b.md', title: 'B', summary: 'resumen b', similarity: 0.8 },
      ];
      prisma.$queryRaw.mockResolvedValue(rows);

      const result = await service.search('mi consulta', 5);

      expect(embeddings.embed).toHaveBeenCalledWith('mi consulta');
      expect(prisma.$queryRaw).toHaveBeenCalled();
      expect(result).toEqual(rows);
    });

    it('AC3: rows returned by the query never carry a content field (only id/path/title/summary/similarity)', async () => {
      embeddings.embed.mockResolvedValue([0.1]);
      prisma.$queryRaw.mockResolvedValue([
        { id: 'k1', path: 'a.md', title: 'A', summary: 'resumen a', similarity: 0.9 },
      ]);

      const [result] = await service.search('consulta', 5);

      expect(result).not.toHaveProperty('content');
      expect(Object.keys(result).sort()).toEqual(['id', 'path', 'similarity', 'summary', 'title']);
    });

    it('AC4: returns an empty array when nothing clears the similarity threshold', async () => {
      embeddings.embed.mockResolvedValue([0.1]);
      prisma.$queryRaw.mockResolvedValue([]);

      await expect(service.search('consulta sin relación', 5)).resolves.toEqual([]);
    });

    it('returns an empty array without querying when no user has completed onboarding', async () => {
      userService.getCurrent.mockResolvedValue(null);

      await expect(service.search('consulta', 5)).resolves.toEqual([]);
      expect(embeddings.embed).not.toHaveBeenCalled();
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });
  });
});
