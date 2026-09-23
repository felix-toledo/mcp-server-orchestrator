'use server';

const KNOWLEDGE_STORE_URL = process.env.KNOWLEDGE_STORE_URL || 'http://localhost:30025';

export async function deleteSkill(id: string): Promise<{ ok: boolean }> {
  try {
    const response = await fetch(`${KNOWLEDGE_STORE_URL}/skills/${id}`, { method: 'DELETE' });
    return { ok: response.ok || response.status === 404 };
  } catch {
    return { ok: false };
  }
}
