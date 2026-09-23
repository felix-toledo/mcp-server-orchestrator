/**
 * Direct HTTP client to knowledge-store for chat session bookkeeping only
 * (ADR-0002) — never for anything LLM-reasoning-shaped, that stays behind
 * mcp-server's MCP tools (see McpClient/searchKnowledgeEntries instead).
 */
export interface ChatSessionSummary {
  id: string;
  title: string | null;
  updatedAt: string;
}

export interface AgentSummary {
  id: string;
  name: string;
  systemPromptAddendum: string;
  allowedTools: string[] | null;
  allowedSkills: string[] | null;
  pipelineSteps: string[] | null;
}

export interface SkillSummary {
  id: string;
  name: string;
  description: string;
  instructions: string;
}

export interface HierarchyEntry {
  agentId: string;
  managerAgentId: string | null;
}

export interface TeamSummary {
  id: string;
  name: string;
  memberAgentIds: string[];
  coordinatorAgentId: string;
  hierarchy: HierarchyEntry[] | null;
  projectFolderIds: string[];
  allowedSkillIds: string[] | null;
}

export interface VaultFolderSummary {
  id: string;
  path: string;
  summary: string;
}

export interface ProfileNote {
  title: string;
  content: string;
}

export class KnowledgeStoreClient {
  constructor(private readonly baseUrl: string) {}

  /**
   * Onboarding gate (frontend/001-onboarding) was only ever wired into the
   * Next.js route tree (`(shell)/layout.tsx`'s redirect) — any caller that
   * skips that layout (a direct `/api/inquire` call, the Telegram channel)
   * reached the reasoning graph with no `User` row at all. Fail-open on a
   * knowledge-store hiccup (assume onboarded), matching every other method
   * here — a transient network blip must never permanently lock out chat.
   */
  async hasCompletedOnboarding(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/users/me`);
      if (response.status === 404) {
        return false;
      }
      return response.ok;
    } catch {
      return true;
    }
  }

  /** team-chat amendment — `teamId` tags the session so it's excluded from the main sidebar's own list. */
  async createChatSession(teamId?: string): Promise<ChatSessionSummary & { createdAt: string }> {
    const response = await fetch(`${this.baseUrl}/chat-sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamId }),
    });
    if (!response.ok) {
      throw new Error(`knowledge-store request failed (${response.status}): ${await response.text()}`);
    }
    return (await response.json()) as ChatSessionSummary & { createdAt: string };
  }

  /**
   * orchestrator/002-multi-agent §3 — `AgentRegistry`'s config source.
   * Fail-open (returns `[]`), matching this file's own doc comment: a
   * knowledge-store hiccup here must degrade to "no configured agents"
   * (AC2's exact 001-only behavior), never break the whole chat turn.
   */
  async listAgents(): Promise<AgentSummary[]> {
    try {
      const response = await fetch(`${this.baseUrl}/agents`);
      if (!response.ok) {
        return [];
      }
      return (await response.json()) as AgentSummary[];
    } catch {
      return [];
    }
  }

  /** knowledge-store/005-skills — SkillManager's config source. Fail-open to []. */
  async listSkills(): Promise<SkillSummary[]> {
    try {
      const response = await fetch(`${this.baseUrl}/skills`);
      if (!response.ok) {
        return [];
      }
      return (await response.json()) as SkillSummary[];
    } catch {
      return [];
    }
  }

  /** orchestrator/003-teams — AgentRegistry's Team config source. Fail-open to []. */
  async listTeams(): Promise<TeamSummary[]> {
    try {
      const response = await fetch(`${this.baseUrl}/teams`);
      if (!response.ok) {
        return [];
      }
      return (await response.json()) as TeamSummary[];
    } catch {
      return [];
    }
  }

  /** orchestrator/003-teams AC7 — resolves a Team's projectFolderIds into readable summaries. Fail-open to []. */
  async listVaultFolders(): Promise<VaultFolderSummary[]> {
    try {
      const response = await fetch(`${this.baseUrl}/vault-folders`);
      if (!response.ok) {
        return [];
      }
      return (await response.json()) as VaultFolderSummary[];
    } catch {
      return [];
    }
  }

  /**
   * 2026-09-18 addendum — a direct lookup (`GET /knowledge-entries/profile`),
   * called unconditionally every turn, not something the LLM chooses to
   * search for. Fail-open to `null`, matching every other method here: a
   * knowledge-store hiccup degrades to "no profile context this turn," not
   * a broken chat turn.
   */
  async getProfileNote(): Promise<ProfileNote | null> {
    try {
      const response = await fetch(`${this.baseUrl}/knowledge-entries/profile`);
      if (!response.ok) {
        return null;
      }
      return (await response.json()) as ProfileNote;
    } catch {
      return null;
    }
  }

  async appendChatMessage(sessionId: string, role: 'USER' | 'ASSISTANT' | 'TOOL', content: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/chat-sessions/${sessionId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, content }),
    });
    if (!response.ok) {
      throw new Error(`knowledge-store request failed (${response.status}): ${await response.text()}`);
    }
  }
}
