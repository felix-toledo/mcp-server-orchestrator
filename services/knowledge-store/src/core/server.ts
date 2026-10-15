import express, { Express, NextFunction, Request, Response } from 'express';
import { createAgentsController } from '../api/agentsController.js';
import { createChatSessionsController } from '../api/chatSessionsController.js';
import { createKnowledgeEntriesController } from '../api/knowledgeEntriesController.js';
import { createSkillsController } from '../api/skillsController.js';
import { createTeamsController } from '../api/teamsController.js';
import { createTelegramLinkController } from '../api/telegramLinkController.js';
import { createUsersController } from '../api/usersController.js';
import { createVaultFoldersController } from '../api/vaultFoldersController.js';
import { createVoiceProfileController } from '../api/voiceProfileController.js';
import type { AgentService } from '../services/agentService.js';
import type { ChatSessionService } from '../services/chatSessionService.js';
import type { KnowledgeEntryService } from '../services/knowledgeEntryService.js';
import type { SkillService } from '../services/skillService.js';
import type { TeamService } from '../services/teamService.js';
import type { TelegramLinkService } from '../services/telegramLinkService.js';
import type { UserService } from '../services/userService.js';
import type { VaultFolderService } from '../services/vaultFolderService.js';
import type { VoiceProfileService } from '../services/voiceProfileService.js';
import { asyncHandler } from './asyncHandler.js';

export interface AppDependencies {
  userService: UserService;
  knowledgeEntryService: KnowledgeEntryService;
  chatSessionService: ChatSessionService;
  vaultFolderService: VaultFolderService;
  agentService: AgentService;
  telegramLinkService: TelegramLinkService;
  skillService: SkillService;
  teamService: TeamService;
  voiceProfileService: VoiceProfileService;
}

export function createApp({
  userService,
  knowledgeEntryService,
  chatSessionService,
  vaultFolderService,
  agentService,
  telegramLinkService,
  skillService,
  teamService,
  voiceProfileService,
}: AppDependencies): Express {
  const usersController = createUsersController(userService);
  const knowledgeEntriesController = createKnowledgeEntriesController(knowledgeEntryService);
  const chatSessionsController = createChatSessionsController(chatSessionService);
  const vaultFoldersController = createVaultFoldersController(vaultFolderService);
  const agentsController = createAgentsController(agentService);
  const telegramLinkController = createTelegramLinkController(telegramLinkService);
  const skillsController = createSkillsController(skillService);
  const teamsController = createTeamsController(teamService);
  const voiceProfileController = createVoiceProfileController(voiceProfileService);

  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.post('/users', asyncHandler(usersController.create));
  app.get('/users/me', asyncHandler(usersController.getCurrent));

  app.post('/knowledge-entries', asyncHandler(knowledgeEntriesController.create));
  app.get('/knowledge-entries', asyncHandler(knowledgeEntriesController.list));
  // Both must come before the /:id route below — Express matches in
  // registration order and /:id would otherwise swallow "search"/"profile"
  // as a literal id.
  app.get('/knowledge-entries/search', asyncHandler(knowledgeEntriesController.search));
  app.get('/knowledge-entries/profile', asyncHandler(knowledgeEntriesController.getProfileNote));
  app.get('/knowledge-entries/:id', asyncHandler(knowledgeEntriesController.getById));
  app.put('/knowledge-entries/:id', asyncHandler(knowledgeEntriesController.update));

  app.post('/vault-folders', asyncHandler(vaultFoldersController.create));
  app.get('/vault-folders', asyncHandler(vaultFoldersController.list));
  app.delete('/vault-folders/:id', asyncHandler(vaultFoldersController.remove));

  app.post('/chat-sessions', asyncHandler(chatSessionsController.create));
  app.get('/chat-sessions', asyncHandler(chatSessionsController.list));
  app.get('/chat-sessions/:id', asyncHandler(chatSessionsController.getById));
  app.post('/chat-sessions/:id/messages', asyncHandler(chatSessionsController.appendMessage));
  app.delete('/chat-sessions/:id', asyncHandler(chatSessionsController.remove));

  app.post('/agents', asyncHandler(agentsController.create));
  app.get('/agents', asyncHandler(agentsController.list));
  app.get('/agents/:id', asyncHandler(agentsController.getById));
  app.put('/agents/:id', asyncHandler(agentsController.update));
  app.delete('/agents/:id', asyncHandler(agentsController.remove));

  app.put('/telegram-link', asyncHandler(telegramLinkController.upsert));
  app.get('/telegram-link', asyncHandler(telegramLinkController.get));
  app.patch('/telegram-link', asyncHandler(telegramLinkController.updateBinding));

  app.post('/skills', asyncHandler(skillsController.create));
  app.get('/skills', asyncHandler(skillsController.list));
  app.get('/skills/:id', asyncHandler(skillsController.getById));
  app.put('/skills/:id', asyncHandler(skillsController.update));
  app.delete('/skills/:id', asyncHandler(skillsController.remove));

  app.post('/teams', asyncHandler(teamsController.create));
  app.get('/teams', asyncHandler(teamsController.list));
  app.get('/teams/:id', asyncHandler(teamsController.getById));
  app.put('/teams/:id', asyncHandler(teamsController.update));
  app.delete('/teams/:id', asyncHandler(teamsController.remove));

  app.get('/voice-profile', asyncHandler(voiceProfileController.get));
  app.post('/voice-profile/enroll', voiceProfileController.uploadMiddleware, asyncHandler(voiceProfileController.enroll));
  app.patch('/voice-profile/tts-preference', asyncHandler(voiceProfileController.updateTtsPreference));
  app.patch('/voice-profile', asyncHandler(voiceProfileController.updateCurrentSession));
  app.delete('/voice-profile', asyncHandler(voiceProfileController.reset));

  // Last-resort net: an error that reaches here means a route rejected
  // without handling it itself. Never let this crash the process — that's
  // the exact bug this middleware exists to close.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error('❌ Unhandled error in knowledge-store request:', err);
    res.status(500).json({ error: 'Internal server error', message: err instanceof Error ? err.message : 'Unknown error' });
  });

  return app;
}
