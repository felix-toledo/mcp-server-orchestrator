'use server';

import { knowledgeStoreClient, type KnowledgeEntrySummary } from '../lib/knowledge-store-client';

export type CreateKnowledgeEntryResult =
  | { ok: true; entry: KnowledgeEntrySummary }
  | { ok: false; error: string };

export async function createKnowledgeEntry(
  title: string,
  folderPath?: string,
): Promise<CreateKnowledgeEntryResult> {
  try {
    // Placeholder body, not a copy of the title — the title already shows
    // above the editor; duplicating it into the body reads oddly once
    // opened. knowledge-store requires non-empty content, hence the space.
    const entry = await knowledgeStoreClient.createKnowledgeEntry({ title, content: ' ', folderPath });
    return { ok: true, entry };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Error desconocido' };
  }
}
