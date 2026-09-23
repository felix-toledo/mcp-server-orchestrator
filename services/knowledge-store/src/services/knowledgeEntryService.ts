import type { PrismaClient } from '@prisma/client';
import type { CreateKnowledgeEntryInput, UpdateKnowledgeEntryInput } from '../api/schemas.js';
import { slugify } from '../vault/slugify.js';
import type { VaultRepository } from '../vault/vaultRepository.js';
import type { EmbeddingsProvider } from './embeddingsProvider.js';
import { generateSummary } from './generateSummary.js';
import { PROFILE_NOTE_PATH, type ProfileNoteService } from './profileNoteService.js';
import { stripFrontmatter } from './stripFrontmatter.js';
import type { SummaryProvider } from './summaryProvider.js';
import type { UserService } from './userService.js';
import type { VaultFolderService } from './vaultFolderService.js';

const SUMMARY_LENGTH = 200;

export interface KnowledgeEntrySearchResult {
  id: string;
  path: string;
  title: string;
  summary: string;
  similarity: number;
  type: 'entry' | 'folder';
}

export interface KnowledgeEntrySummary {
  id: string;
  path: string;
  title: string;
  summary: string;
  folderId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface KnowledgeEntryDetail extends KnowledgeEntrySummary {
  content: string;
}

interface KnowledgeEntryRow {
  id: string;
  path: string;
  title: string;
  summary: string;
  folderId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function toSummary(entry: KnowledgeEntryRow): KnowledgeEntrySummary {
  return {
    id: entry.id,
    path: entry.path,
    title: entry.title,
    summary: entry.summary,
    folderId: entry.folderId,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}

export class KnowledgeEntryService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly vault: VaultRepository,
    private readonly embeddings: EmbeddingsProvider,
    private readonly summaries: SummaryProvider,
    private readonly userService: UserService,
    private readonly vaultFolders: VaultFolderService,
    private readonly profileNotes: ProfileNoteService,
  ) {}

  async create(input: CreateKnowledgeEntryInput): Promise<KnowledgeEntrySummary> {
    const user = await this.userService.getCurrent();
    if (!user) {
      throw new Error('Cannot create a knowledge entry before onboarding');
    }

    // knowledge-store/004 AC5: resolve/create the folder chain first.
    const folder = input.folderPath ? await this.vaultFolders.create(input.folderPath) : null;

    const frontmatter = `---\ntitle: ${input.title}\ncreatedAt: ${new Date().toISOString()}\n---\n\n`;
    const { path } = await this.vault.write(
      folder?.path ?? null,
      slugify(input.title),
      `${frontmatter}${input.content}`,
    );

    try {
      const embedding = await this.embeddings.embed(input.content);
      const summary = await generateSummary(input.content, this.summaries, SUMMARY_LENGTH);
      const entry = await this.prisma.knowledgeEntry.create({
        data: {
          userId: user.id,
          path,
          title: input.title,
          summary,
          folderId: folder?.id ?? null,
        },
      });
      await this.setEmbedding(entry.id, embedding);
      if (folder) {
        await this.vaultFolders.recomputeAndPropagate(folder.id);
      }
      if (path !== PROFILE_NOTE_PATH) {
        await this.profileNotes.recordFact(user.id, input.title, summary);
      }
      return toSummary(entry);
    } catch (error) {
      await this.vault.delete(path);
      throw error;
    }
  }

  async list(): Promise<KnowledgeEntrySummary[]> {
    const entries = await this.prisma.knowledgeEntry.findMany({
      orderBy: { updatedAt: 'desc' },
    });
    return entries.map(toSummary);
  }

  async getById(id: string): Promise<KnowledgeEntryDetail | null> {
    const entry = await this.prisma.knowledgeEntry.findUnique({ where: { id } });
    if (!entry) {
      return null;
    }
    const content = await this.vault.read(entry.path);
    return { ...toSummary(entry), content };
  }

