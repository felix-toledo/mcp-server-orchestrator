import { describe, expect, it, vi } from 'vitest';
import { backfillProfileNote } from './backfillProfileNote.js';

describe('backfillProfileNote', () => {
  it('replays every existing entry through recordFact, oldest first', async () => {
    const entries = [
      { userId: 'user-1', title: 'Mi perro', summary: 'Se llama Firulais' },
      { userId: 'user-1', title: 'Mi novia', summary: 'Se llama Melisa' },
    ];
    const prisma = { knowledgeEntry: { findMany: vi.fn().mockResolvedValue(entries) } };
    const profileNotes = { recordFact: vi.fn().mockResolvedValue(undefined) };

    const count = await backfillProfileNote(prisma, profileNotes);

    expect(prisma.knowledgeEntry.findMany).toHaveBeenCalledWith({
      where: { path: { not: 'perfil.md' } },
      orderBy: { createdAt: 'asc' },
    });
    expect(profileNotes.recordFact).toHaveBeenNthCalledWith(1, 'user-1', 'Mi perro', 'Se llama Firulais');
    expect(profileNotes.recordFact).toHaveBeenNthCalledWith(2, 'user-1', 'Mi novia', 'Se llama Melisa');
    expect(count).toBe(2);
  });

  it('returns 0 and calls recordFact for nobody when the vault is empty', async () => {
    const prisma = { knowledgeEntry: { findMany: vi.fn().mockResolvedValue([]) } };
    const profileNotes = { recordFact: vi.fn() };

    const count = await backfillProfileNote(prisma, profileNotes);

    expect(count).toBe(0);
    expect(profileNotes.recordFact).not.toHaveBeenCalled();
  });
});
