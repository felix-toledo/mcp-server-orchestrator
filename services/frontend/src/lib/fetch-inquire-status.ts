/**
 * 2026-09-18 — client-side fetch to the `/api/inquire-status/[requestId]`
 * Route Handler, not a Server Action call — see that route's own doc
 * comment for why a Server Action doesn't actually poll concurrently here.
 * Shared by `ChatPanel` and `TeamChatPanel` (unlike their own polling
 * `useEffect`, which stays duplicated on purpose — this one-liner isn't
 * tied to either component's state).
 */
export interface InquireStatus {
  label: string | null;
  partialText: string;
}

export async function fetchInquireStatus(requestId: string): Promise<InquireStatus> {
  try {
    const response = await fetch(`/api/inquire-status/${requestId}`, { cache: 'no-store' });
    if (!response.ok) {
      return { label: null, partialText: '' };
    }
    return (await response.json()) as InquireStatus;
  } catch {
    return { label: null, partialText: '' };
  }
}