  /**
   * 2026-09-18 addendum (knowledge-store/002-retrieval's tasks.md) — the
   * profile note is meant to always be available as context, not something
   * a similarity search decides is "relevant enough": neither the coarse
   * embedding search nor the orchestrator's cross-encoder reranker can
   * recognize a broad query ("¿qué sabés de mí?") as relevant to *any*
   * note, including this one — verified live, not theoretical. So this is
   * a direct lookup by well-known path, never `search()`.
   */
  async getProfileNote(): Promise<{ title: string; content: string } | null> {
    const user = await this.userService.getCurrent();
    if (!user) {
      return null;
    }
    const entry = await this.prisma.knowledgeEntry.findFirst({
      where: { userId: user.id, path: PROFILE_NOTE_PATH },
    });
    if (!entry) {
      return null;
    }
    const rawContent = await this.vault.read(entry.path);
    return { title: entry.title, content: stripFrontmatter(rawContent) };
  }

  async update(id: string, input: UpdateKnowledgeEntryInput): Promise<KnowledgeEntrySummary> {
    const entry = await this.prisma.knowledgeEntry.findUniqueOrThrow({ where: { id } });
    await this.vault.overwrite(entry.path, input.content);

    const embedding = await this.embeddings.embed(input.content);
    const summary = await generateSummary(input.content, this.summaries, SUMMARY_LENGTH);
    const updated = await this.prisma.knowledgeEntry.update({
      where: { id },
      data: { summary },
    });
    await this.setEmbedding(id, embedding);
    if (entry.folderId) {
      await this.vaultFolders.recomputeAndPropagate(entry.folderId);
    }
    return toSummary(updated);
  }

  async search(query: string, limit: number): Promise<KnowledgeEntrySearchResult[]> {
    const user = await this.userService.getCurrent();
    if (!user) {
      return [];
    }

    const queryEmbedding = await this.embeddings.embed(query);
    const vectorLiteral = `[${queryEmbedding.join(',')}]`;

    // Folders carry their own embedding too (knowledge-store/004 AC1/AC2) —
    // a query can surface a whole folder as relevant, not just individual
    // notes, so both tables are ranked together here.
    //
    // No similarity floor here on purpose (2026-09-18, see
    // .specify/specs/knowledge-store/002-retrieval/tasks.md's addendum): a
    // coarse cosine floor at this coarse-recall stage rejected genuine
    // matches for broad/meta queries ("¿qué sabés de mí?") before the
    // already-calibrated cross-encoder reranker
    // (orchestrator/src/retrieval/Reranker.ts, MINIMUM_SCORE = 0.5) ever
    // got a look at them — two relevance gates stacked, and the cheaper,
    // worse one ran first and could veto the better one. This now just
    // returns nearest neighbors; the reranker is the sole precision filter.
    // `ORDER BY <=> ... LIMIT` per branch (not a WHERE on the computed
    // similarity) is also the shape pgvector's ANN indexes (ivfflat/hnsw)
    // can actually use — not load-bearing yet at this vault's size (no such
    // index exists), but worth keeping this shape ready for when one is
    // added.
    return this.prisma.$queryRaw<KnowledgeEntrySearchResult[]>`
      SELECT id, path, title, summary, similarity, type FROM (
        (
          SELECT id, path, title, summary,
                 1 - (embedding <=> ${vectorLiteral}::vector) AS similarity,
                 'entry' AS type
          FROM "KnowledgeEntry"
          WHERE "userId" = ${user.id}
            AND embedding IS NOT NULL
          ORDER BY embedding <=> ${vectorLiteral}::vector
          LIMIT ${limit}
        )
        UNION ALL
        (
          SELECT id, path, path AS title, summary,
                 1 - (embedding <=> ${vectorLiteral}::vector) AS similarity,
                 'folder' AS type
          FROM "VaultFolder"
          WHERE "userId" = ${user.id}
            AND embedding IS NOT NULL
          ORDER BY embedding <=> ${vectorLiteral}::vector
          LIMIT ${limit}
        )
      ) AS combined
      ORDER BY similarity DESC
      LIMIT ${limit};
    `;
  }

  private async setEmbedding(id: string, embedding: number[]): Promise<void> {
    const vectorLiteral = `[${embedding.join(',')}]`;
    await this.prisma.$executeRaw`UPDATE "KnowledgeEntry" SET embedding = ${vectorLiteral}::vector WHERE id = ${id}`;
  }
}
