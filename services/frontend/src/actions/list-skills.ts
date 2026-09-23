'use server';

export interface Skill {
  id: string;
  name: string;
  description: string;
  instructions: string;
}

const KNOWLEDGE_STORE_URL = process.env.KNOWLEDGE_STORE_URL || 'http://localhost:30025';

export async function listSkills(): Promise<Skill[]> {
  try {
    const response = await fetch(`${KNOWLEDGE_STORE_URL}/skills`, { cache: 'no-store' });
    if (!response.ok) {
      return [];
    }
    return (await response.json()) as Skill[];
  } catch {
    return [];
  }
}
