import { NextResponse } from 'next/server';
import { orchestratorClient } from '../../../../lib/orchestrator-client';

/**
 * 2026-09-18 — live-status polling has to be a Route Handler, not a Server
 * Action: Next.js's App Router runs Server Actions from the same page
 * through a single client-side action queue, one at a time — confirmed
 * live with Playwright (network log showed every `getInquireStatus` action
 * call only actually leaving the browser *after* the concurrent
 * `sendChatMessage` action had already resolved, several seconds late,
 * defeating the whole point of polling while it's in flight). A Route
 * Handler is a plain HTTP endpoint outside that queue, so `fetch`ing it
 * from the client runs concurrently with the in-flight Server Action as
 * intended. See `docs/conventions/frontend.md`'s "Talking to the backend"
 * section — Route Handler is already the documented alternative to a
 * Server Action for this exact case.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ requestId: string }> }): Promise<NextResponse> {
  const { requestId } = await params;
  const status = await orchestratorClient.getInquireStatus(requestId);
  return NextResponse.json(status);
}
