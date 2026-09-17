import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { createApp } from './core/server.js';
import { OpenAiEmbeddingsProvider } from './services/embeddingsProvider.js';
import { KnowledgeEntryService } from './services/knowledgeEntryService.js';
import { UserService } from './services/userService.js';
import { resolveVaultPath } from './vault/resolveVaultPath.js';
import { VaultRepository } from './vault/vaultRepository.js';

const prisma = new PrismaClient();
const vault = new VaultRepository(resolveVaultPath());
const embeddings = new OpenAiEmbeddingsProvider(
  process.env.OPENAI_API_KEY ?? '',
  process.env.EMBEDDINGS_MODEL || 'text-embedding-3-small',
);

const userService = new UserService(prisma);
const knowledgeEntryService = new KnowledgeEntryService(prisma, vault, embeddings, userService);

const app = createApp({ userService, knowledgeEntryService });
const PORT = process.env.PORT || 30025;

app.listen(PORT, () => {
  console.log(`knowledge-store listening on http://localhost:${PORT}`);
});
