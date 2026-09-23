'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { listChatSessions } from '../../actions/list-chat-sessions';
import type { ChatSessionSummary } from '../../lib/knowledge-store-client';

interface ChatSessionContextValue {
  sessions: ChatSessionSummary[];
  activeSessionId: string | null;
  setActiveSessionId: (id: string | null) => void;
  refreshSessions: () => Promise<void>;
}

const chatSessionContext = createContext<ChatSessionContextValue | null>(null);

export function ChatSessionProvider({
  initialSessions,
  children,
}: {
  initialSessions: ChatSessionSummary[];
  children: ReactNode;
}) {
  const [sessions, setSessions] = useState(initialSessions);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const refreshSessions = useCallback(async () => {
    setSessions(await listChatSessions());
  }, []);

  return (
    <chatSessionContext.Provider value={{ sessions, activeSessionId, setActiveSessionId, refreshSessions }}>
      {children}
    </chatSessionContext.Provider>
  );
}

export function useChatSessionContext(): ChatSessionContextValue {
  const context = useContext(chatSessionContext);
  if (!context) {
    throw new Error('useChatSessionContext must be used within a ChatSessionProvider');
  }
  return context;
}
