import type { PrismaClient } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { VaultRepository } from '../vault/vaultRepository.js';
import type { EmbeddingsProvider } from './embeddingsProvider.js';
import { PROFILE_NOTE_PATH, ProfileNoteService } from './profileNoteService.js';
import type { SummaryProvider } from './summaryProvider.js';

function createPrismaMock() {
  return {
    knowledgeEntry: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    $executeRaw: vi.fn(),
  };
}

function createVaultMock() {
  return {
    write: vi.fn(),
    read: vi.fn(),
    overwrite: vi.fn(),
  };
}

describe('ProfileNoteService', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let vault: ReturnType<typeof createVaultMock>;
  let embeddings: { embed: ReturnType<typeof vi.fn> };
  let summaries: { summarize: ReturnType<typeof vi.fn> };
  let service: ProfileNoteService;

  beforeEach(() => {
    prisma = createPrismaMock();
    vault = createVaultMock();
    embeddings = { embed: vi.fn().mockResolvedValue([0.1, 0.2]) };
    summaries = { summarize: vi.fn().mockResolvedValue('resumen') };
    service = new ProfileNoteService(
      prisma as unknown as PrismaClient,
      vault as unknown as VaultRepository,
      embeddings as unknown as EmbeddingsProvider,
      summaries as unknown as SummaryProvider,
    );
  });

  it('creates perfil.md on the first fact when no profile note exists yet', async () => {
    prisma.knowledgeEntry.findFirst.mockResolvedValue(null);
    vault.write.mockResolvedValue({ path: PROFILE_NOTE_PATH });
    prisma.knowledgeEntry.create.mockResolvedValue({ id: 'profile-1' });

    await service.recordFact('user-1', 'Mi perro', 'Mi perro se llama Firulais');

    expect(vault.write).toHaveBeenCalledWith(
      null,
      'perfil',
      expect.stringContaining('- Mi perro: Mi perro se llama Firulais'),
    );
    expect(prisma.knowledgeEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 'user-1', path: PROFILE_NOTE_PATH, title: 'Perfil' }),
    });
    expect(prisma.$executeRaw).toHaveBeenCalled();
    expect(vault.overwrite).not.toHaveBeenCalled();
  });

  it('appends a bullet to the existing profile note instead of creating a new one', async () => {
    prisma.knowledgeEntry.findFirst.mockResolvedValue({ id: 'profile-1', path: PROFILE_NOTE_PATH });
    vault.read.mockResolvedValue('---\ntitle: Perfil\n---\n\n# Perfil\n\n- Mi perro: se llama Firulais\n');

    await service.recordFact('user-1', 'Mi novia', 'Mi novia se llama Melisa');

    expect(vault.overwrite).toHaveBeenCalledWith(
      PROFILE_NOTE_PATH,
      expect.stringContaining('- Mi perro: se llama Firulais\n- Mi novia: Mi novia se llama Melisa'),
    );
    expect(prisma.knowledgeEntry.update).toHaveBeenCalledWith({
      where: { id: 'profile-1' },
      data: { summary: 'resumen' },
    });
    expect(vault.write).not.toHaveBeenCalled();
  });

  it('never throws when the vault write fails — a profile-note hiccup must not block the real save', async () => {
    prisma.knowledgeEntry.findFirst.mockResolvedValue(null);
    vault.write.mockRejectedValue(new Error('disk full'));

    await expect(service.recordFact('user-1', 'Mi novia', 'Mi novia se llama Melisa')).resolves.toBeUndefined();
  });

  it('never throws when the embedding call fails', async () => {
    prisma.knowledgeEntry.findFirst.mockResolvedValue({ id: 'profile-1', path: PROFILE_NOTE_PATH });
    vault.read.mockResolvedValue('# Perfil\n');
    embeddings.embed.mockRejectedValue(new Error('OpenAI down'));

    await expect(service.recordFact('user-1', 'Mi novia', 'Mi novia se llama Melisa')).resolves.toBeUndefined();
  });
});
