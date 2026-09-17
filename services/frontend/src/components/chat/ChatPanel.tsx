'use client';

import { useState, type FormEvent } from 'react';
import { sendChatMessage } from '../../actions/send-chat-message';
import type { ChatMessage } from '../../lib/orchestrator-client';
import { MessageBubble } from './MessageBubble';

export function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || isSending) {
      return;
    }

    const nextHistory: ChatMessage[] = [...messages, { role: 'user', content }];
    setMessages(nextHistory);
    setDraft('');
    setIsSending(true);

    const reply = await sendChatMessage(nextHistory);
    setMessages([...nextHistory, reply]);
    setIsSending(false);
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
