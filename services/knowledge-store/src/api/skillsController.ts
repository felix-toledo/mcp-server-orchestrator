import type { Request, Response } from 'express';
import type { SkillService } from '../services/skillService.js';
import { SkillInputSchema } from './schemas.js';

export function createSkillsController(skillService: SkillService) {
  return {
    create: async (req: Request, res: Response): Promise<void> => {
      const parsed = SkillInputSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid request body', details: parsed.error.issues });
        return;
      }
      const skill = await skillService.create(parsed.data);
      res.status(201).json(skill);
    },

    list: async (_req: Request, res: Response): Promise<void> => {
      const skills = await skillService.list();
      res.status(200).json(skills);
    },

    getById: async (req: Request, res: Response): Promise<void> => {
      const skill = await skillService.getById(req.params.id);
      if (!skill) {
        res.status(404).json({ error: 'Skill not found' });
        return;
      }
      res.status(200).json(skill);
    },

    update: async (req: Request, res: Response): Promise<void> => {
      const parsed = SkillInputSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid request body', details: parsed.error.issues });
        return;
      }
      try {
        const skill = await skillService.update(req.params.id, parsed.data);
        res.status(200).json(skill);
      } catch {
        res.status(404).json({ error: 'Skill not found' });
      }
    },

    remove: async (req: Request, res: Response): Promise<void> => {
      try {
        await skillService.delete(req.params.id);
        res.status(204).send();
      } catch {
        res.status(404).json({ error: 'Skill not found' });
      }
    },
  };
}
