import type { PrismaClient } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { VaultRepository } from '../vault/vaultRepository.js';
import type { EmbeddingsProvider } from './embeddingsProvider.js';
import { KnowledgeEntryService } from './knowledgeEntryService.js';
import { PROFILE_NOTE_PATH, type ProfileNoteService } from './profileNoteService.js';
import type { SummaryProvider } from './summaryProvider.js';
import type { UserService } from './userService.js';
import type { VaultFolderService } from './vaultFolderService.js';

const now = new Date('2026-09-18T00:00:00.000Z');

function createPrismaMock() {
  return {
    knowledgeEntry: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
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
  let summaries: { summarize: ReturnType<typeof vi.fn> };
  let userService: { getCurrent: ReturnType<typeof vi.fn> };
  let vaultFolders: { create: ReturnType<typeof vi.fn>; recomputeAndPropagate: ReturnType<typeof vi.fn> };
  let profileNotes: { recordFact: ReturnType<typeof vi.fn> };
  let service: KnowledgeEntryService;

  beforeEach(() => {
    prisma = createPrismaMock();
    vault = createVaultMock();
    embeddings = { embed: vi.fn() };
    summaries = { summarize: vi.fn().mockResolvedValue('contenido') };
    userService = { getCurrent: vi.fn().mockResolvedValue({ id: 'user-1' }) };
    vaultFolders = { create: vi.fn(), recomputeAndPropagate: vi.fn() };
    profileNotes = { recordFact: vi.fn().mockResolvedValue(undefined) };
    service = new KnowledgeEntryService(
      prisma as unknown as PrismaClient,
      vault as unknown as VaultRepository,
      embeddings as unknown as EmbeddingsProvider,
      summaries as unknown as SummaryProvider,
      userService as unknown as UserService,
      vaultFolders as unknown as VaultFolderService,
      profileNotes as unknown as ProfileNoteService,
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
      folderId: null,
      createdAt: now,
      updatedAt: now,
    });

    const result = await service.create({ title: 'Mi nota', content: 'contenido' });

    expect(vault.write).toHaveBeenCalledWith(null, 'mi-nota', expect.stringContaining('contenido'));
    expect(prisma.knowledgeEntry.create).toHaveBeenCalledWith({
      data: { userId: 'user-1', path: 'mi-nota.md', title: 'Mi nota', summary: 'contenido', folderId: null },
    });
    expect(prisma.$executeRaw).toHaveBeenCalled();
    expect(result.id).toBe('k1');
    expect(vault.delete).not.toHaveBeenCalled();
    expect(profileNotes.recordFact).toHaveBeenCalledWith('user-1', 'Mi nota', 'contenido');
  });

  it('skips the profile-note update when the note being created is the profile note itself', async () => {
    vault.write.mockResolvedValue({ path: PROFILE_NOTE_PATH });
    embeddings.embed.mockResolvedValue([0.1]);
    prisma.knowledgeEntry.create.mockResolvedValue({
      id: 'k1',
      path: PROFILE_NOTE_PATH,
      title: 'Perfil',
      summary: 'contenido',
      folderId: null,
      createdAt: now,
      updatedAt: now,
    });

    await service.create({ title: 'Perfil', content: 'contenido' });

    expect(profileNotes.recordFact).not.toHaveBeenCalled();
  });

  it('AC2: filename collisions are delegated to VaultRepository, not re-checked here', async () => {
    vault.write.mockResolvedValue({ path: 'mi-nota-3.md' });
    embeddings.embed.mockResolvedValue([0.1]);
    prisma.knowledgeEntry.create.mockResolvedValue({
      id: 'k2',
      path: 'mi-nota-3.md',
      title: 'Mi nota',
      summary: 'contenido',
      folderId: null,
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
      folderId: null,
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
    prisma.knowledgeEntry.findUniqueOrThrow.mockResolvedValue({ id: 'k1', path: 'mi-nota.md', folderId: null });
    embeddings.embed.mockResolvedValue([0.3]);
    summaries.summarize.mockResolvedValue('nuevo');
    prisma.knowledgeEntry.update.mockResolvedValue({
      id: 'k1',
      path: 'mi-nota.md',
      title: 'Mi nota',
      summary: 'nuevo',
      folderId: null,
      createdAt: now,
      updatedAt: now,
    });

    await service.update('k1', { content: 'nuevo contenido' });

    expect(vault.overwrite).toHaveBeenCalledWith('mi-nota.md', 'nuevo contenido');
    expect(prisma.knowledgeEntry.update).toHaveBeenCalledWith({
      where: { id: 'k1' },
      data: { summary: 'nuevo' },
    });
    expect(prisma.$executeRaw).toHaveBeenCalled();
  });

  describe('knowledge-store/004: folders + LLM summaries', () => {
    it('AC5: resolves/creates the folder first and writes the file inside it', async () => {
      vaultFolders.create.mockResolvedValue({ id: 'f1', path: 'proyectos/tfg' });
      vault.write.mockResolvedValue({ path: 'proyectos/tfg/mi-nota.md' });
      embeddings.embed.mockResolvedValue([0.1]);
      prisma.knowledgeEntry.create.mockResolvedValue({
        id: 'k1',
        path: 'proyectos/tfg/mi-nota.md',
        title: 'Mi nota',
        summary: 'contenido',
        folderId: 'f1',
        createdAt: now,
        updatedAt: now,
      });

      const result = await service.create({ title: 'Mi nota', content: 'contenido', folderPath: 'proyectos/tfg' });

      expect(vaultFolders.create).toHaveBeenCalledWith('proyectos/tfg');
      expect(vault.write).toHaveBeenCalledWith('proyectos/tfg', 'mi-nota', expect.any(String));
      expect(prisma.knowledgeEntry.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ folderId: 'f1' }),
      });
      expect(vaultFolders.recomputeAndPropagate).toHaveBeenCalledWith('f1');
      expect(result.folderId).toBe('f1');
    });

    it('does not touch VaultFolderService when no folderPath is given', async () => {
      vault.write.mockResolvedValue({ path: 'mi-nota.md' });
      embeddings.embed.mockResolvedValue([0.1]);
      prisma.knowledgeEntry.create.mockResolvedValue({
        id: 'k1',
        path: 'mi-nota.md',
        title: 'Mi nota',
        summary: 'contenido',
        folderId: null,
        createdAt: now,
        updatedAt: now,
      });

      await service.create({ title: 'Mi nota', content: 'contenido' });

      expect(vaultFolders.create).not.toHaveBeenCalled();
      expect(vaultFolders.recomputeAndPropagate).not.toHaveBeenCalled();
    });

    it('AC4: uses the LLM summary when available', async () => {
      vault.write.mockResolvedValue({ path: 'mi-nota.md' });
      embeddings.embed.mockResolvedValue([0.1]);
      summaries.summarize.mockResolvedValue('resumen generado por el modelo');
      prisma.knowledgeEntry.create.mockResolvedValue({
        id: 'k1',
        path: 'mi-nota.md',
        title: 'Mi nota',
        summary: 'resumen generado por el modelo',
        folderId: null,
        createdAt: now,
        updatedAt: now,
      });

      await service.create({ title: 'Mi nota', content: 'contenido largo de la nota' });

      expect(prisma.knowledgeEntry.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ summary: 'resumen generado por el modelo' }),
      });
    });

    it('AC4: falls back to plain-text truncation when the LLM summary call fails', async () => {
      vault.write.mockResolvedValue({ path: 'mi-nota.md' });
      embeddings.embed.mockResolvedValue([0.1]);
      summaries.summarize.mockRejectedValue(new Error('modelo caído'));
      prisma.knowledgeEntry.create.mockResolvedValue({
        id: 'k1',
        path: 'mi-nota.md',
        title: 'Mi nota',
        summary: 'contenido de la nota',
        folderId: null,
        createdAt: now,
        updatedAt: now,
      });

      await service.create({ title: 'Mi nota', content: 'contenido de la nota' });

      expect(prisma.knowledgeEntry.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ summary: 'contenido de la nota' }),
      });
    });

    it('update() recomputes the owning folder when the entry belongs to one', async () => {
      prisma.knowledgeEntry.findUniqueOrThrow.mockResolvedValue({ id: 'k1', path: 'proyectos/tfg/mi-nota.md', folderId: 'f1' });
      embeddings.embed.mockResolvedValue([0.1]);
      prisma.knowledgeEntry.update.mockResolvedValue({
        id: 'k1',
        path: 'proyectos/tfg/mi-nota.md',
        title: 'Mi nota',
        summary: 'nuevo',
        folderId: 'f1',
        createdAt: now,
        updatedAt: now,
      });

      await service.update('k1', { content: 'nuevo contenido' });

      expect(vaultFolders.recomputeAndPropagate).toHaveBeenCalledWith('f1');
    });
  });

  describe('getProfileNote', () => {
    it('returns title/content with frontmatter stripped', async () => {
      prisma.knowledgeEntry.findFirst.mockResolvedValue({ id: 'p1', title: 'Perfil', path: PROFILE_NOTE_PATH });
      vault.read.mockResolvedValue('---\ntitle: Perfil\n---\n\n# Perfil\n\n- Mi novia: Melisa\n');

      const result = await service.getProfileNote();

      expect(prisma.knowledgeEntry.findFirst).toHaveBeenCalledWith({
        where: { userId: 'user-1', path: PROFILE_NOTE_PATH },
      });
      expect(result).toEqual({ title: 'Perfil', content: '# Perfil\n\n- Mi novia: Melisa' });
    });

    it('returns null when no profile note exists yet', async () => {
      prisma.knowledgeEntry.findFirst.mockResolvedValue(null);
      await expect(service.getProfileNote()).resolves.toBeNull();
      expect(vault.read).not.toHaveBeenCalled();
    });

    it('returns null without querying when no user has completed onboarding', async () => {
      userService.getCurrent.mockResolvedValue(null);
      await expect(service.getProfileNote()).resolves.toBeNull();
      expect(prisma.knowledgeEntry.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('search', () => {
    it('AC2: embeds the query and returns what the nearest-neighbor/limit query gives back', async () => {
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

    it('AC3: rows returned by the query never carry a content field (only id/path/title/summary/similarity/type)', async () => {
      embeddings.embed.mockResolvedValue([0.1]);
      prisma.$queryRaw.mockResolvedValue([
        { id: 'k1', path: 'a.md', title: 'A', summary: 'resumen a', similarity: 0.9, type: 'entry' },
      ]);

      const [result] = await service.search('consulta', 5);

      expect(result).not.toHaveProperty('content');
      expect(Object.keys(result).sort()).toEqual(['id', 'path', 'similarity', 'summary', 'title', 'type']);
    });

    it('includes folders alongside notes in the ranked results (knowledge-store/004)', async () => {
      embeddings.embed.mockResolvedValue([0.1]);
      const rows = [
        { id: 'f1', path: 'proyectos/tfg', title: 'proyectos/tfg', summary: 'resumen carpeta', similarity: 0.6, type: 'folder' },
        { id: 'k1', path: 'a.md', title: 'A', summary: 'resumen a', similarity: 0.5, type: 'entry' },
      ];
      prisma.$queryRaw.mockResolvedValue(rows);

      const result = await service.search('consulta', 5);

      expect(result).toEqual(rows);
      expect(result.some((r) => r.type === 'folder')).toBe(true);
    });

    it('AC4: returns an empty array when the vault has nothing embedded yet', async () => {
      embeddings.embed.mockResolvedValue([0.1]);
      prisma.$queryRaw.mockResolvedValue([]);

      await expect(service.search('consulta sin relación', 5)).resolves.toEqual([]);
    });

    it('no longer applies a coarse similarity floor at this layer — precision is the reranker\'s job now', async () => {
      embeddings.embed.mockResolvedValue([0.1]);
      const weakMatch = [
        { id: 'k1', path: 'a.md', title: 'A', summary: 'resumen a', similarity: 0.12, type: 'entry' },
      ];
      prisma.$queryRaw.mockResolvedValue(weakMatch);

      const result = await service.search('¿qué sabés de mí?', 20);

      expect(result).toEqual(weakMatch);
    });

    it('returns an empty array without querying when no user has completed onboarding', async () => {
      userService.getCurrent.mockResolvedValue(null);

      await expect(service.search('consulta', 5)).resolves.toEqual([]);
      expect(embeddings.embed).not.toHaveBeenCalled();
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });
  });
});
