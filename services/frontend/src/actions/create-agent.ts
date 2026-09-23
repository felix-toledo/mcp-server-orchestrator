'use server';

import type { Agent } from './list-agents';

const KNOWLEDGE_STORE_URL = process.env.KNOWLEDGE_STORE_URL || 'http://localhost:30025';

export type CreateAgentResult = { ok: true; agent: Agent } | { ok: false; error: string };

export async function createAgent(name: string, systemPromptAddendum: string): Promise<CreateAgentResult> {
  try {
    const response = await fetch(`${KNOWLEDGE_STORE_URL}/agents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, systemPromptAddendum }),
    });
    if (!response.ok) {
      return { ok: false, error: `knowledge-store respondió con un error (${response.status})` };
    }
    return { ok: true, agent: (await response.json()) as Agent };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Error desconocido' };
  }
}
