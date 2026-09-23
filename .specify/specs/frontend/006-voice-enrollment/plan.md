# Plan — Voice enrollment (Settings)

Base: [`spec.md`](./spec.md). Follows
[`docs/conventions/frontend.md`](../../../../docs/conventions/frontend.md)
and **must** apply
[`alma-frontend-convention`](../../../../.claude/skills/alma-frontend-convention/skill.md)
tokens/components throughout. The skill file's "Componentes base" section
already gained a **Control de grabación (voz)** entry (2026-09-22, done as
part of this plan) documenting exactly the pattern §3 below builds — no ad
hoc color/spacing/radius anywhere in this feature.

Depends on `voice-assistant/001-wake-word-channel` §5.3's `knowledge-store`
`VoiceProfile` endpoints existing (spec §1) — this plan assumes those are
either already live or, same fail-open pattern `frontend/004-chat-shell`
T5/T6 already used for endpoints that shipped slightly out of order, built
against the documented contract regardless of exact landing order.

## 1. Placement — extends `frontend/004-chat-shell`'s Settings tab

New section inside the existing `components/settings/SettingsPanel.tsx`
(`/settings` route, no new route) — same tab that already hosts the mock
WhatsApp section and the real Telegram token field
(`frontend/004-chat-shell` §4/AC7). No routing change needed.

## 2. Components

```
services/frontend/src/
├── components/settings/
│   ├── VoiceEnrollmentSection.tsx   # status Chip + entry-point Button (AC1-AC3)
│   └── VoiceRecorder.tsx            # mic capture, timer, playback preview, upload confirm (AC4-AC6)
├── actions/
│   ├── get-voice-profile-status.ts  # GET /voice-profile
│   └── enroll-voice-profile.ts      # POST /voice-profile/enroll (multipart)
├── lib/
│   └── knowledge-store-client.ts    # gains getVoiceProfile()/enrollVoiceProfile()
```

**`VoiceEnrollmentSection.tsx`** (Server Component wrapper, per
`docs/conventions/frontend.md`'s "Server Components by default"): calls
`get-voice-profile-status.ts` on mount/load (AC2), renders the status
**Chip** (state-dot variant — `text-muted` "no entrenada" /
`success` "entrenada" + `trainedAt` in `mono-sm`), and the entry-point
**Button** (`primary` "grabar muestra de voz" when untrained, `secondary`
"volver a entrenar" when trained — AC3, never two primaries in the same
block per the Button rules). Opening the recorder is a client-side state
flip, so this section's interactive shell is `"use client"` even though the
initial status fetch can happen server-side — same shape
`frontend/004-chat-shell`'s `ChatPanel` already uses for a
server-fetched-then-client-interactive component.

**`VoiceRecorder.tsx`** (`"use client"` — `getUserMedia`, timers, and
`MediaRecorder` are all browser APIs): owns the record → preview → confirm
state machine (AC4–AC6). Rendered inside a **Card** (skill's new Recording
control entry), with the `danger`-colored pulsing recording indicator +
`mono-sm` elapsed-time counter while active, and ghost/secondary **Button**s
for play/discard once stopped. Denied/missing mic permission renders the
same `danger`-border + hint pattern Input/Textarea already use for errors
(AC4) — never a silent failure. Confirming upload calls
`enroll-voice-profile.ts` with the recorded `Blob`; success updates the
parent section's Chip in place (no full reload, AC6); failure keeps the
previous status and shows an inline error (AC8).

**Retrain confirmation (AC7)**: a **Modal** (skill's existing Modal rules —
`danger` primary action for a destructive confirm, max two actions) gates
opening `VoiceRecorder` when the entry point was "volver a entrenar" —
owned by `VoiceEnrollmentSection`, not `VoiceRecorder` itself, since it's a
gate *before* recording starts, not part of the recording flow.

## 3. Server Actions

```typescript
// actions/get-voice-profile-status.ts
export async function getVoiceProfileStatus(): Promise<VoiceProfileStatus>;
// { status: 'NOT_TRAINED' | 'TRAINED'; trainedAt: string | null }

// actions/enroll-voice-profile.ts
export async function enrollVoiceProfile(formData: FormData): Promise<EnrollVoiceProfileResult>;
// FormData carries the recorded audio Blob under a fixed field name;
// { ok: true; status: 'TRAINED'; trainedAt: string } | { ok: false; error: string }
```

Both call `knowledgeStoreClient` directly, server-side — same ADR-0001
pattern every other onboarding/vault/settings action already uses (never a
Client Component calling `knowledge-store` directly). `enrollVoiceProfile`
is the one action in this codebase that forwards a `Blob` as multipart —
`lib/knowledge-store-client.ts`'s new `enrollVoiceProfile(formData:
FormData)` method passes the `FormData` straight through to `fetch`'s
`body` (native multipart encoding, no extra library needed on this side —
`multer` is only a `knowledge-store`-side dependency, per that spec's
plan §1).

## 4. Design patterns / tokens

No new pattern beyond what `docs/conventions/frontend.md` already
prescribes. The one genuinely new visual pattern (recording control) is
built entirely from existing tokens per the skill file's new entry — see
this plan's header note. No Strategy/Factory needed (one recording flow,
one upload endpoint).

## 5. Test strategy (Vitest — `lib/`/`actions/` only, no jsdom/component-render tests, per this repo's frontend testing convention)

| Target | Covers |
|---|---|
| `lib/knowledge-store-client.ts`'s `getVoiceProfile`/`enrollVoiceProfile` | request shape (including multipart for `enroll`), response parsing, error mapping |
| `actions/get-voice-profile-status.ts` | mocked client, happy path + `knowledge-store` unreachable (fails open to an empty/unknown status, doesn't throw into the page) |
| `actions/enroll-voice-profile.ts` | mocked client, success path, and a failed upload returning `{ ok: false }` rather than throwing (AC8) |

`e2e/` (Playwright) coverage for the actual recording UI (mic
permission/`MediaRecorder`) is **not** added this round — Playwright can
fake `getUserMedia` (`browserContext.grantPermissions`/a fake media
device), but wiring that up is real effort with no existing precedent in
this repo's `e2e/mock-backend.js`; flagged as a gap consistent with
`frontend/004-chat-shell` T8's own still-open Playwright gap, not silently
assumed covered.

## 6. Build order (→ `tasks.md`)

1. `lib/knowledge-store-client.ts`: `getVoiceProfile`/`enrollVoiceProfile`
   methods + tests.
2. `actions/get-voice-profile-status.ts` + `actions/enroll-voice-profile.ts`
   + tests.
3. `VoiceEnrollmentSection.tsx` (status Chip + entry Button + retrain Modal
   gate) wired into `SettingsPanel.tsx`.
4. `VoiceRecorder.tsx` (mic capture, timer, playback preview, upload
   confirm) — the recording-control pattern from the skill file's new
   entry.
5. Manual verification: record a real sample in a real browser, confirm
   upload/status-update/error paths against a running `knowledge-store`
   (T1 of `voice-assistant/001-wake-word-channel`'s tasks.md).
