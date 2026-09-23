import type { PrismaClient } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SkillService } from './skillService.js';
import type { UserService } from './userService.js';

function createPrismaMock() {
  return {
    skill: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };
}

describe('SkillService', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let userService: { getCurrent: ReturnType<typeof vi.fn> };
  let service: SkillService;

  const stored = {
    id: 's1',
    name: 'Redacción formal',
    description: 'Usar cuando el usuario pida un tono formal o profesional.',
    instructions: 'Escribí siempre en tercera persona, evitá coloquialismos.',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  beforeEach(() => {
    prisma = createPrismaMock();
    userService = { getCurrent: vi.fn().mockResolvedValue({ id: 'user-1' }) };
    service = new SkillService(prisma as unknown as PrismaClient, userService as unknown as UserService);
  });

  describe('create', () => {
    it('AC1: creates a skill with all three required fields', async () => {
      prisma.skill.create.mockResolvedValue(stored);

      await service.create({ name: stored.name, description: stored.description, instructions: stored.instructions });

      expect(prisma.skill.create).toHaveBeenCalledWith({
        data: { userId: 'user-1', name: stored.name, description: stored.description, instructions: stored.instructions },
      });
    });

    it('throws when no user has completed onboarding yet', async () => {
      userService.getCurrent.mockResolvedValue(null);
      await expect(service.create({ name: 'x', description: 'y', instructions: 'z' })).rejects.toThrow(/onboarding/);
      expect(prisma.skill.create).not.toHaveBeenCalled();
    });
  });

  describe('list', () => {
    it('returns every configured skill', async () => {
      prisma.skill.findMany.mockResolvedValue([stored]);
      const result = await service.list();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('s1');
    });
  });

  describe('getById', () => {
    it('returns null instead of throwing when the skill does not exist', async () => {
      prisma.skill.findUnique.mockResolvedValue(null);
      await expect(service.getById('missing')).resolves.toBeNull();
    });
  });

  describe('update', () => {
    it('overwrites all three fields', async () => {
      prisma.skill.update.mockResolvedValue({ ...stored, description: 'nueva descripción' });

      await service.update('s1', { name: stored.name, description: 'nueva descripción', instructions: stored.instructions });

      expect(prisma.skill.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: { name: stored.name, description: 'nueva descripción', instructions: stored.instructions },
      });
    });
  });

  describe('delete', () => {
    it('deletes the skill by id', async () => {
      await service.delete('s1');
      expect(prisma.skill.delete).toHaveBeenCalledWith({ where: { id: 's1' } });
    });
  });
});
