import type { Request, Response } from 'express';
import { UserAlreadyExistsError, type UserService } from '../services/userService.js';
import { CreateUserInputSchema } from './schemas.js';

export function createUsersController(userService: UserService) {
  return {
    create: async (req: Request, res: Response): Promise<void> => {
      const parsed = CreateUserInputSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid request body', details: parsed.error.issues });
        return;
      }

      try {
        const user = await userService.create(parsed.data);
        res.status(201).json(user);
      } catch (error) {
        if (error instanceof UserAlreadyExistsError) {
          res.status(409).json({ error: error.message });
          return;
        }
        throw error;
      }
    },

    getCurrent: async (_req: Request, res: Response): Promise<void> => {
      const user = await userService.getCurrent();
      if (!user) {
        res.status(404).json({ error: 'No user yet' });
        return;
      }
      res.status(200).json(user);
    },
  };
}
