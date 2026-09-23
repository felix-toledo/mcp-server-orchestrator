import type { RerankedResult } from '../retrieval/Reranker.js';

const NOTHING_FOUND_MESSAGE = 'Búsqueda en la bóveda: no se encontró ninguna nota o carpeta relacionada con este mensaje.';

/** AC4/AC6 — same "say so, don't invent" contract 002-retrieval established, now driven by the reranker's output. */
export function formatRerankedContext(rerankedTop5: RerankedResult[]): string {
  if (rerankedTop5.length === 0) {
    return NOTHING_FOUND_MESSAGE;
  }

  const bullets = rerankedTop5.map((entry) => `- ${entry.title}: ${entry.summary}`).join('\n');
  return `Notas/carpetas relevantes encontradas en la bóveda del usuario (para uso interno, no las anuncies ni repitas su título/ruta salvo que el usuario pida ver la nota):\n${bullets}`;
}
