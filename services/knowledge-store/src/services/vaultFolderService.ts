import type { PrismaClient, VaultFolder } from '@prisma/client';
import { generateSummary } from './generateSummary.js';
import type { EmbeddingsProvider } from './embeddingsProvider.js';
import type { SummaryProvider } from './summaryProvider.js';
import type { UserService } from './userService.js';
import type { VaultRepository } from '../vault/vaultRepository.js';

const SUMMARY_LENGTH = 200;

export class VaultFolderService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly vault: VaultRepository,
    private readonly embeddings: EmbeddingsProvider,
    private readonly summaries: SummaryProvider,
    private readonly userService: UserService,
  ) {}

  /** AC1: mkdir -p semantics — creates every missing ancestor, then the folder itself. */
  async create(path: string): Promise<VaultFolder> {
    const user = await this.userService.getCurrent();
    if (!user) {
      throw new Error('Cannot create a vault folder before onboarding');
    }

    await this.vault.ensureFolder(path);

    const segments = path.split('/').filter(Boolean);
    let parentId: string | null = null;
    let folder: VaultFolder | null = null;

    for (let i = 0; i < segments.length; i++) {
      const ancestorPath = segments.slice(0, i + 1).join('/');
      const existing = await this.prisma.vaultFolder.findUnique({
        where: { userId_path: { userId: user.id, path: ancestorPath } },
      });

      if (existing) {
        folder = existing;
      } else {
        // AC3: placeholder summary for an empty folder — its own name/path.
        folder = await this.prisma.vaultFolder.create({
          data: { userId: user.id, path: ancestorPath, parentId, summary: ancestorPath },
        });
        await this.setEmbedding(folder.id, ancestorPath);
      }
      parentId = folder.id;
    }

    // folder is guaranteed non-null: path has at least one segment (validated by the caller/schema)
    return folder as VaultFolder;
  }

  async list(): Promise<VaultFolder[]> {
    return this.prisma.vaultFolder.findMany();
  }

  /** AC7: cascade at the DB level (schema's onDelete: Cascade) + the physical directory. */
  async delete(id: string): Promise<void> {
    const folder = await this.prisma.vaultFolder.findUniqueOrThrow({ where: { id } });
    await this.prisma.vaultFolder.delete({ where: { id } });
    await this.vault.deleteFolder(folder.path);
  }

  /**
   * AC2: recomputes this folder's summary/embedding from what's directly
   * inside it (its files' summaries + its direct subfolders' summaries),
   * then propagates the same recompute up the parent chain to the root.
   */
  async recomputeAndPropagate(folderId: string): Promise<void> {
    const folder = await this.prisma.vaultFolder.findUnique({ where: { id: folderId } });
    if (!folder) {
      return;
    }

    const [entries, children] = await Promise.all([
      this.prisma.knowledgeEntry.findMany({ where: { folderId }, select: { summary: true } }),
      this.prisma.vaultFolder.findMany({ where: { parentId: folderId }, select: { summary: true } }),
    ]);

    const aggregate = [...entries.map((e) => e.summary), ...children.map((c) => c.summary)].join(' ');
    const summary = aggregate.trim() ? await generateSummary(aggregate, this.summaries, SUMMARY_LENGTH) : folder.path;

    await this.prisma.vaultFolder.update({ where: { id: folderId }, data: { summary } });
    await this.setEmbedding(folderId, summary);

    if (folder.parentId) {
      await this.recomputeAndPropagate(folder.parentId);
    }
  }

  private async setEmbedding(folderId: string, textToEmbed: string): Promise<void> {
    const embedding = await this.embeddings.embed(textToEmbed);
    const vectorLiteral = `[${embedding.join(',')}]`;
    await this.prisma.$executeRaw`UPDATE "VaultFolder" SET embedding = ${vectorLiteral}::vector WHERE id = ${folderId}`;
  }
}
