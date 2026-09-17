import type { PrismaClient } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserAlreadyExistsError, UserService } from './userService.js';

function createPrismaMock() {
  return {
    user: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  };
}

describe('UserService', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let service: UserService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new UserService(prisma as unknown as PrismaClient);
  });

  it('creates the user when none exists yet', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: 'u1', name: 'Felix', email: 'f@x.com', purpose: 'PERSONAL_DAILY' });

    const input = { name: 'Felix', email: 'f@x.com', purpose: 'PERSONAL_DAILY' as const };
    const result = await service.create(input);

    expect(result.id).toBe('u1');
    expect(prisma.user.create).toHaveBeenCalledWith({ data: input });
  });

  it('throws UserAlreadyExistsError when a user already exists', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'u1' });

    await expect(
      service.create({ name: 'Felix', email: 'f@x.com', purpose: 'PERSONAL_DAILY' as const }),
    ).rejects.toBeInstanceOf(UserAlreadyExistsError);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('getCurrent returns null with no user row', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(service.getCurrent()).resolves.toBeNull();
  });
});
