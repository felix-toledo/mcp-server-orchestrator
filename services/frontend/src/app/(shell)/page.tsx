import { listChatSessions } from '../../actions/list-chat-sessions';
import { ChatPanel } from '../../components/chat/ChatPanel';
import { ChatSessionProvider } from '../../components/shell/ChatSessionContext';
import { SessionSidebar } from '../../components/shell/SessionSidebar';

export default async function ChatPage() {
  const sessions = await listChatSessions();

  return (
    <ChatSessionProvider initialSessions={sessions}>
      <div className="chat-view">
        <SessionSidebar />
        <ChatPanel />
      </div>
    </ChatSessionProvider>
  );
}
