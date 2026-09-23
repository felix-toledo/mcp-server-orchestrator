/**
 * Live-status amendment (orchestrator/001-reasoning-pipeline) — Felix's
 * ask: "si estan trabajando a full todos los agentes, quiero poder ver en
 * que estan... como que en el medio quiero ir viendo que estan haciendo."
 * Confirmed during clarification: polling, not token-by-token streaming —
 * this in-memory Map is deliberately that lightweight, not a new
 * pub/sub or SSE layer. Keyed by a client-generated `requestId` (not
 * `sessionId`) so the frontend can start polling before the very first
 * message of a brand-new session even has a sessionId yet.
 *
 * Single-process only, by design — matches this whole service's
 * single-instance deployment (no horizontal scaling, no shared cache).
 *
 * 2026-09-18 — web live-typing addendum: `partialText` reuses this exact
 * same polling mechanism (still not SSE, per the original decision above)
 * to carry the final answer's text as `callLlm.ts` streams it in from
 * `ILlmProvider.streamResponse`. The frontend just polls faster while
 * text is coming in (see `ChatPanel.tsx`) — chunkier than true
 * character-by-character streaming, but no new transport.
 */
export interface InquireStatus {
  label: string;
  partialText: string;
  updatedAt: number;
}

const statusByRequestId = new Map<string, InquireStatus>();

/** Node name → user-facing Spanish label (ALMA's voice: lowercase, no exclamation marks). */
const NODE_LABELS: Record<string, string> = {
  fetchRagTop20: 'revisando tu bóveda…',
  rerank: 'revisando tu bóveda…',
  runSkillRouter: 'viendo qué skills aplican…',
  awaitSkillRouter: 'viendo qué skills aplican…',
  fetchProfileNote: 'revisando tu perfil…',
  awaitProfileNote: 'revisando tu perfil…',
  checkSufficientInfo: 'pensando…',
  makePlan: 'armando un plan…',
  callLlm: 'pensando…',
  executeToolsOrAgents: 'usando herramientas o consultando a otros agentes…',
  checkTaskStatus: 'revisando el progreso…',
  compress: 'resumiendo lo hecho hasta ahora…',
  finalizeResponse: 'terminando la respuesta…',
};

export function labelForNode(nodeName: string): string | undefined {
  return NODE_LABELS[nodeName];
}

function currentEntry(requestId: string): InquireStatus {
  return statusByRequestId.get(requestId) ?? { label: '', partialText: '', updatedAt: Date.now() };
}

export function setInquireStatus(requestId: string, label: string): void {
  statusByRequestId.set(requestId, { ...currentEntry(requestId), label, updatedAt: Date.now() });
}

/** Called once per `callLlm` attempt, before streaming starts — a retry/next turn's text must not append onto a previous turn's leftovers. */
export function resetPartialText(requestId: string): void {
  statusByRequestId.set(requestId, { ...currentEntry(requestId), partialText: '', updatedAt: Date.now() });
}

export function appendPartialText(requestId: string, chunk: string): void {
  const entry = currentEntry(requestId);
  statusByRequestId.set(requestId, { ...entry, partialText: entry.partialText + chunk, updatedAt: Date.now() });
}

export function getInquireStatus(requestId: string): InquireStatus | null {
  return statusByRequestId.get(requestId) ?? null;
}

/** Called once a request finishes (success or failure) — a finished request has nothing left to poll for. */
export function clearInquireStatus(requestId: string): void {
  statusByRequestId.delete(requestId);
}
