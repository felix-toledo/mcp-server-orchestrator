import type { ChatMessageRole, PrismaClient } from '@prisma/client';
import type { AppendChatMessageInput } from '../api/schemas.js';
import { plainTextExcerpt } from './plainTextExcerpt.js';
import type { UserService } from './userService.js';

const TITLE_LENGTH = 60;

export interface ChatSessionSummary {
  id: string;
  title: string | null;
  updatedAt: Date;
}

export interface ChatSessionDetail extends ChatSessionSummary {
  createdAt: Date;
  messages: Array<{ id: string; role: ChatMessageRole; content: string; createdAt: Date }>;
}

function toSummary(session: { id: string; title: string | null; updatedAt: Date }): ChatSessionSummary {
  return { id: session.id, title: session.title, updatedAt: session.updatedAt };
}

export class ChatSessionService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly userService: UserService,
  ) {}

  async create(teamId?: string): Promise<ChatSessionSummary & { createdAt: Date }> {
    const user = await this.userService.getCurrent();
    if (!user) {
      throw new Error('Cannot create a chat session before onboarding');
    }
    return this.prisma.chatSession.create({ data: { userId: user.id, teamId } });
  }

  /**
   * team-chat amendment — only ever returns main-chat sessions
   * (`teamId: null`). The Teams tab's own chat panel manages its
   * team-scoped sessions itself; the main sidebar has no UI for them and
   * showing an untitled, team-tagged row there would be confusing, not
   * useful.
   */
  async list(): Promise<ChatSessionSummary[]> {
    const sessions = await this.prisma.chatSession.findMany({
      where: { teamId: null },
      orderBy: { updatedAt: 'desc' },
    });
    return sessions.map(toSummary);
  }

  async getById(id: string): Promise<ChatSessionDetail | null> {
    const session = await this.prisma.chatSession.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!session) {
      return null;
    }
    return { ...toSummary(session), createdAt: session.createdAt, messages: session.messages };
  }

  async appendMessage(sessionId: string, input: AppendChatMessageInput) {
    const session = await this.prisma.chatSession.findUniqueOrThrow({ where: { id: sessionId } });

    const message = await this.prisma.chatMessage.create({
      data: { sessionId, role: input.role, content: input.content },
    });

    const shouldTitle = input.role === 'USER' && session.title === null;
    // @updatedAt bumps automatically on any .update() call, titled or not.
    await this.prisma.chatSession.update({
      where: { id: sessionId },
      data: shouldTitle ? { title: plainTextExcerpt(input.content, TITLE_LENGTH) } : {},
    });

    return message;
  }

  async delete(id: string): Promise<void> {
    await this.prisma.chatSession.delete({ where: { id } });
  }
}
