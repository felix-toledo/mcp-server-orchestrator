import type { PrismaClient } from '@prisma/client';
import type { CreateKnowledgeEntryInput, UpdateKnowledgeEntryInput } from '../api/schemas.js';
import { slugify } from '../vault/slugify.js';
import type { VaultRepository } from '../vault/vaultRepository.js';
import type { EmbeddingsProvider } from './embeddingsProvider.js';
import { plainTextExcerpt } from './plainTextExcerpt.js';
import type { UserService } from './userService.js';

const SUMMARY_LENGTH = 200;

// Recalibrated 2026-09-17 against real vault data (spec 002-retrieval §7.1):
// the originally-specced 0.75 turned out to reject every genuine match —
// text-embedding-3-small's cosine similarity for a clearly-related
// short query/note pair in Spanish landed at ~0.50 ("tengo alguna mascota,
// cómo se llama" vs. a note about a dog named Firulais), with the next
// most-similar unrelated notes all below 0.25. 0.35 keeps a real margin
// above that noise floor while actually admitting real matches — still not
// a locked business rule, revisit with more real vault content.
const SIMILARITY_THRESHOLD = 0.35;

export interface KnowledgeEntrySearchResult {
  id: string;
  path: string;
  title: string;
  summary: string;
  similarity: number;
}

export interface KnowledgeEntrySummary {
  id: string;
  path: string;
  title: string;
  summary: string;
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
  createdAt: Date;
  updatedAt: Date;
}

function toSummary(entry: KnowledgeEntryRow): KnowledgeEntrySummary {
  return {
    id: entry.id,
    path: entry.path,
    title: entry.title,
    summary: entry.summary,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}

export class KnowledgeEntryService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly vault: VaultRepository,
    private readonly embeddings: EmbeddingsProvider,
    private readonly userService: UserService,
  ) {}

  async create(input: CreateKnowledgeEntryInput): Promise<KnowledgeEntrySummary> {
    const user = await this.userService.getCurrent();
    if (!user) {
      throw new Error('Cannot create a knowledge entry before onboarding');
    }

    const frontmatter = `---\ntitle: ${input.title}\ncreatedAt: ${new Date().toISOString()}\n---\n\n`;
    const { path } = await this.vault.write(slugify(input.title), `${frontmatter}${input.content}`);

    try {
      const embedding = await this.embeddings.embed(input.content);
      const entry = await this.prisma.knowledgeEntry.create({
        data: {
          userId: user.id,
          path,
          title: input.title,
          summary: plainTextExcerpt(input.content, SUMMARY_LENGTH),
        },
      });
      await this.setEmbedding(entry.id, embedding);
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

  async update(id: string, input: UpdateKnowledgeEntryInput): Promise<KnowledgeEntrySummary> {
    const entry = await this.prisma.knowledgeEntry.findUniqueOrThrow({ where: { id } });
    await this.vault.overwrite(entry.path, input.content);

    const embedding = await this.embeddings.embed(input.content);
    const updated = await this.prisma.knowledgeEntry.update({
      where: { id },
      data: { summary: plainTextExcerpt(input.content, SUMMARY_LENGTH) },
    });
    await this.setEmbedding(id, embedding);
    return toSummary(updated);
  }

  async search(query: string, limit: number): Promise<KnowledgeEntrySearchResult[]> {
    const user = await this.userService.getCurrent();
    if (!user) {
      return [];
    }

    const queryEmbedding = await this.embeddings.embed(query);
    const vectorLiteral = `[${queryEmbedding.join(',')}]`;

    return this.prisma.$queryRaw<KnowledgeEntrySearchResult[]>`
      SELECT id, path, title, summary,
             1 - (embedding <=> ${vectorLiteral}::vector) AS similarity
      FROM "KnowledgeEntry"
      WHERE "userId" = ${user.id}
        AND embedding IS NOT NULL
        AND 1 - (embedding <=> ${vectorLiteral}::vector) >= ${SIMILARITY_THRESHOLD}
      ORDER BY embedding <=> ${vectorLiteral}::vector ASC
      LIMIT ${limit};
    `;
  }

  private async setEmbedding(id: string, embedding: number[]): Promise<void> {
    const vectorLiteral = `[${embedding.join(',')}]`;
    await this.prisma.$executeRaw`UPDATE "KnowledgeEntry" SET embedding = ${vectorLiteral}::vector WHERE id = ${id}`;
  }
}
