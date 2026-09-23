'use server';

export interface HierarchyEntry {
  agentId: string;
  managerAgentId: string | null;
}

export interface Team {
  id: string;
  name: string;
  memberAgentIds: string[];
  coordinatorAgentId: string;
  hierarchy: HierarchyEntry[] | null;
  projectFolderIds: string[];
  allowedSkillIds: string[] | null;
}

const KNOWLEDGE_STORE_URL = process.env.KNOWLEDGE_STORE_URL || 'http://localhost:30025';

export async function listTeams(): Promise<Team[]> {
  try {
    const response = await fetch(`${KNOWLEDGE_STORE_URL}/teams`, { cache: 'no-store' });
    if (!response.ok) {
      return [];
    }
    return (await response.json()) as Team[];
  } catch {
    return [];
  }
}
