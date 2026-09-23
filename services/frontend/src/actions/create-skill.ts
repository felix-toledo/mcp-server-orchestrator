'use server';

import type { Skill } from './list-skills';

const KNOWLEDGE_STORE_URL = process.env.KNOWLEDGE_STORE_URL || 'http://localhost:30025';

export type CreateSkillResult = { ok: true; skill: Skill } | { ok: false; error: string };

export async function createSkill(name: string, description: string, instructions: string): Promise<CreateSkillResult> {
  try {
    const response = await fetch(`${KNOWLEDGE_STORE_URL}/skills`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, instructions }),
    });
    if (!response.ok) {
      return { ok: false, error: `knowledge-store respondió con un error (${response.status})` };
    }
    return { ok: true, skill: (await response.json()) as Skill };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Error desconocido' };
  }
}
