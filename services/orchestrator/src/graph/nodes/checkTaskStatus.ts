import type { PipelineState, PipelineStateUpdate } from '../state.js';

const STATUS_MARKER = /\s*\[STATUS:\s*(IN_PROGRESS|DONE)\]\s*$/i;

/**
 * AC9 — for a complex task, checks whether the LLM's last response marked
 * itself as still in progress. Simple tasks never carry the marker and are
 * always DONE (spec §7.2's default). Also strips the marker from that
 * message's content — it's a system-only signal, never something the user
 * should see in the chat, so it must not survive into the returned
 * `messages` (which is what ends up shown/persisted downstream).
 *
 * 2026-09-18 — real bug found live: `IN_PROGRESS` routes to `compress` and
 * back to `callLlm` (`buildReasoningGraph.ts`), and unlike the
 * `executeToolsOrAgents` loop, that path never touched `iterationCount` —
 * a model that keeps narrating "voy a preguntarles a los dos" and marking
 * itself `IN_PROGRESS` without ever actually emitting a tool call had no
 * budget to run out of, confirmed live: 40+ seconds and still looping,
 * would have kept going. `IN_PROGRESS` now spends from the same shared
 * budget `executeToolsOrAgents` already uses (matches AC6's existing
 * "shares the caller iteration budget" principle — one budget for "the
 * graph needs another LLM round-trip to finish this turn," not one budget
 * per loop shape) — `buildReasoningGraph.ts`'s edge out of this node
 * checks it, and `finalizeResponse.ts` already had the graceful "hit the
 * iteration limit" message ready, it just never used to be reachable from
 * this loop.
 */
export function checkTaskStatus(state: PipelineState): PipelineStateUpdate {
  if (!state.isComplex) {
    return { taskStatus: 'DONE' };
  }

  const lastAssistantIndex = [...state.messages].reverse().findIndex((m) => m.role === 'assistant');
  if (lastAssistantIndex === -1) {
    return { taskStatus: 'DONE' };
  }
  const index = state.messages.length - 1 - lastAssistantIndex;
  const original = state.messages[index];
  const match = original.content?.match(STATUS_MARKER);
  const taskStatus = match?.[1]?.toUpperCase() === 'IN_PROGRESS' ? 'IN_PROGRESS' : 'DONE';
  const iterationUpdate = taskStatus === 'IN_PROGRESS' ? { iterationCount: state.iterationCount + 1 } : {};

  if (!match) {
    return { taskStatus, ...iterationUpdate };
  }

  const messages = [...state.messages];
  messages[index] = { ...original, content: (original.content ?? '').replace(STATUS_MARKER, '') };
  return { taskStatus, ...iterationUpdate, messages };
}
