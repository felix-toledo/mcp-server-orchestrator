# Tasks — Voice enrollment (Settings)

Base: [`plan.md`](./plan.md) §6. Depends on
`voice-assistant/001-wake-word-channel`'s `knowledge-store` `VoiceProfile`
endpoints (that spec's tasks.md T1) — can be built against the documented
contract before T1 lands, same fail-open precedent
`frontend/004-chat-shell` T5/T6 already set for out-of-order backend
landing.

- [ ] **T1 — `lib/knowledge-store-client.ts` additions**: `getVoiceProfile()`
  (`GET /voice-profile`) and `enrollVoiceProfile(formData: FormData)`
  (`POST /voice-profile/enroll`, multipart) (plan §3).
  **Test**: `knowledge-store-client.test.ts` additions — request
  shape/headers for both, response parsing (`status`/`trainedAt`), and
  `enrollVoiceProfile`'s error-mapping path (non-2xx → thrown/typed error
  the action layer can catch).

- [ ] **T2 — Server Actions**: `actions/get-voice-profile-status.ts`,
  `actions/enroll-voice-profile.ts` (plan §3).
  **Test**: `get-voice-profile-status.test.ts` (mocked client — happy path
  + `knowledge-store` unreachable fails open, doesn't throw into the page,
  AC2/§5's reasoning), `enroll-voice-profile.test.ts` (mocked client —
  success returns `{ ok: true, status: 'TRAINED', trainedAt }`, failure
  returns `{ ok: false, error }` without throwing, AC8).

- [ ] **T3 — `VoiceEnrollmentSection.tsx`**: status **Chip** (AC2), entry
  **Button** (AC1/AC3 — `primary` "grabar muestra de voz" untrained,
  `secondary` "volver a entrenar" trained), retrain confirmation **Modal**
  gate (AC7 — `danger` primary action, per the skill's Modal rules) before
  opening `VoiceRecorder`. Wired into `SettingsPanel.tsx` as a new "Voz"
  section alongside the existing WhatsApp/Telegram sections.
  **Test**: none beyond T1/T2 (no jsdom/component-render tests this round,
  per `docs/conventions/frontend.md`'s Testing section — this component's
  logic is thin enough that its correctness is covered by the actions it
  calls plus manual verification, T5).

- [ ] **T4 — `VoiceRecorder.tsx`**: `getUserMedia` capture, `MediaRecorder`,
  elapsed-time counter (`mono-sm`), stop control, playback preview with
  discard/re-record (AC4/AC5), upload confirm calling
  `enroll-voice-profile.ts` and updating the parent's Chip in place on
  success (AC6), denied/missing mic permission shown via the `danger`-border
  + hint pattern (AC4), failed upload keeps the previous status and shows
  an inline error (AC8). Built from the skill's new **Control de
  grabación (voz)** entry — Card container, `danger` pulsing indicator,
  `mono-sm` counter, ghost/secondary Buttons for playback — no new token.
  **Test**: none beyond T1/T2 (same reasoning as T3 — browser-API-heavy
  component, no jsdom this round).

- [ ] **T5 — Manual verification**: with `knowledge-store` running and a
  `VoiceProfile` row reachable (real or via T1 of
  `voice-assistant/001-wake-word-channel`'s tasks.md), open `/settings` in
  a real browser, record a real 10–15s sample, confirm: the status Chip
  updates in place to "entrenada" with a real `trainedAt` (AC6); denying
  mic permission shows the inline error, not a silent failure (AC4);
  discarding a preview and re-recording works before committing (AC5);
  stopping `knowledge-store` mid-upload shows the AC8 error path without
  corrupting the previously-shown status.

## Note on scope not covered this round

`e2e/` (Playwright) coverage for this screen's actual recording UI is
explicitly not added — see plan §5's reasoning (no existing
`getUserMedia`/fake-media-device precedent in `e2e/mock-backend.js`).
Flagged as a real gap, not assumed covered by the Vitest layer above (which
only reaches `lib/`/`actions/`, never the component logic itself).
