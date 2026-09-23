import { Prisma, type PrismaClient } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CoordinatorNotAMemberError, InvalidHierarchyError, TeamService } from './teamService.js';
import type { UserService } from './userService.js';

function createPrismaMock() {
  return {
    team: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };
}

describe('TeamService', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let userService: { getCurrent: ReturnType<typeof vi.fn> };
  let service: TeamService;

  const stored = {
    id: 't1',
    name: 'Marketing',
    memberAgentIds: ['a1', 'a2'],
    coordinatorAgentId: 'a1',
    projectFolderIds: ['f1'],
    allowedSkillIds: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  beforeEach(() => {
    prisma = createPrismaMock();
    userService = { getCurrent: vi.fn().mockResolvedValue({ id: 'user-1' }) };
    service = new TeamService(prisma as unknown as PrismaClient, userService as unknown as UserService);
  });

  describe('create', () => {
    it('AC1: creates a team when the coordinator is a real member', async () => {
      prisma.team.create.mockResolvedValue(stored);

      await service.create({
        name: 'Marketing',
        memberAgentIds: ['a1', 'a2'],
        coordinatorAgentId: 'a1',
        projectFolderIds: ['f1'],
      });

      expect(prisma.team.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          name: 'Marketing',
          memberAgentIds: ['a1', 'a2'],
          coordinatorAgentId: 'a1',
          hierarchy: Prisma.JsonNull,
          projectFolderIds: ['f1'],
          allowedSkillIds: Prisma.JsonNull,
        },
      });
    });

    it('AC1: rejects a coordinatorAgentId that is not in memberAgentIds', async () => {
      await expect(
        service.create({
          name: 'Marketing',
          memberAgentIds: ['a1', 'a2'],
          coordinatorAgentId: 'a3',
          projectFolderIds: [],
        }),
      ).rejects.toThrow(CoordinatorNotAMemberError);
      expect(prisma.team.create).not.toHaveBeenCalled();
    });

    it('preserves an explicit allowedSkillIds array', async () => {
      prisma.team.create.mockResolvedValue({ ...stored, allowedSkillIds: ['s1'] });

      await service.create({
        name: 'Marketing',
        memberAgentIds: ['a1'],
        coordinatorAgentId: 'a1',
        projectFolderIds: [],
        allowedSkillIds: ['s1'],
      });

      expect(prisma.team.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ allowedSkillIds: ['s1'] }) }));
    });

    it('throws when no user has completed onboarding yet', async () => {
      userService.getCurrent.mockResolvedValue(null);
      await expect(
        service.create({ name: 'x', memberAgentIds: ['a1'], coordinatorAgentId: 'a1', projectFolderIds: [] }),
      ).rejects.toThrow(/onboarding/);
    });

    it('rejects a hierarchy entry whose agentId is not a member', async () => {
      await expect(
        service.create({
          name: 'Marketing',
          memberAgentIds: ['a1', 'a2'],
          coordinatorAgentId: 'a1',
          projectFolderIds: [],
          hierarchy: [{ agentId: 'a3', managerAgentId: 'a1' }],
        }),
      ).rejects.toThrow(InvalidHierarchyError);
      expect(prisma.team.create).not.toHaveBeenCalled();
    });

    it('rejects a hierarchy entry whose managerAgentId is not a member', async () => {
      await expect(
        service.create({
          name: 'Marketing',
          memberAgentIds: ['a1', 'a2'],
          coordinatorAgentId: 'a1',
          projectFolderIds: [],
          hierarchy: [{ agentId: 'a2', managerAgentId: 'a3' }],
        }),
      ).rejects.toThrow(InvalidHierarchyError);
      expect(prisma.team.create).not.toHaveBeenCalled();
    });

    it('allows a null managerAgentId (the coordinator, at the top of the chart)', async () => {
      prisma.team.create.mockResolvedValue({
        ...stored,
        hierarchy: [{ agentId: 'a1', managerAgentId: null }],
      });

      await service.create({
        name: 'Marketing',
        memberAgentIds: ['a1', 'a2'],
        coordinatorAgentId: 'a1',
        projectFolderIds: [],
        hierarchy: [{ agentId: 'a1', managerAgentId: null }],
      });

      expect(prisma.team.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ hierarchy: [{ agentId: 'a1', managerAgentId: null }] }),
        }),
      );
    });

    it('round-trips a valid hierarchy through toSummary', async () => {
      const hierarchy = [
        { agentId: 'a1', managerAgentId: null },
        { agentId: 'a2', managerAgentId: 'a1' },
      ];
      prisma.team.create.mockResolvedValue({ ...stored, hierarchy });

      const result = await service.create({
        name: 'Marketing',
        memberAgentIds: ['a1', 'a2'],
        coordinatorAgentId: 'a1',
        projectFolderIds: [],
        hierarchy,
      });

      expect(result.hierarchy).toEqual(hierarchy);
    });
  });

  describe('list', () => {
    it('returns every configured team', async () => {
      prisma.team.findMany.mockResolvedValue([stored]);
      const result = await service.list();
      expect(result).toHaveLength(1);
      expect(result[0].memberAgentIds).toEqual(['a1', 'a2']);
    });

    it('defaults hierarchy to null when not configured (full mesh)', async () => {
      prisma.team.findMany.mockResolvedValue([stored]);
      const result = await service.list();
      expect(result[0].hierarchy).toBeNull();
    });
  });

  describe('getById', () => {
    it('returns null instead of throwing when the team does not exist', async () => {
      prisma.team.findUnique.mockResolvedValue(null);
      await expect(service.getById('missing')).resolves.toBeNull();
    });
  });

  describe('update', () => {
    it('AC1: rejects a coordinatorAgentId that is not in the updated memberAgentIds', async () => {
      await expect(
        service.update('t1', {
          name: 'Marketing',
          memberAgentIds: ['a2'],
          coordinatorAgentId: 'a1',
          projectFolderIds: [],
        }),
      ).rejects.toThrow(CoordinatorNotAMemberError);
      expect(prisma.team.update).not.toHaveBeenCalled();
    });

    it('rejects an updated hierarchy referencing a non-member', async () => {
      await expect(
        service.update('t1', {
          name: 'Marketing',
          memberAgentIds: ['a1', 'a2'],
          coordinatorAgentId: 'a1',
          projectFolderIds: [],
          hierarchy: [{ agentId: 'a1', managerAgentId: null }, { agentId: 'a9', managerAgentId: 'a1' }],
        }),
      ).rejects.toThrow(InvalidHierarchyError);
      expect(prisma.team.update).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('deletes the team by id', async () => {
      await service.delete('t1');
      expect(prisma.team.delete).toHaveBeenCalledWith({ where: { id: 't1' } });
    });
  });
});
