import express, { Express } from 'express';
import { createKnowledgeEntriesController } from '../api/knowledgeEntriesController.js';
import { createUsersController } from '../api/usersController.js';
import type { KnowledgeEntryService } from '../services/knowledgeEntryService.js';
import type { UserService } from '../services/userService.js';

export interface AppDependencies {
  userService: UserService;
  knowledgeEntryService: KnowledgeEntryService;
}

export function createApp({ userService, knowledgeEntryService }: AppDependencies): Express {
  const usersController = createUsersController(userService);
  const knowledgeEntriesController = createKnowledgeEntriesController(knowledgeEntryService);

  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.post('/users', usersController.create);
  app.get('/users/me', usersController.getCurrent);

  app.post('/knowledge-entries', knowledgeEntriesController.create);
  app.get('/knowledge-entries', knowledgeEntriesController.list);
  // Must come before the /:id route below — Express matches in registration
  // order and /:id would otherwise swallow "search" as a literal id.
  app.get('/knowledge-entries/search', knowledgeEntriesController.search);
  app.get('/knowledge-entries/:id', knowledgeEntriesController.getById);
  app.put('/knowledge-entries/:id', knowledgeEntriesController.update);

  return app;
}
