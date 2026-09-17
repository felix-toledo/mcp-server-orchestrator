import type { ChatMessage } from '../../lib/orchestrator-client';

export function MessageBubble({ message }: { message: ChatMessage }) {
  return (
    <div className={`message-bubble ${message.role === 'user' ? 'message-bubble--user' : ''}`}>
      <span className="message-bubble__role">{message.role === 'user' ? 'vos' : 'alma'}</span>
      <p className="message-bubble__content">{message.content}</p>
    </div>
  );
}
