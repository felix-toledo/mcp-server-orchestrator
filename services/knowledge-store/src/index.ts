import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { createApp } from './core/server.js';
import { AgentService } from './services/agentService.js';
import { ChatSessionService } from './services/chatSessionService.js';
import { OpenAiEmbeddingsProvider } from './services/embeddingsProvider.js';
import { KnowledgeEntryService } from './services/knowledgeEntryService.js';
import { ProfileNoteService } from './services/profileNoteService.js';
import { SkillService } from './services/skillService.js';
import { CheapLlmSummaryProvider } from './services/summaryProvider.js';
import { TeamService } from './services/teamService.js';
import { TelegramLinkService } from './services/telegramLinkService.js';
import { UserService } from './services/userService.js';
import { VaultFolderService } from './services/vaultFolderService.js';
import { VoiceProfileService } from './services/voiceProfileService.js';
import { resolveVaultPath } from './vault/resolveVaultPath.js';
import { VaultRepository } from './vault/vaultRepository.js';
import { resolveVoiceProfileStoragePath } from './voiceProfile/resolveVoiceProfileStoragePath.js';
import { VoiceProfileStorage } from './voiceProfile/voiceProfileStorage.js';

const prisma = new PrismaClient();
const vault = new VaultRepository(resolveVaultPath());
const voiceProfileStorage = new VoiceProfileStorage(resolveVoiceProfileStoragePath());
const embeddings = new OpenAiEmbeddingsProvider(
  process.env.OPENAI_API_KEY ?? '',
  process.env.EMBEDDINGS_MODEL || 'text-embedding-3-small',
);
const summaries = new CheapLlmSummaryProvider(process.env.OPENAI_API_KEY ?? '', process.env.SUMMARY_MODEL || 'gpt-4o-mini');

const userService = new UserService(prisma);
const vaultFolderService = new VaultFolderService(prisma, vault, embeddings, summaries, userService);
const profileNoteService = new ProfileNoteService(prisma, vault, embeddings, summaries);
const knowledgeEntryService = new KnowledgeEntryService(
  prisma,
  vault,
  embeddings,
  summaries,
  userService,
  vaultFolderService,
  profileNoteService,
);
const chatSessionService = new ChatSessionService(prisma, userService);
const agentService = new AgentService(prisma, userService);
const telegramLinkService = new TelegramLinkService(prisma, userService);
const skillService = new SkillService(prisma, userService);
const teamService = new TeamService(prisma, userService);
const voiceProfileService = new VoiceProfileService(prisma, userService, voiceProfileStorage);

const app = createApp({
  userService,
  knowledgeEntryService,
  chatSessionService,
  vaultFolderService,
  agentService,
  telegramLinkService,
  skillService,
  teamService,
  voiceProfileService,
});
const PORT = process.env.PORT || 30025;

app.listen(PORT, () => {
  console.log(`knowledge-store listening on http://localhost:${PORT}`);
});
