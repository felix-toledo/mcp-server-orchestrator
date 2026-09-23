import type { PrismaClient } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatSessionService } from './chatSessionService.js';
import type { UserService } from './userService.js';

const now = new Date('2026-09-17T00:00:00.000Z');

function createPrismaMock() {
  return {
    chatSession: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    chatMessage: {
      create: vi.fn(),
    },
  };
}

describe('ChatSessionService', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let userService: { getCurrent: ReturnType<typeof vi.fn> };
  let service: ChatSessionService;

  beforeEach(() => {
    prisma = createPrismaMock();
    userService = { getCurrent: vi.fn().mockResolvedValue({ id: 'user-1' }) };
    service = new ChatSessionService(prisma as unknown as PrismaClient, userService as unknown as UserService);
  });

  it('AC1: creates a session for the current user', async () => {
    prisma.chatSession.create.mockResolvedValue({ id: 's1', title: null, createdAt: now, updatedAt: now });

    const result = await service.create();

    expect(prisma.chatSession.create).toHaveBeenCalledWith({ data: { userId: 'user-1', teamId: undefined } });
    expect(result.id).toBe('s1');
  });

  it('team-chat amendment: tags the session with a teamId when given', async () => {
    prisma.chatSession.create.mockResolvedValue({ id: 's1', title: null, createdAt: now, updatedAt: now });

    await service.create('t1');

    expect(prisma.chatSession.create).toHaveBeenCalledWith({ data: { userId: 'user-1', teamId: 't1' } });
  });

  it('throws when no user has completed onboarding yet', async () => {
    userService.getCurrent.mockResolvedValue(null);
    await expect(service.create()).rejects.toThrow(/onboarding/);
    expect(prisma.chatSession.create).not.toHaveBeenCalled();
  });

  it('AC2: list() returns sessions sorted by updatedAt desc, excluding team-scoped ones', async () => {
    prisma.chatSession.findMany.mockResolvedValue([]);
    await service.list();
    expect(prisma.chatSession.findMany).toHaveBeenCalledWith({ where: { teamId: null }, orderBy: { updatedAt: 'desc' } });
  });

  it('AC3: getById() returns the session with chronological messages', async () => {
    prisma.chatSession.findUnique.mockResolvedValue({
      id: 's1',
      title: 'Charla',
      createdAt: now,
      updatedAt: now,
      messages: [{ id: 'm1', role: 'USER', content: 'hola', createdAt: now }],
    });

    const result = await service.getById('s1');

    expect(result?.messages).toHaveLength(1);
    expect(prisma.chatSession.findUnique).toHaveBeenCalledWith({
      where: { id: 's1' },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
  });

  it('getById() returns null when the session does not exist', async () => {
    prisma.chatSession.findUnique.mockResolvedValue(null);
    await expect(service.getById('missing')).resolves.toBeNull();
  });

  it('AC4: titles the session from the first USER message only', async () => {
    prisma.chatSession.findUniqueOrThrow.mockResolvedValueOnce({ id: 's1', title: null });
    prisma.chatMessage.create.mockResolvedValue({ id: 'm1', role: 'USER', content: 'mi primer mensaje', createdAt: now });

    await service.appendMessage('s1', { role: 'USER', content: 'mi primer mensaje' });

    expect(prisma.chatSession.update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: { title: 'mi primer mensaje' },
    });
  });

  it('AC4: does not re-title a session that already has one', async () => {
    prisma.chatSession.findUniqueOrThrow.mockResolvedValueOnce({ id: 's1', title: 'Ya tiene título' });
    prisma.chatMessage.create.mockResolvedValue({ id: 'm2', role: 'USER', content: 'otro mensaje', createdAt: now });

    await service.appendMessage('s1', { role: 'USER', content: 'otro mensaje' });

    expect(prisma.chatSession.update).toHaveBeenCalledWith({ where: { id: 's1' }, data: {} });
  });

  it('AC4: an ASSISTANT message never titles the session', async () => {
    prisma.chatSession.findUniqueOrThrow.mockResolvedValueOnce({ id: 's1', title: null });
    prisma.chatMessage.create.mockResolvedValue({ id: 'm3', role: 'ASSISTANT', content: 'respuesta', createdAt: now });

    await service.appendMessage('s1', { role: 'ASSISTANT', content: 'respuesta' });

    expect(prisma.chatSession.update).toHaveBeenCalledWith({ where: { id: 's1' }, data: {} });
  });

  it('AC5: delete() removes the session', async () => {
    await service.delete('s1');
    expect(prisma.chatSession.delete).toHaveBeenCalledWith({ where: { id: 's1' } });
  });
});
