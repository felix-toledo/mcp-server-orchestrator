import { Prisma, type PrismaClient } from '@prisma/client';
import type { AgentInput } from '../api/schemas.js';
import type { UserService } from './userService.js';

// Prisma's Json? columns treat a plain `null` as ambiguous with `undefined`
// (field left untouched) — writing an actual JSON null requires this
// sentinel instead (found during implementation, same class of gotcha as
// the `embedding Unsupported` one documented in CLAUDE.md). Generic (not
// just string[]) since `TeamService` reuses it for both
// `allowedSkillIds: string[] | null` and `hierarchy: HierarchyEntry[] | null`.
export function jsonOrNull<T>(value: T | null | undefined): T | typeof Prisma.JsonNull {
  return value ?? Prisma.JsonNull;
}

export interface AgentSummary {
  id: string;
  name: string;
  systemPromptAddendum: string;
  allowedTools: string[] | null;
  allowedSkills: string[] | null;
  pipelineSteps: string[] | null;
  createdAt: Date;
  updatedAt: Date;
}

function toSummary(agent: {
  id: string;
  name: string;
  systemPromptAddendum: string;
  allowedTools: unknown;
  allowedSkills: unknown;
  pipelineSteps: unknown;
  createdAt: Date;
  updatedAt: Date;
}): AgentSummary {
  return {
    id: agent.id,
    name: agent.name,
    systemPromptAddendum: agent.systemPromptAddendum,
    allowedTools: (agent.allowedTools as string[] | null) ?? null,
    allowedSkills: (agent.allowedSkills as string[] | null) ?? null,
    pipelineSteps: (agent.pipelineSteps as string[] | null) ?? null,
    createdAt: agent.createdAt,
    updatedAt: agent.updatedAt,
  };
}

export class AgentService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly userService: UserService,
  ) {}

  /**
   * spec §5.1: an absent field means "inherit everything" (no restriction),
   * stored as `null` — an explicit `[]` means "none." Both are distinct
   * from a Json? column's own `undefined` (field left untouched on update),
   * so an absent key must be normalized to `null` here, not left as-is.
   */
  async create(input: AgentInput): Promise<AgentSummary> {
    const user = await this.userService.getCurrent();
    if (!user) {
      throw new Error('Cannot create an agent before onboarding');
    }

    const agent = await this.prisma.agent.create({
      data: {
        userId: user.id,
        name: input.name,
        systemPromptAddendum: input.systemPromptAddendum,
        allowedTools: jsonOrNull(input.allowedTools),
        allowedSkills: jsonOrNull(input.allowedSkills),
        pipelineSteps: jsonOrNull(input.pipelineSteps),
      },
    });
    return toSummary(agent);
  }

  async list(): Promise<AgentSummary[]> {
    const agents = await this.prisma.agent.findMany({ orderBy: { createdAt: 'asc' } });
    return agents.map(toSummary);
  }

  async getById(id: string): Promise<AgentSummary | null> {
    const agent = await this.prisma.agent.findUnique({ where: { id } });
    return agent ? toSummary(agent) : null;
  }

  async update(id: string, input: AgentInput): Promise<AgentSummary> {
    const agent = await this.prisma.agent.update({
      where: { id },
      data: {
        name: input.name,
        systemPromptAddendum: input.systemPromptAddendum,
        allowedTools: jsonOrNull(input.allowedTools),
        allowedSkills: jsonOrNull(input.allowedSkills),
        pipelineSteps: jsonOrNull(input.pipelineSteps),
      },
    });
    return toSummary(agent);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.agent.delete({ where: { id } });
  }
}
