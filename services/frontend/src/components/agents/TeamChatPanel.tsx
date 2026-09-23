'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { fetchInquireStatus } from '../../lib/fetch-inquire-status';
import { sendTeamChatMessage } from '../../actions/send-team-chat-message';
import { MessageBubble } from '../chat/MessageBubble';
import type { ChatMessage } from '../../lib/orchestrator-client';

const STATUS_POLL_INTERVAL_MS = 300;

/**
 * team-chat amendment (orchestrator/003-teams) — a chat scoped to one team,
 * opened inline from the Teams tab itself ("no quiero ir al chat principal
 * de alma para hacerlo"). Deliberately self-contained: its own message
 * state and its own sessionId, never touching `ChatSessionContext` — the
 * main sidebar has no concept of team-scoped sessions at all.
 */
export function TeamChatPanel({ teamId, teamName, onClose }: { teamId: string; teamName: string; onClose: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  const [statusLabel, setStatusLabel] = useState<string | null>(null);
  const [partialText, setPartialText] = useState('');

  // Live-status amendment, extended 2026-09-18 for live typing — same
  // polling approach as the main ChatPanel (including the switch to
  // `partialText` once the final answer starts streaming in), kept
  // duplicated rather than shared: this component is deliberately
  // self-contained (see the doc comment above).
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || isSending) return;

    const nextHistory: ChatMessage[] = [...messages, { role: 'user', content }];
    const requestId = crypto.randomUUID();
    setMessages(nextHistory);
    setDraft('');
    setStatusLabel(null);
    setPartialText('');
    setPendingRequestId(requestId);
    setIsSending(true);

    const result = await sendTeamChatMessage(nextHistory, teamId, sessionId, requestId);
    setMessages([...nextHistory, result.message]);
    setPendingRequestId(null);
    setIsSending(false);
    if (result.sessionId) {
      setSessionId(result.sessionId);
    }
  }

  return (
    <div className="card team-chat-panel">
      <div className="team-chat-panel__header">
        <h3 className="text-body-strong">Chat con {teamName}</h3>
        <button type="button" className="btn btn--ghost" onClick={onClose}>
          Cerrar
        </button>
      </div>
      <div className="team-chat-panel__messages">
        {messages.length === 0 ? (
          <p className="chat-panel__empty">contale al equipo qué necesitás.</p>
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
          placeholder={`escribile al equipo ${teamName}…`}
          disabled={isSending}
        />
        <button type="submit" className="btn btn--primary" disabled={isSending}>
          {isSending ? '…' : 'Enviar'}
        </button>
      </form>
    </div>
  );
}
