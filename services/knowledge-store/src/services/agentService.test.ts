import { Prisma, type PrismaClient } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentService } from './agentService.js';
import type { UserService } from './userService.js';

function createPrismaMock() {
  return {
    agent: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };
}

describe('AgentService', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let userService: { getCurrent: ReturnType<typeof vi.fn> };
  let service: AgentService;

  const stored = {
    id: 'a1',
    name: 'Bibliotecario',
    systemPromptAddendum: 'Sé más formal.',
    allowedTools: null,
    allowedSkills: null,
    pipelineSteps: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  beforeEach(() => {
    prisma = createPrismaMock();
    userService = { getCurrent: vi.fn().mockResolvedValue({ id: 'user-1' }) };
    service = new AgentService(prisma as unknown as PrismaClient, userService as unknown as UserService);
  });

  describe('create', () => {
    it('AC1: an absent allowedTools/allowedSkills/pipelineSteps is stored as null (inherit everything)', async () => {
      prisma.agent.create.mockResolvedValue(stored);

      await service.create({ name: 'Bibliotecario', systemPromptAddendum: 'Sé más formal.' });

      expect(prisma.agent.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          name: 'Bibliotecario',
          systemPromptAddendum: 'Sé más formal.',
          allowedTools: Prisma.JsonNull,
          allowedSkills: Prisma.JsonNull,
          pipelineSteps: Prisma.JsonNull,
        },
      });
    });

    it('AC1: an explicit [] is preserved as "none", not normalized to null', async () => {
      prisma.agent.create.mockResolvedValue({ ...stored, allowedTools: [] });

      await service.create({ name: 'Bibliotecario', systemPromptAddendum: 'x', allowedTools: [] });

      expect(prisma.agent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ allowedTools: [] }),
      });
    });

    it('round-trips a null column back to null, not undefined', async () => {
      prisma.agent.create.mockResolvedValue(stored);
      const result = await service.create({ name: 'Bibliotecario', systemPromptAddendum: 'x' });
      expect(result.allowedTools).toBeNull();
      expect(result.allowedSkills).toBeNull();
      expect(result.pipelineSteps).toBeNull();
    });

    it('throws when no user has completed onboarding yet', async () => {
      userService.getCurrent.mockResolvedValue(null);
      await expect(service.create({ name: 'x', systemPromptAddendum: 'y' })).rejects.toThrow(/onboarding/);
      expect(prisma.agent.create).not.toHaveBeenCalled();
    });
  });

  describe('list', () => {
    it('returns every configured agent', async () => {
      prisma.agent.findMany.mockResolvedValue([stored]);
      const result = await service.list();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('a1');
    });
  });

  describe('getById', () => {
    it('returns null instead of throwing when the agent does not exist', async () => {
      prisma.agent.findUnique.mockResolvedValue(null);
      await expect(service.getById('missing')).resolves.toBeNull();
    });
  });

  describe('update', () => {
    it('overwrites allowedTools with an explicit [] rather than leaving it unset', async () => {
      prisma.agent.update.mockResolvedValue({ ...stored, allowedTools: [] });

      await service.update('a1', { name: 'Bibliotecario', systemPromptAddendum: 'x', allowedTools: [] });

      expect(prisma.agent.update).toHaveBeenCalledWith({
        where: { id: 'a1' },
        data: expect.objectContaining({ allowedTools: [] }),
      });
    });
  });

  describe('delete', () => {
    it('deletes the agent by id', async () => {
      await service.delete('a1');
      expect(prisma.agent.delete).toHaveBeenCalledWith({ where: { id: 'a1' } });
    });
  });
});
