# Spec — Voice enrollment (Settings)

| | |
|---|---|
| **Status** | Draft — no Open Questions of its own (see §7). Can advance to Plan independently of its backend dependency's own unresolved Open Questions — see §1's note. |
| **Group** | frontend |
| **Amends** | [`frontend/004-chat-shell`](../004-chat-shell/spec.md) AC7 (extends the Settings tab's "mostly-mock except one real section" pattern the Telegram token field established, with a second real section) |
| **Depends on** | [`voice-assistant/001-wake-word-channel`](../../voice-assistant/001-wake-word-channel/spec.md) §5 (the `knowledge-store` `VoiceProfile` endpoints this screen calls) |
| **Constitution clauses in play** | I, III (Vitest — `lib/`/`actions/` only, same scope as every other frontend spec), IV |

**Must follow [`alma-frontend-convention`](../../../../.claude/skills/alma-frontend-convention/skill.md)**
— every token/color/spacing/radius/component named below comes from that
skill's table. §3.1 flags the one genuinely new visual pattern this spec
introduces (a recording control) and says explicitly how it's built from
existing tokens rather than inventing new ones.

## 1. Goal, and why Settings rather than onboarding or a new top-level tab

Felix asked for a screen where he records a 10–15s voice sample, it uploads
to `knowledge-store`, and the UI shows whether the voice is trained — "en el
onboarding, o en configuración." This spec puts it in **Settings**, as a new
section alongside the existing (real) Telegram token field
(`frontend/004-chat-shell` AC7), not in onboarding and not as a sixth
top-level tab. Reasoning, flagged as a judgment call (§6 Default #1, correct
it if wrong):

- **Not onboarding**: `frontend/001-onboarding` is a one-time, blocking
  wizard whose job is creating the single `User` row and picking a
  `Purpose`. Adding a microphone-permission-heavy recording step there
  raises the friction of finishing onboarding at all, for a capability
  (voice activation) that's optional infrastructure on top of an
  already-working chat, not a prerequisite for it.
- **Not a new top-level tab**: `telegram-bot/001-channel`'s token field is
  the closest precedent in this codebase — a real, functional config surface
  for an optional additional channel, and it lives in Settings, not its own
  tab. Voice enrollment is the same shape of thing (config for an optional
  channel), just with a richer interaction (record/preview/upload vs. a
  text input) than a one-field form.

This spec's own scope (browser mic capture, upload, status display) has
**no Open Question of its own** — see §7 — and can move to Plan
independently of `voice-assistant/001-wake-word-channel`'s still-unresolved
architecture questions (wake-word phrase, confidence threshold, process
management, etc.), none of which the enrollment screen depends on: it only
calls `knowledge-store`'s `VoiceProfile` endpoints, defined and unblocked
already.

## 2. User Story & Acceptance Criteria

**As Felix**, I open Settings, see whether ALMA already knows my voice, and
if not (or if I want to redo it) I record a short sample and it's trained.

- **AC1**: The Settings tab gains a new **"Voz"** section, alongside the
  existing (mock) WhatsApp section and the real Telegram field
  (`frontend/004-chat-shell` AC7) — this section is fully real, not mock.
- **AC2**: On load, the section calls `GET /voice-profile`
  (`voice-assistant/001-wake-word-channel` §5.3) and shows a status
  **Chip** (state-dot variant, per the design system's Chip rules): "no
  entrenada" (`text-muted`) or "entrenada" (`success`) plus, when trained,
  the `trainedAt` timestamp rendered in `mono-sm` (technical metadata, same
  rule the design system already applies to timestamps elsewhere).
- **AC3**: A primary **Button** ("grabar muestra de voz" when untrained, or
  a secondary **Button** "volver a entrenar" when already trained — never
  two primaries in the same block, per the Button rules) opens the
  recording control (§3).
- **AC4**: Recording captures 10–15 seconds of audio via the browser's
  microphone (`getUserMedia`) with a visible elapsed-time counter
  (`mono-sm`) and a stop control. Denying/lacking microphone permission
  shows an inline error (same `danger` border + explanatory hint pattern
  the design system's Input/Textarea component already uses for errors) —
  never a silent failure.
- **AC5**: After stopping, a playback preview lets Felix listen to what was
  captured before committing to it, with the option to discard and
  re-record instead of uploading immediately.
- **AC6**: Confirming upload calls a new Server Action that sends the
  recorded audio to `knowledge-store`'s `POST /voice-profile/enroll`
  (multipart). On success, the status Chip updates in place to "entrenada"
  with the new `trainedAt` — no full page reload.
- **AC7**: Re-training (already-trained → "volver a entrenar") opens a
  confirmation **Modal** before starting a new recording — overwriting an
  existing enrollment is treated as a destructive action (design system's
  Modal rule: primary action in `danger`, not `accent`, for a destructive
  confirm), matching the "don't hide destructive actions behind an
  ambiguous click" instinct already applied to session deletion in
  `frontend/004-chat-shell` AC4. Flagged as a judgment call, not confirmed
  explicitly with Felix — see §6 Default #2.
- **AC8**: A failed upload (network error, `knowledge-store` unreachable)
  keeps the previous status Chip unchanged and shows an inline error —
  never silently reports "entrenada" on a failed call.

## 3. Recording control — new visual pattern, built from existing tokens

`alma-frontend-convention` doesn't yet cover a recording/waveform control
(it explicitly flags chat bubbles/streaming as another still-uncovered
area) — this is the first spec to need one. Per that skill's own hard rule
("si falta un valor, se agrega al sistema, no se improvisa inline"), Plan
must **extend** the skill file with this new component's documented pattern
before `implementer` builds it, using only existing tokens:

- **Recording-active indicator**: a pulsing dot/icon in `danger` — the
  system's existing semantic color for "something active/urgent needing
  attention," not a new red introduced ad hoc.
- **Elapsed-time counter**: `mono-sm`, consistent with every other
  technical-metadata timestamp in the system (latency, costs, timestamps
  are already speced as `mono`, never `body` prose).
- **Container**: a **Card** (`surface` + `border` + `radius-md`), same as
  every other bounded content block in this design system — no new
  container shape.
- **Playback preview**: reuses the **Button** ghost/secondary variants for
  play/discard controls — no new control shape needed.

This section is intentionally implementation-adjacent rather than a full
component spec (Plan's job, not Spec's) — it exists so Plan doesn't have to
rediscover "build this from existing tokens, don't invent new ones" on its
own.

## 4. Data & config

Calls `voice-assistant/001-wake-word-channel` §5.3's endpoints directly,
server-side (Server Action → `knowledge-store`, same pattern
`docs/conventions/frontend.md` already establishes for onboarding/vault
calls — never from a Client Component straight to `knowledge-store`):

| Action | Calls | Notes |
|---|---|---|
| Load status (AC2) | `GET /voice-profile` | On Settings tab mount |
| Enroll/retrain (AC6) | `POST /voice-profile/enroll` | Multipart, the recorded `Blob` |

`DELETE /voice-profile` (defined in `voice-assistant/001-wake-word-channel`
§5.3) is **not** called by this spec's UI — see §5 Out of Scope.

## 5. Directory layout (extends `frontend/004-chat-shell`'s `components/settings/`)

```
services/frontend/src/
├── components/settings/
│   ├── VoiceEnrollmentSection.tsx   # new — status chip + record/retrain entry point
│   └── VoiceRecorder.tsx            # new — mic capture, timer, playback preview, upload confirm
├── actions/
│   ├── get-voice-profile-status.ts  # new
│   └── enroll-voice-profile.ts      # new
├── lib/
│   └── knowledge-store-client.ts    # gains getVoiceProfile()/enrollVoiceProfile() methods
```

## 6. Defaults & Assumptions (mark any correction inline)

1. **Settings, not onboarding, not a new top-level tab** (§1) — a judgment
   call reasoned through, not something Felix confirmed explicitly for this
   specific placement question the way the four `voice-assistant/001`
   architecture forks were confirmed. Correct here if wrong.
2. **Retrain requires a confirm Modal, styled as destructive** (AC7) — a
   reasonable default (overwriting a trained voice profile is at least
   mildly consequential), not something explicitly asked. Flagged.
3. **No "un-enroll without immediately re-recording" UI this round** — the
   backend's `DELETE /voice-profile` exists for a fuller "clear profile"
   flow, but this spec's UI only ever calls `POST /voice-profile/enroll`
   (which overwrites unconditionally) or reads status. Add a bare "clear"
   action later if it turns out to be wanted.
4. **Playback preview before upload (AC5)** is assumed wanted (avoids
   uploading a bad take) even though it wasn't spelled out in the original
   ask — reasonable default for a recording flow, flagged for correction.

## 7. Out of Scope — Future Work

- Editing the wake-word phrase or the speaker-verification confidence
  threshold from this screen — those stay Python-service-side config per
  `voice-assistant/001-wake-word-channel` §5.4, no UI this round.
- A live indicator of whether the `voice-assistant` background daemon is
  actually running/listening (separate from "is a voice enrolled") — this
  screen only reflects `VoiceProfile.status`, not process liveness.
- A bare "un-enroll" action with no immediate re-recording (§6 Default #3).
- Multi-sample enrollment, voice-print quality feedback, or any visualized
  waveform beyond the basic recording-in-progress indicator (§3).
- Moving this section into onboarding later — not ruled out, just not this
  round's placement (§1).

## 8. Open Questions

None — this spec's own scope (browser recording, upload, status display)
has no unresolved business rule left un-decided. See §1 for why this does
**not** mean it's fully unblocked end-to-end: the *effect* of a trained
voice profile (actually gating wake-word activation) depends on
`voice-assistant/001-wake-word-channel`, which still has 6 unresolved Open
Questions of its own and stays blocked at Plan until those are answered.
