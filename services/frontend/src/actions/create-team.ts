'use server';

import type { HierarchyEntry, Team } from './list-teams';

const KNOWLEDGE_STORE_URL = process.env.KNOWLEDGE_STORE_URL || 'http://localhost:30025';

export type CreateTeamResult = { ok: true; team: Team } | { ok: false; error: string };

export interface CreateTeamInput {
  name: string;
  memberAgentIds: string[];
  coordinatorAgentId: string;
  projectFolderIds: string[];
  hierarchy?: HierarchyEntry[] | null;
}

export async function createTeam(input: CreateTeamInput): Promise<CreateTeamResult> {
  try {
    const response = await fetch(`${KNOWLEDGE_STORE_URL}/teams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      return { ok: false, error: body?.error || `knowledge-store respondió con un error (${response.status})` };
    }
    return { ok: true, team: (await response.json()) as Team };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Error desconocido' };
  }
}
