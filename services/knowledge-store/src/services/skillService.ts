import type { PrismaClient } from '@prisma/client';
import type { SkillInput } from '../api/schemas.js';
import type { UserService } from './userService.js';

export interface SkillSummary {
  id: string;
  name: string;
  description: string;
  instructions: string;
  createdAt: Date;
  updatedAt: Date;
}

function toSummary(skill: SkillSummary): SkillSummary {
  return skill;
}

export class SkillService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly userService: UserService,
  ) {}

  async create(input: SkillInput): Promise<SkillSummary> {
    const user = await this.userService.getCurrent();
    if (!user) {
      throw new Error('Cannot create a skill before onboarding');
    }

    const skill = await this.prisma.skill.create({
      data: {
        userId: user.id,
        name: input.name,
        description: input.description,
        instructions: input.instructions,
      },
    });
    return toSummary(skill);
  }

  async list(): Promise<SkillSummary[]> {
    const skills = await this.prisma.skill.findMany({ orderBy: { createdAt: 'asc' } });
    return skills.map(toSummary);
  }

  async getById(id: string): Promise<SkillSummary | null> {
    const skill = await this.prisma.skill.findUnique({ where: { id } });
    return skill ? toSummary(skill) : null;
  }

  async update(id: string, input: SkillInput): Promise<SkillSummary> {
    const skill = await this.prisma.skill.update({
      where: { id },
      data: { name: input.name, description: input.description, instructions: input.instructions },
    });
    return toSummary(skill);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.skill.delete({ where: { id } });
  }
}
