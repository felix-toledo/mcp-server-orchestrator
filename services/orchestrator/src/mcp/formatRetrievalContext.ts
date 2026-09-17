interface RetrievedEntry {
  title: string;
  summary: string;
}

const NOTHING_FOUND_MESSAGE = 'Búsqueda en la bóveda: no se encontró ninguna nota relacionada con este mensaje.';

/**
 * Turns the raw searchKnowledgeEntries MCP tool result into the text block
 * injected via extraInstructions (spec 002-retrieval AC4/AC6). Treats a
 * missing/malformed/error result the same as "nothing found" rather than
 * throwing — the caller already isolates a thrown callTool error (AC7),
 * this covers the "call succeeded but came back empty/broken" case.
 */
export function formatRetrievalContext(toolResult: unknown): string {
  const entries = extractEntries(toolResult);
  if (entries.length === 0) {
    return NOTHING_FOUND_MESSAGE;
  }

  const bullets = entries.map((entry) => `- ${entry.title}: ${entry.summary}`).join('\n');
  return `Notas relevantes encontradas en la bóveda del usuario (para uso interno, no las anuncies ni repitas su título/ruta salvo que el usuario pida ver la nota):\n${bullets}`;
}

function extractEntries(toolResult: unknown): RetrievedEntry[] {
  if (!toolResult || typeof toolResult !== 'object') {
    return [];
  }

  const result = toolResult as { isError?: boolean; content?: Array<{ text?: unknown }> };
  if (result.isError) {
    return [];
  }

  const text = result.content?.[0]?.text;
  if (typeof text !== 'string') {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(text);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (item): item is RetrievedEntry =>
        !!item && typeof item.title === 'string' && typeof item.summary === 'string',
    );
  } catch {
    return [];
  }
}
