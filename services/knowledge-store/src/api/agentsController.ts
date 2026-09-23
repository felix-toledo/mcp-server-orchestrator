import type { Request, Response } from 'express';
import type { AgentService } from '../services/agentService.js';
import { AgentInputSchema } from './schemas.js';

export function createAgentsController(agentService: AgentService) {
  return {
    create: async (req: Request, res: Response): Promise<void> => {
      const parsed = AgentInputSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid request body', details: parsed.error.issues });
        return;
      }
      const agent = await agentService.create(parsed.data);
      res.status(201).json(agent);
    },

    list: async (_req: Request, res: Response): Promise<void> => {
      const agents = await agentService.list();
      res.status(200).json(agents);
    },

    getById: async (req: Request, res: Response): Promise<void> => {
      const agent = await agentService.getById(req.params.id);
      if (!agent) {
        res.status(404).json({ error: 'Agent not found' });
        return;
      }
      res.status(200).json(agent);
    },

    update: async (req: Request, res: Response): Promise<void> => {
      const parsed = AgentInputSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid request body', details: parsed.error.issues });
        return;
      }
      try {
        const agent = await agentService.update(req.params.id, parsed.data);
        res.status(200).json(agent);
      } catch {
        res.status(404).json({ error: 'Agent not found' });
      }
    },

    remove: async (req: Request, res: Response): Promise<void> => {
      try {
        await agentService.delete(req.params.id);
        res.status(204).send();
      } catch {
        res.status(404).json({ error: 'Agent not found' });
      }
    },
  };
}
