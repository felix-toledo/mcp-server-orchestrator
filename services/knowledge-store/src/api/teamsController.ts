import type { Request, Response } from 'express';
import { CoordinatorNotAMemberError, InvalidHierarchyError, type TeamService } from '../services/teamService.js';
import { TeamInputSchema } from './schemas.js';

function isValidationError(error: unknown): error is Error {
  return error instanceof CoordinatorNotAMemberError || error instanceof InvalidHierarchyError;
}

export function createTeamsController(teamService: TeamService) {
  return {
    create: async (req: Request, res: Response): Promise<void> => {
      const parsed = TeamInputSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid request body', details: parsed.error.issues });
        return;
      }
      try {
        const team = await teamService.create(parsed.data);
        res.status(201).json(team);
      } catch (error) {
        if (isValidationError(error)) {
          res.status(400).json({ error: error.message });
          return;
        }
        throw error;
      }
    },

    list: async (_req: Request, res: Response): Promise<void> => {
      const teams = await teamService.list();
      res.status(200).json(teams);
    },

    getById: async (req: Request, res: Response): Promise<void> => {
      const team = await teamService.getById(req.params.id);
      if (!team) {
        res.status(404).json({ error: 'Team not found' });
        return;
      }
      res.status(200).json(team);
    },

    update: async (req: Request, res: Response): Promise<void> => {
      const parsed = TeamInputSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid request body', details: parsed.error.issues });
        return;
      }
      try {
        const team = await teamService.update(req.params.id, parsed.data);
        res.status(200).json(team);
      } catch (error) {
        if (isValidationError(error)) {
          res.status(400).json({ error: error.message });
          return;
        }
        res.status(404).json({ error: 'Team not found' });
      }
    },

    remove: async (req: Request, res: Response): Promise<void> => {
      try {
        await teamService.delete(req.params.id);
        res.status(204).send();
      } catch {
        res.status(404).json({ error: 'Team not found' });
      }
    },
  };
}
