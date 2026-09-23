import type { PrismaClient } from '@prisma/client';
import type { VaultRepository } from '../vault/vaultRepository.js';
import type { EmbeddingsProvider } from './embeddingsProvider.js';
import { generateSummary } from './generateSummary.js';
import type { SummaryProvider } from './summaryProvider.js';

const SUMMARY_LENGTH = 200;

export const PROFILE_NOTE_PATH = 'perfil.md';
const PROFILE_NOTE_SLUG = 'perfil';
const PROFILE_NOTE_TITLE = 'Perfil';

/**
 * Keeps a single running "Perfil" note up to date with every fact learned
 * about the user, appending one bullet per saved knowledge entry.
 *
 * Why this exists: pure per-note vector search can't answer a broad/meta
 * query ("¿qué sabés de mí?") no matter how its similarity floor is tuned —
 * that kind of query isn't semantically near any single atomic fact
 * ("mi perro se llama Firulais"), it's an aggregate. A note that already
 * contains many facts together *is* close to a broad query's embedding, so
 * this gives retrieval something real to find.
 *
 * Fails open (never throws): a profile-note hiccup must never block the
 * knowledge entry the user actually asked to save.
 */
export class ProfileNoteService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly vault: VaultRepository,
    private readonly embeddings: EmbeddingsProvider,
    private readonly summaries: SummaryProvider,
  ) {}

  async recordFact(userId: string, factTitle: string, factSummary: string): Promise<void> {
    try {
      const bulletLine = `- ${factTitle}: ${factSummary}`;
      const existing = await this.prisma.knowledgeEntry.findFirst({
        where: { userId, path: PROFILE_NOTE_PATH },
      });

      if (!existing) {
        await this.createProfileNote(userId, bulletLine);
        return;
      }

      await this.appendToProfileNote(existing.id, existing.path, bulletLine);
    } catch (error) {
      console.warn('⚠️ No se pudo actualizar la nota de perfil, sigo sin bloquear el guardado:', error);
    }
  }

  private async createProfileNote(userId: string, bulletLine: string): Promise<void> {
    const frontmatter = `---\ntitle: ${PROFILE_NOTE_TITLE}\ncreatedAt: ${new Date().toISOString()}\n---\n\n`;
    const content = `${frontmatter}# ${PROFILE_NOTE_TITLE}\n\n${bulletLine}\n`;
    const { path } = await this.vault.write(null, PROFILE_NOTE_SLUG, content);

    const embedding = await this.embeddings.embed(content);
    const summary = await generateSummary(content, this.summaries, SUMMARY_LENGTH);
    const entry = await this.prisma.knowledgeEntry.create({
      data: { userId, path, title: PROFILE_NOTE_TITLE, summary, folderId: null },
    });
    await this.setEmbedding(entry.id, embedding);
  }

  private async appendToProfileNote(entryId: string, path: string, bulletLine: string): Promise<void> {
    const currentContent = await this.vault.read(path);
    const updatedContent = `${currentContent.trimEnd()}\n${bulletLine}\n`;
    await this.vault.overwrite(path, updatedContent);

    const embedding = await this.embeddings.embed(updatedContent);
    const summary = await generateSummary(updatedContent, this.summaries, SUMMARY_LENGTH);
    await this.prisma.knowledgeEntry.update({
      where: { id: entryId },
      data: { summary },
    });
    await this.setEmbedding(entryId, embedding);
  }

  private async setEmbedding(id: string, embedding: number[]): Promise<void> {
    const vectorLiteral = `[${embedding.join(',')}]`;
    await this.prisma.$executeRaw`UPDATE "KnowledgeEntry" SET embedding = ${vectorLiteral}::vector WHERE id = ${id}`;
  }
}
