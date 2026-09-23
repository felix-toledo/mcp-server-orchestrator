/** 2026-09-18 addendum — same shape/contract as formatRerankedContext, but always-on, never search-gated. */
export function formatProfileNoteContext(profileNote: string | null): string | undefined {
  if (!profileNote) {
    return undefined;
  }
  return `Perfil del usuario — hechos que ya sabés sobre él/ella (para uso interno, no lo anuncies ni menciones que es una "nota de perfil"):\n${profileNote}`;
}
