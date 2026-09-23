import type { PrismaClient } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VaultFolderService } from './vaultFolderService.js';
import type { EmbeddingsProvider } from './embeddingsProvider.js';
import type { SummaryProvider } from './summaryProvider.js';
import type { UserService } from './userService.js';
import type { VaultRepository } from '../vault/vaultRepository.js';

function createPrismaMock() {
  return {
    vaultFolder: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    knowledgeEntry: {
      findMany: vi.fn(),
    },
    $executeRaw: vi.fn(),
  };
}

describe('VaultFolderService', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let vault: { ensureFolder: ReturnType<typeof vi.fn>; deleteFolder: ReturnType<typeof vi.fn> };
  let embeddings: { embed: ReturnType<typeof vi.fn> };
  let summaries: { summarize: ReturnType<typeof vi.fn> };
  let userService: { getCurrent: ReturnType<typeof vi.fn> };
  let service: VaultFolderService;

  beforeEach(() => {
    prisma = createPrismaMock();
    vault = { ensureFolder: vi.fn(), deleteFolder: vi.fn() };
    embeddings = { embed: vi.fn().mockResolvedValue([0.1, 0.2]) };
    summaries = { summarize: vi.fn().mockResolvedValue('resumen agregado') };
    userService = { getCurrent: vi.fn().mockResolvedValue({ id: 'user-1' }) };
    service = new VaultFolderService(
      prisma as unknown as PrismaClient,
      vault as unknown as VaultRepository,
      embeddings as unknown as EmbeddingsProvider,
      summaries as unknown as SummaryProvider,
      userService as unknown as UserService,
    );
  });

  describe('create', () => {
    it('AC1: creates every missing ancestor, mkdir -p semantics', async () => {
      prisma.vaultFolder.findUnique.mockResolvedValue(null);
      prisma.vaultFolder.create
        .mockResolvedValueOnce({ id: 'f-proyectos', path: 'proyectos', parentId: null })
        .mockResolvedValueOnce({ id: 'f-tfg', path: 'proyectos/tfg', parentId: 'f-proyectos' });

      const result = await service.create('proyectos/tfg');

      expect(vault.ensureFolder).toHaveBeenCalledWith('proyectos/tfg');
      expect(prisma.vaultFolder.create).toHaveBeenCalledTimes(2);
      expect(prisma.vaultFolder.create).toHaveBeenNthCalledWith(1, {
        data: { userId: 'user-1', path: 'proyectos', parentId: null, summary: 'proyectos' },
      });
      expect(prisma.vaultFolder.create).toHaveBeenNthCalledWith(2, {
        data: { userId: 'user-1', path: 'proyectos/tfg', parentId: 'f-proyectos', summary: 'proyectos/tfg' },
      });
      expect(result.id).toBe('f-tfg');
    });

    it('AC1: reuses an ancestor that already exists instead of duplicating it', async () => {
      prisma.vaultFolder.findUnique
        .mockResolvedValueOnce({ id: 'f-proyectos', path: 'proyectos', parentId: null })
        .mockResolvedValueOnce(null);
      prisma.vaultFolder.create.mockResolvedValueOnce({ id: 'f-tfg', path: 'proyectos/tfg', parentId: 'f-proyectos' });

      await service.create('proyectos/tfg');

      expect(prisma.vaultFolder.create).toHaveBeenCalledTimes(1);
    });

    it('AC3: an empty new folder gets a placeholder summary equal to its own path', async () => {
      prisma.vaultFolder.findUnique.mockResolvedValue(null);
      prisma.vaultFolder.create.mockResolvedValueOnce({ id: 'f1', path: 'ideas', parentId: null });

      await service.create('ideas');

      expect(prisma.vaultFolder.create).toHaveBeenCalledWith({
        data: { userId: 'user-1', path: 'ideas', parentId: null, summary: 'ideas' },
      });
      expect(embeddings.embed).toHaveBeenCalledWith('ideas');
    });

    it('throws when no user has completed onboarding yet', async () => {
      userService.getCurrent.mockResolvedValue(null);
      await expect(service.create('ideas')).rejects.toThrow(/onboarding/);
      expect(vault.ensureFolder).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('AC7: deletes the DB row (cascades via schema) and the physical directory', async () => {
      prisma.vaultFolder.findUniqueOrThrow.mockResolvedValue({ id: 'f1', path: 'proyectos/tfg' });

      await service.delete('f1');

      expect(prisma.vaultFolder.delete).toHaveBeenCalledWith({ where: { id: 'f1' } });
      expect(vault.deleteFolder).toHaveBeenCalledWith('proyectos/tfg');
    });
  });

  describe('recomputeAndPropagate', () => {
    it('AC2: aggregates direct children summaries and propagates to the parent', async () => {
      prisma.vaultFolder.findUnique
        .mockResolvedValueOnce({ id: 'f-tfg', path: 'proyectos/tfg', parentId: 'f-proyectos' })
        .mockResolvedValueOnce({ id: 'f-proyectos', path: 'proyectos', parentId: null });
      prisma.knowledgeEntry.findMany
        .mockResolvedValueOnce([{ summary: 'idea 1' }])
        .mockResolvedValueOnce([]);
      prisma.vaultFolder.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([{ summary: 'resumen agregado' }]);

      await service.recomputeAndPropagate('f-tfg');

      expect(summaries.summarize).toHaveBeenCalledTimes(2); // once for f-tfg, once propagated to f-proyectos
      expect(prisma.vaultFolder.update).toHaveBeenCalledWith({
        where: { id: 'f-tfg' },
        data: { summary: 'resumen agregado' },
      });
      expect(prisma.vaultFolder.update).toHaveBeenCalledWith({
        where: { id: 'f-proyectos' },
        data: { summary: 'resumen agregado' },
      });
    });

    it('stops propagating once it reaches a folder with no parent (root)', async () => {
      prisma.vaultFolder.findUnique.mockResolvedValueOnce({ id: 'f1', path: 'ideas', parentId: null });
      prisma.knowledgeEntry.findMany.mockResolvedValueOnce([{ summary: 'idea 1' }]);
      prisma.vaultFolder.findMany.mockResolvedValueOnce([]);

      await service.recomputeAndPropagate('f1');

      expect(prisma.vaultFolder.update).toHaveBeenCalledTimes(1);
    });

    it('does nothing when the folder no longer exists', async () => {
      prisma.vaultFolder.findUnique.mockResolvedValueOnce(null);
      await service.recomputeAndPropagate('missing');
      expect(prisma.vaultFolder.update).not.toHaveBeenCalled();
    });
  });
});
