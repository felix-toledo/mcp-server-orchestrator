import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChannelService } from './channelService.js';
import type { KnowledgeStoreClient } from '../infrastructure/knowledgeStoreClient.js';
import type { OrchestratorClient } from '../infrastructure/orchestratorClient.js';

describe('ChannelService', () => {
  let knowledgeStoreClient: {
    getTelegramLink: ReturnType<typeof vi.fn>;
    updateTelegramLinkBinding: ReturnType<typeof vi.fn>;
    appendChatMessage: ReturnType<typeof vi.fn>;
    getChatSessionMessages: ReturnType<typeof vi.fn>;
  };
  let orchestratorClient: { inquire: ReturnType<typeof vi.fn>; getInquireStatus: ReturnType<typeof vi.fn> };
  let telegramSender: { sendMessage: ReturnType<typeof vi.fn>; editMessage: ReturnType<typeof vi.fn> };
  let service: ChannelService;

  beforeEach(() => {
    knowledgeStoreClient = {
      getTelegramLink: vi.fn(),
      updateTelegramLinkBinding: vi.fn(),
      appendChatMessage: vi.fn().mockResolvedValue(undefined),
      getChatSessionMessages: vi.fn().mockResolvedValue([]),
    };
    orchestratorClient = { inquire: vi.fn(), getInquireStatus: vi.fn().mockResolvedValue(null) };
    telegramSender = {
      sendMessage: vi.fn().mockResolvedValue({ messageId: 1 }),
      editMessage: vi.fn().mockResolvedValue(undefined),
    };
    service = new ChannelService(
      knowledgeStoreClient as unknown as KnowledgeStoreClient,
      orchestratorClient as unknown as OrchestratorClient,
      telegramSender,
    );
  });

  describe('resolveBoundChat', () => {
    it('AC2 (amended): binds the first chat_id from an allowed username', async () => {
      knowledgeStoreClient.getTelegramLink.mockResolvedValue({
        id: 't1',
        botToken: 'abc',
        chatId: null,
        currentSessionId: null,
        allowedUsernames: ['felix'],
      });

      const result = await service.resolveBoundChat('12345', 'Felix');

      expect(result.isBound).toBe(true);
      expect(knowledgeStoreClient.updateTelegramLinkBinding).toHaveBeenCalledWith({ chatId: '12345' });
    });

    it('AC2 (amended): fails closed — a username NOT on the allowlist never gets bound, even as the first contact', async () => {
      knowledgeStoreClient.getTelegramLink.mockResolvedValue({
        id: 't1',
        botToken: 'abc',
        chatId: null,
        currentSessionId: null,
        allowedUsernames: ['felix'],
      });

      const result = await service.resolveBoundChat('99999', 'un_extraño');

      expect(result.isBound).toBe(false);
      expect(knowledgeStoreClient.updateTelegramLinkBinding).not.toHaveBeenCalled();
    });

    it('AC2 (amended): fails closed when no allowlist is configured yet, even for a real message', async () => {
      knowledgeStoreClient.getTelegramLink.mockResolvedValue({
        id: 't1',
        botToken: 'abc',
        chatId: null,
        currentSessionId: null,
        allowedUsernames: [],
      });

      const result = await service.resolveBoundChat('12345', 'felix');

      expect(result.isBound).toBe(false);
      expect(knowledgeStoreClient.updateTelegramLinkBinding).not.toHaveBeenCalled();
    });

    it('AC2 (amended): rejects a message with no Telegram username at all', async () => {
      knowledgeStoreClient.getTelegramLink.mockResolvedValue({
        id: 't1',
        botToken: 'abc',
        chatId: null,
        currentSessionId: null,
        allowedUsernames: ['felix'],
      });

      const result = await service.resolveBoundChat('12345', undefined);

      expect(result.isBound).toBe(false);
    });

    it('AC2: accepts a message from the already-bound chat_id without re-binding', async () => {
      knowledgeStoreClient.getTelegramLink.mockResolvedValue({
        id: 't1',
        botToken: 'abc',
        chatId: '12345',
        currentSessionId: null,
        allowedUsernames: ['felix'],
      });

      const result = await service.resolveBoundChat('12345', 'felix');

      expect(result.isBound).toBe(true);
      expect(knowledgeStoreClient.updateTelegramLinkBinding).not.toHaveBeenCalled();
    });

    it('AC2: rejects a message from a different chat_id once one is already bound, regardless of username', async () => {
      knowledgeStoreClient.getTelegramLink.mockResolvedValue({
        id: 't1',
        botToken: 'abc',
        chatId: '12345',
        currentSessionId: null,
        allowedUsernames: ['felix'],
      });

      const result = await service.resolveBoundChat('99999', 'felix');

      expect(result.isBound).toBe(false);
      expect(knowledgeStoreClient.updateTelegramLinkBinding).not.toHaveBeenCalled();
    });
  });

  describe('handleIncomingMessage', () => {
    it('AC3: forwards with the remembered sessionId and returns the reply text', async () => {
      knowledgeStoreClient.getTelegramLink.mockResolvedValue({ id: 't1', botToken: 'abc', chatId: '12345', currentSessionId: 's1' });
      knowledgeStoreClient.getChatSessionMessages.mockResolvedValue([]);
      orchestratorClient.inquire.mockResolvedValue({ message: { role: 'assistant', content: 'hola' }, sessionId: 's1' });

      const reply = await service.handleIncomingMessage('12345', 'hola bot');

      expect(orchestratorClient.inquire).toHaveBeenCalledWith([{ role: 'user', content: 'hola bot' }], 's1', expect.any(String));
      expect(reply).toBe('hola');
      expect(knowledgeStoreClient.updateTelegramLinkBinding).not.toHaveBeenCalled();
    });

    it('AC3/§3: updates the remembered session pointer when a new one comes back (first message, or an old one was deleted)', async () => {
      knowledgeStoreClient.getTelegramLink.mockResolvedValue({ id: 't1', botToken: 'abc', chatId: '12345', currentSessionId: null });
      orchestratorClient.inquire.mockResolvedValue({ message: { role: 'assistant', content: 'hola' }, sessionId: 's-new' });

      await service.handleIncomingMessage('12345', 'hola bot');

      // No sessionId yet → nothing to load, no wasted knowledge-store call.
      expect(knowledgeStoreClient.getChatSessionMessages).not.toHaveBeenCalled();
      expect(orchestratorClient.inquire).toHaveBeenCalledWith([{ role: 'user', content: 'hola bot' }], undefined, expect.any(String));
      expect(knowledgeStoreClient.updateTelegramLinkBinding).toHaveBeenCalledWith({ currentSessionId: 's-new' });
    });

    it('real bug (2026-09-17): sends the full session history, not just the latest message — orchestrator never reloads it server-side from sessionId', async () => {
      knowledgeStoreClient.getTelegramLink.mockResolvedValue({ id: 't1', botToken: 'abc', chatId: '12345', currentSessionId: 's1' });
      knowledgeStoreClient.getChatSessionMessages.mockResolvedValue([
        { role: 'USER', content: 'hola' },
        { role: 'ASSISTANT', content: 'buenas' },
      ]);
      orchestratorClient.inquire.mockResolvedValue({ message: { role: 'assistant', content: 'ok' }, sessionId: 's1' });

      await service.handleIncomingMessage('12345', 'segundo mensaje');

      expect(knowledgeStoreClient.getChatSessionMessages).toHaveBeenCalledWith('s1');
      expect(orchestratorClient.inquire).toHaveBeenCalledWith(
        [
          { role: 'user', content: 'hola' },
          { role: 'assistant', content: 'buenas' },
          { role: 'user', content: 'segundo mensaje' },
        ],
        's1',
        expect.any(String),
      );
    });

    it('real bug (2026-09-17): a reminder pushMessage delivered earlier is included as prior context on the next message', async () => {
      knowledgeStoreClient.getTelegramLink.mockResolvedValue({ id: 't1', botToken: 'abc', chatId: '12345', currentSessionId: 's1' });
      knowledgeStoreClient.getChatSessionMessages.mockResolvedValue([
        { role: 'USER', content: 'recordame comprar pan' },
        { role: 'ASSISTANT', content: 'listo, te aviso' },
        { role: 'ASSISTANT', content: 'Comprar pan' }, // the pushed reminder itself
      ]);
      orchestratorClient.inquire.mockResolvedValue({ message: { role: 'assistant', content: 'ok' }, sessionId: 's1' });

      await service.handleIncomingMessage('12345', 'ya lo compré');

      const [messagesSent] = orchestratorClient.inquire.mock.calls[0];
      expect(messagesSent.map((m: { content: string }) => m.content)).toContain('Comprar pan');
    });

    describe('live-status amendment (2026-09-18)', () => {
      it('sends a placeholder immediately and edits it into the real answer once the request resolves', async () => {
        knowledgeStoreClient.getTelegramLink.mockResolvedValue({ id: 't1', botToken: 'abc', chatId: '12345', currentSessionId: 's1' });
        telegramSender.sendMessage.mockResolvedValue({ messageId: 42 });
        orchestratorClient.inquire.mockResolvedValue({ message: { role: 'assistant', content: 'la respuesta real' }, sessionId: 's1' });

        await service.handleIncomingMessage('12345', 'hola bot');

        expect(telegramSender.sendMessage).toHaveBeenCalledWith('12345', 'pensando…');
        expect(telegramSender.editMessage).toHaveBeenCalledWith('12345', 42, 'la respuesta real');
      });

      it('polls status while the request is in flight and edits the placeholder as the label changes', async () => {
        vi.useFakeTimers();
        try {
          knowledgeStoreClient.getTelegramLink.mockResolvedValue({ id: 't1', botToken: 'abc', chatId: '12345', currentSessionId: 's1' });
          telegramSender.sendMessage.mockResolvedValue({ messageId: 42 });
          orchestratorClient.getInquireStatus
            .mockResolvedValueOnce('revisando tu bóveda…')
            .mockResolvedValueOnce('revisando tu bóveda…') // unchanged — must not re-edit
            .mockResolvedValueOnce('pensando…');

          let resolveInquire!: (value: { message: { role: 'assistant'; content: string }; sessionId: string }) => void;
          orchestratorClient.inquire.mockReturnValue(new Promise((resolve) => (resolveInquire = resolve)));

          const pending = service.handleIncomingMessage('12345', 'hola bot');

          await vi.advanceTimersByTimeAsync(2000);
          await vi.advanceTimersByTimeAsync(2000);
          await vi.advanceTimersByTimeAsync(2000);

          resolveInquire({ message: { role: 'assistant', content: 'listo' }, sessionId: 's1' });
          await pending;

          expect(telegramSender.editMessage).toHaveBeenNthCalledWith(1, '12345', 42, 'revisando tu bóveda…');
          expect(telegramSender.editMessage).toHaveBeenNthCalledWith(2, '12345', 42, 'pensando…');
          expect(telegramSender.editMessage).toHaveBeenLastCalledWith('12345', 42, 'listo');
        } finally {
          vi.useRealTimers();
        }
      });

      it('falls back to a generic message when the final answer is empty, instead of editing to blank text', async () => {
        knowledgeStoreClient.getTelegramLink.mockResolvedValue({ id: 't1', botToken: 'abc', chatId: '12345', currentSessionId: 's1' });
        telegramSender.sendMessage.mockResolvedValue({ messageId: 42 });
        orchestratorClient.inquire.mockResolvedValue({ message: { role: 'assistant', content: null }, sessionId: 's1' });

        await service.handleIncomingMessage('12345', 'hola bot');

        expect(telegramSender.editMessage).toHaveBeenCalledWith('12345', 42, 'listo.');
      });
    });
  });

  describe('pushMessage', () => {
    it('AC4: sends via the bot and logs into the shared session on success', async () => {
      knowledgeStoreClient.getTelegramLink.mockResolvedValue({ id: 't1', botToken: 'abc', chatId: '12345', currentSessionId: 's1' });

      const result = await service.pushMessage('recordatorio!');

      expect(result).toEqual({ delivered: true });
      expect(telegramSender.sendMessage).toHaveBeenCalledWith('12345', 'recordatorio!');
      expect(knowledgeStoreClient.appendChatMessage).toHaveBeenCalledWith('s1', 'ASSISTANT', 'recordatorio!');
    });

    it('AC4: reports not delivered without throwing when no chat is bound yet', async () => {
      knowledgeStoreClient.getTelegramLink.mockResolvedValue({ id: 't1', botToken: 'abc', chatId: null, currentSessionId: null });
      const result = await service.pushMessage('recordatorio!');
      expect(result).toEqual({ delivered: false });
      expect(telegramSender.sendMessage).not.toHaveBeenCalled();
    });

    it('AC5: reports not delivered without throwing when the Telegram send itself fails', async () => {
      knowledgeStoreClient.getTelegramLink.mockResolvedValue({ id: 't1', botToken: 'abc', chatId: '12345', currentSessionId: 's1' });
      telegramSender.sendMessage.mockRejectedValue(new Error('Telegram API down'));

      await expect(service.pushMessage('recordatorio!')).resolves.toEqual({ delivered: false });
      expect(knowledgeStoreClient.appendChatMessage).not.toHaveBeenCalled();
    });

    it('still reports delivered: true even if the follow-up session log call fails', async () => {
      knowledgeStoreClient.getTelegramLink.mockResolvedValue({ id: 't1', botToken: 'abc', chatId: '12345', currentSessionId: 's1' });
      knowledgeStoreClient.appendChatMessage.mockRejectedValue(new Error('knowledge-store down'));

      await expect(service.pushMessage('recordatorio!')).resolves.toEqual({ delivered: true });
    });
  });
});
