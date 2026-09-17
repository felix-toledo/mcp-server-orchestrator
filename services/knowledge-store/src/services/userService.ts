import type { PrismaClient, User } from '@prisma/client';
import type { CreateUserInput } from '../api/schemas.js';

export class UserAlreadyExistsError extends Error {
  constructor() {
    super('A user already exists for this ALMA instance');
    this.name = 'UserAlreadyExistsError';
  }
}

export class UserService {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateUserInput): Promise<User> {
    const existing = await this.prisma.user.findFirst();
    if (existing) {
      throw new UserAlreadyExistsError();
    }
    return this.prisma.user.create({ data: input });
  }

  async getCurrent(): Promise<User | null> {
    return this.prisma.user.findFirst();
  }
}
