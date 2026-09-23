import type { Request, Response } from 'express';
import type { VaultFolderService } from '../services/vaultFolderService.js';
import { CreateVaultFolderInputSchema } from './schemas.js';

export function createVaultFoldersController(vaultFolderService: VaultFolderService) {
  return {
    create: async (req: Request, res: Response): Promise<void> => {
      const parsed = CreateVaultFolderInputSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid request body', details: parsed.error.issues });
        return;
      }
      const folder = await vaultFolderService.create(parsed.data.path);
      res.status(201).json(folder);
    },

    list: async (_req: Request, res: Response): Promise<void> => {
      const folders = await vaultFolderService.list();
      res.status(200).json(folders);
    },

    remove: async (req: Request, res: Response): Promise<void> => {
      try {
        await vaultFolderService.delete(req.params.id);
        res.status(204).send();
      } catch {
        res.status(404).json({ error: 'Vault folder not found' });
      }
    },
  };
}
