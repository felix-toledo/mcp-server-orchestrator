'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { getChatSession } from '../../actions/get-chat-session';
import { fetchInquireStatus } from '../../lib/fetch-inquire-status';
import { sendChatMessage } from '../../actions/send-chat-message';
import type { ChatMessage } from '../../lib/orchestrator-client';
import { useChatSessionContext } from '../shell/ChatSessionContext';
import { MessageBubble } from './MessageBubble';

const STATUS_POLL_INTERVAL_MS = 300;

function roleToLower(role: 'USER' | 'ASSISTANT' | 'TOOL'): ChatMessage['role'] {
  return role.toLowerCase() as ChatMessage['role'];
}

export function ChatPanel() {
  const { activeSessionId, setActiveSessionId, refreshSessions } = useChatSessionContext();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  const [statusLabel, setStatusLabel] = useState<string | null>(null);
  const [partialText, setPartialText] = useState('');

  // Live-status amendment, extended 2026-09-18 for live typing — while a
  // message is in flight, poll (not stream — see inquireStatusStore.ts's
  // own doc comment for why) what the reasoning graph is doing, and once
  // the final answer starts arriving, the growing `partialText` takes over
  // from the status label. `pendingRequestId` is generated client-side
  // before the request even starts, so this can poll immediately, before
  // the blocking send even has a sessionId back. Polls faster than before
  // (300ms, was 2s) so the growing answer reads as typing, not a
  // stop-motion status update — cheap for a single local user.
  useEffect(() => {
    if (!isSending || !pendingRequestId) {
      setStatusLabel(null);
      setPartialText('');
      return;
    }
    const interval = setInterval(() => {
      fetchInquireStatus(pendingRequestId).then(({ label, partialText: text }) => {
        setStatusLabel(label);
        setPartialText(text);
      });
    }, STATUS_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isSending, pendingRequestId]);

  useEffect(() => {
    if (!activeSessionId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    getChatSession(activeSessionId).then((session) => {
      if (!cancelled && session) {
        setMessages(session.messages.map((m) => ({ role: roleToLower(m.role), content: m.content })));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [activeSessionId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || isSending) {
      return;
    }

    const nextHistory: ChatMessage[] = [...messages, { role: 'user', content }];
    const requestId = crypto.randomUUID();
    setMessages(nextHistory);
    setDraft('');
    setStatusLabel(null);
    setPartialText('');
    setPendingRequestId(requestId);
    setIsSending(true);

    const result = await sendChatMessage(nextHistory, activeSessionId ?? undefined, requestId);
    setMessages([...nextHistory, result.message]);
    setPendingRequestId(null);
    setIsSending(false);

    if (result.sessionId && result.sessionId !== activeSessionId) {
      setActiveSessionId(result.sessionId);
      await refreshSessions();
    } else if (result.sessionId) {
      await refreshSessions();
    }
  }

  return (
    <section className="chat-panel">
      <div className="chat-panel__header">
        <h2 className="text-heading">Chat</h2>
      </div>
      <div className="chat-panel__messages">
        {messages.length === 0 ? (
          <p className="chat-panel__empty">contame qué necesitás y lo anoto por vos.</p>
        ) : (
          messages.map((message, index) => <MessageBubble key={index} message={message} />)
        )}
        {isSending && partialText && <MessageBubble message={{ role: 'assistant', content: partialText }} />}
        {isSending && !partialText && statusLabel && <p className="chat-panel__status">{statusLabel}</p>}
      </div>
      <form onSubmit={handleSubmit} className="chat-panel__form">
        <input
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="escribile a alma…"
          disabled={isSending}
        />
        <button type="submit" className="btn btn--primary" disabled={isSending}>
          {isSending ? '…' : 'Enviar'}
        </button>
      </form>
    </section>
  );
}
