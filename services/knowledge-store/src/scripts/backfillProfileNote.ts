import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { OpenAiEmbeddingsProvider } from '../services/embeddingsProvider.js';
import { PROFILE_NOTE_PATH, ProfileNoteService } from '../services/profileNoteService.js';
import { CheapLlmSummaryProvider } from '../services/summaryProvider.js';
import { resolveVaultPath } from '../vault/resolveVaultPath.js';
import { VaultRepository } from '../vault/vaultRepository.js';

interface BackfillablePrisma {
  knowledgeEntry: {
    findMany(args: {
      where: { path: { not: string } };
      orderBy: { createdAt: 'asc' };
    }): Promise<Array<{ userId: string; title: string; summary: string }>>;
  };
}

/**
 * One-time backfill for `ProfileNoteService` (knowledge-store/002-retrieval's
 * 2026-09-18 addendum): `perfil.md` only starts accumulating facts from the
 * moment it was introduced — this replays every knowledge entry that already
 * existed before that, through the exact same `recordFact` path new saves
 * use, so a vault with real history doesn't start the profile note empty.
 * Safe to re-run: `recordFact` only ever appends.
 */
export async function backfillProfileNote(
  prisma: BackfillablePrisma,
  profileNotes: Pick<ProfileNoteService, 'recordFact'>,
): Promise<number> {
  const entries = await prisma.knowledgeEntry.findMany({
    where: { path: { not: PROFILE_NOTE_PATH } },
    orderBy: { createdAt: 'asc' },
  });

  for (const entry of entries) {
    await profileNotes.recordFact(entry.userId, entry.title, entry.summary);
  }
  return entries.length;
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  const vault = new VaultRepository(resolveVaultPath());
  const embeddings = new OpenAiEmbeddingsProvider(
    process.env.OPENAI_API_KEY ?? '',
    process.env.EMBEDDINGS_MODEL || 'text-embedding-3-small',
  );
  const summaries = new CheapLlmSummaryProvider(process.env.OPENAI_API_KEY ?? '', process.env.SUMMARY_MODEL || 'gpt-4o-mini');
  const profileNotes = new ProfileNoteService(prisma, vault, embeddings, summaries);

  const count = await backfillProfileNote(prisma as unknown as BackfillablePrisma, profileNotes);
  console.log(`✅ Backfilled ${count} existing knowledge entries into ${PROFILE_NOTE_PATH}`);
  await prisma.$disconnect();
}

// Only run when invoked directly (`node --loader ts-node/esm backfillProfileNote.ts`), not when imported by
// tests. Compared as a proper file:// URL (not string-concatenated), since Windows paths use `\` and
// `pathToFileURL` is what actually normalizes that — a naive `file://${process.argv[1]}` never matches there.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error('❌ Backfill failed:', error);
    process.exitCode = 1;
  });
}
