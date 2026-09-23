'use client';

import { useState } from 'react';
import { deleteChatSession } from '../../actions/delete-chat-session';
import { useChatSessionContext } from './ChatSessionContext';

export function SessionSidebar() {
  const { sessions, activeSessionId, setActiveSessionId, refreshSessions } = useChatSessionContext();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    setDeletingId(id);
    const result = await deleteChatSession(id);
    if (result.ok) {
      if (activeSessionId === id) {
        setActiveSessionId(null);
      }
      await refreshSessions();
    }
    setDeletingId(null);
  }

  return (
    <aside className="session-sidebar">
      <button type="button" className="btn btn--primary session-sidebar__new" onClick={() => setActiveSessionId(null)}>
        + Nuevo chat
      </button>

      {sessions.length === 0 ? (
        <p className="session-sidebar__empty">Todavía no tenés conversaciones.</p>
      ) : (
        <ul className="session-sidebar__list">
          {sessions.map((session) => (
            <li key={session.id} className="session-sidebar__row">
              <button
                type="button"
                className={`session-sidebar__item ${session.id === activeSessionId ? 'session-sidebar__item--active' : ''}`}
                onClick={() => setActiveSessionId(session.id)}
              >
                {session.title ?? 'Nueva conversación'}
              </button>
              <button
                type="button"
                className="session-sidebar__delete"
                aria-label="Borrar conversación"
                disabled={deletingId === session.id}
                onClick={() => handleDelete(session.id)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
