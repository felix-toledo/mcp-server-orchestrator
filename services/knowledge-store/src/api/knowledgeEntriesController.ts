import type { Request, Response } from 'express';
import type { KnowledgeEntryService } from '../services/knowledgeEntryService.js';
import {
  CreateKnowledgeEntryInputSchema,
  SearchKnowledgeEntriesQuerySchema,
  UpdateKnowledgeEntryInputSchema,
} from './schemas.js';

export function createKnowledgeEntriesController(knowledgeEntryService: KnowledgeEntryService) {
  return {
    create: async (req: Request, res: Response): Promise<void> => {
      const parsed = CreateKnowledgeEntryInputSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid request body', details: parsed.error.issues });
        return;
      }
      const entry = await knowledgeEntryService.create(parsed.data);
      res.status(201).json(entry);
    },

    list: async (_req: Request, res: Response): Promise<void> => {
      const entries = await knowledgeEntryService.list();
      res.status(200).json(entries);
    },

    search: async (req: Request, res: Response): Promise<void> => {
      const parsed = SearchKnowledgeEntriesQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid query', details: parsed.error.issues });
        return;
      }
      const results = await knowledgeEntryService.search(parsed.data.q, parsed.data.limit);
      res.status(200).json(results);
    },

    /** 2026-09-18 addendum — direct lookup, not a search result; see KnowledgeEntryService.getProfileNote's doc comment. */
    getProfileNote: async (_req: Request, res: Response): Promise<void> => {
      const note = await knowledgeEntryService.getProfileNote();
      if (!note) {
        res.status(404).json({ error: 'No profile note yet' });
        return;
      }
      res.status(200).json(note);
    },

    getById: async (req: Request, res: Response): Promise<void> => {
      const entry = await knowledgeEntryService.getById(req.params.id);
      if (!entry) {
        res.status(404).json({ error: 'Knowledge entry not found' });
        return;
      }
      res.status(200).json(entry);
    },

    update: async (req: Request, res: Response): Promise<void> => {
      const parsed = UpdateKnowledgeEntryInputSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid request body', details: parsed.error.issues });
        return;
      }
      const entry = await knowledgeEntryService.update(req.params.id, parsed.data);
      res.status(200).json(entry);
    },
  };
}
