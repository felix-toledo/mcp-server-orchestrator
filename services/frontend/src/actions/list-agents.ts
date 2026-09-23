'use server';

export interface Agent {
  id: string;
  name: string;
  systemPromptAddendum: string;
  allowedTools: string[] | null;
  allowedSkills: string[] | null;
  pipelineSteps: string[] | null;
}

const KNOWLEDGE_STORE_URL = process.env.KNOWLEDGE_STORE_URL || 'http://localhost:30025';

export async function listAgents(): Promise<Agent[]> {
  try {
    const response = await fetch(`${KNOWLEDGE_STORE_URL}/agents`, { cache: 'no-store' });
    if (!response.ok) {
      return [];
    }
    return (await response.json()) as Agent[];
  } catch {
    return [];
  }
}
