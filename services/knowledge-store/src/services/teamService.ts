import type { PrismaClient } from '@prisma/client';
import type { HierarchyEntry, TeamInput } from '../api/schemas.js';
import { jsonOrNull } from './agentService.js';
import type { UserService } from './userService.js';

export interface TeamSummary {
  id: string;
  name: string;
  memberAgentIds: string[];
  coordinatorAgentId: string;
  hierarchy: HierarchyEntry[] | null;
  projectFolderIds: string[];
  allowedSkillIds: string[] | null;
  createdAt: Date;
  updatedAt: Date;
}

export class CoordinatorNotAMemberError extends Error {
  constructor() {
    super('coordinatorAgentId must be one of memberAgentIds');
  }
}

export class InvalidHierarchyError extends Error {
  constructor() {
    super('every hierarchy agentId/managerAgentId must be one of memberAgentIds');
  }
}

function toSummary(team: {
  id: string;
  name: string;
  memberAgentIds: unknown;
  coordinatorAgentId: string;
  hierarchy: unknown;
  projectFolderIds: unknown;
  allowedSkillIds: unknown;
  createdAt: Date;
  updatedAt: Date;
}): TeamSummary {
  return {
    id: team.id,
    name: team.name,
    memberAgentIds: team.memberAgentIds as string[],
    coordinatorAgentId: team.coordinatorAgentId,
    hierarchy: (team.hierarchy as HierarchyEntry[] | null) ?? null,
    projectFolderIds: team.projectFolderIds as string[],
    allowedSkillIds: (team.allowedSkillIds as string[] | null) ?? null,
    createdAt: team.createdAt,
    updatedAt: team.updatedAt,
  };
}

function assertCoordinatorIsMember(input: TeamInput): void {
  if (!input.memberAgentIds.includes(input.coordinatorAgentId)) {
    throw new CoordinatorNotAMemberError();
  }
}

function assertHierarchyIsValid(input: TeamInput): void {
  if (!input.hierarchy) {
    return;
  }
  const members = new Set(input.memberAgentIds);
  for (const entry of input.hierarchy) {
    if (!members.has(entry.agentId)) {
      throw new InvalidHierarchyError();
    }
    if (entry.managerAgentId !== null && !members.has(entry.managerAgentId)) {
      throw new InvalidHierarchyError();
    }
  }
}

export class TeamService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly userService: UserService,
  ) {}

  /** AC1 — coordinatorAgentId must be a real member (AC5 needs this to always resolve). */
  async create(input: TeamInput): Promise<TeamSummary> {
    assertCoordinatorIsMember(input);
    assertHierarchyIsValid(input);

    const user = await this.userService.getCurrent();
    if (!user) {
      throw new Error('Cannot create a team before onboarding');
    }

    const team = await this.prisma.team.create({
      data: {
        userId: user.id,
        name: input.name,
        memberAgentIds: input.memberAgentIds,
        coordinatorAgentId: input.coordinatorAgentId,
        hierarchy: jsonOrNull(input.hierarchy),
        projectFolderIds: input.projectFolderIds,
        allowedSkillIds: jsonOrNull(input.allowedSkillIds),
      },
    });
    return toSummary(team);
  }

  async list(): Promise<TeamSummary[]> {
    const teams = await this.prisma.team.findMany({ orderBy: { createdAt: 'asc' } });
    return teams.map(toSummary);
  }

  async getById(id: string): Promise<TeamSummary | null> {
    const team = await this.prisma.team.findUnique({ where: { id } });
    return team ? toSummary(team) : null;
  }

  async update(id: string, input: TeamInput): Promise<TeamSummary> {
    assertCoordinatorIsMember(input);
    assertHierarchyIsValid(input);

    const team = await this.prisma.team.update({
      where: { id },
      data: {
        name: input.name,
        memberAgentIds: input.memberAgentIds,
        coordinatorAgentId: input.coordinatorAgentId,
        hierarchy: jsonOrNull(input.hierarchy),
        projectFolderIds: input.projectFolderIds,
        allowedSkillIds: jsonOrNull(input.allowedSkillIds),
      },
    });
    return toSummary(team);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.team.delete({ where: { id } });
  }
}
