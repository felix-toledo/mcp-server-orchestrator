# Spec — Voice channel: wake word, speaker verification, local voice reply

| | |
|---|---|
| **Status** | **Implemented and verified live 2026-09-22** — Felix ran the real daemon end to end (`pnpm run dev:all`), enrolled his own voice, said the wake word + a real question out loud, and got a spoken reply back through his own speakers. 4 of 6 Open Questions resolved the same day (§8: wake-word phrase/model, confidence threshold/retry, process management/packaging, utterance-end detection); the remaining 2 (offline-model licensing, future Docker/device-mapping) stayed explicitly non-blocking. **Amended same day**: locked decision #2 (STT) switched from local `faster-whisper` to the OpenAI Whisper API — see §2 item 2 and AC4. Eleven real bugs found only by running this against real hardware, all fixed — see `tasks.md` T13 for the full list (wrong default mic device, several tensor/format-conversion gaps, a Windows `cmd.exe` forward-slash quirk, missing wake-word model weights, a missing Kokoro `voice` argument, Spanish TTS, and Markdown being read literally). Replies are spoken in Spanish and Markdown is stripped before synthesis, both verified live. |
| **Group** | backend (new `services/voice-assistant` — first **Python** service in this monorepo, keep that in mind at Plan time; this spec itself specifies behavior, not implementation) |
| **Depends on** | [`knowledge-store/003-chat-sessions`](../../knowledge-store/003-chat-sessions/spec.md) (shared session memory, §4's Default #1), [`orchestrator/001-reasoning-pipeline`](../../orchestrator/001-reasoning-pipeline/spec.md) (existing `POST /api/inquire` this channel forwards transcribed text to — no change needed there) |
| **Depended on by** | [`frontend/006-voice-enrollment`](../../frontend/006-voice-enrollment/spec.md) (calls this spec's `knowledge-store` `VoiceProfile` endpoints to record/manage the enrollment sample and show status) |
| **Constitution clauses in play** | I (§2/§8 below), III (Vitest doesn't mechanically apply to a Python codebase — see §6 Default #7), IV, V (dormant) |

## 1. Goal

A third real channel for ALMA, alongside `services/frontend` and
`services/telegram-bot`, but hands-free and voice-native: a background
daemon on Felix's own PC listens for a wake word, verifies it's actually
Felix speaking (not anyone else in the room), transcribes what he says next,
forwards it to `orchestrator`'s existing `POST /api/inquire` exactly like
every other channel does, and speaks the reply out loud through the same
PC's speakers. Port **30028** (`docs/ports.md`, new row, `planned`).

The pasted reference Python implementation (`pyaudio` + `openwakeword` +
`speechbrain`'s `SpeakerRecognition` + a webhook + PM2) is architectural
inspiration only, not a contract — in particular, this spec deliberately
**does not** add a separate webhook endpoint; forwarding goes through
`orchestrator`'s existing `KAA`-authenticated `/api/inquire`, the same
pattern `telegram-bot` and `frontend` already use, so a new channel doesn't
mean a new auth/entry-point shape.

## 2. Architecture decisions — confirmed 2026-09-22, locked (do not re-litigate)

Resolved with Felix via `AskUserQuestion` before this spec was written. Each
is a real fork with trade-offs; each is settled for this spec:

1. **Listener topology**: a local background Python daemon on Felix's own
   PC with direct mic access (`pyaudio`-style continuous capture), not
   browser-captured audio relayed over the network. Matches ALMA's
   local-first, single-user posture (`docs/context.md`).
2. **STT (transcribing the utterance after the wake word)**: ~~local, offline
   (`faster-whisper` or equivalent) — not the OpenAI Whisper API. No new
   external API dependency or per-call cost.~~ **Amended 2026-09-22**: the
   OpenAI Whisper API instead, reusing the `OPENAI_API_KEY` `knowledge-store`
   already holds for embeddings. Reason: implementation found that
   `faster-whisper`'s local install wasn't actually what blocked this
   service on this machine (Python 3.13 has no prebuilt `numpy` wheel that
   satisfies `openwakeword`'s pinned `onnxruntime`, and no local C/C++
   compiler exists to build one from source — `openwakeword` itself, locked
   decision #1's wake-word engine, still needs that same `numpy`, so this
   amendment alone doesn't fully unblock local install) — Felix chose to
   simplify the STT step anyway, trading "no per-call cost, fully offline"
   for one fewer heavy local dependency chain
   (`faster-whisper`/`ctranslate2`/`tokenizers`/`av`) and reuse of an
   already-configured key. Audio for this one step now leaves the local
   machine (a change from the original reasoning's "no audio ever leaves
   the local machine" claim) — AC4 updated accordingly.
3. **TTS reply delivery**: the Python service synthesizes with Kokoro TTS
   and plays it out loud through the same PC's speakers directly — a full
   local voice-in/voice-out loop, **not** streamed to a browser to play.
4. **Voice enrollment profile storage**: `knowledge-store` owns the
   enrollment profile/config, consistent with
   [ADR-0001](../../../../docs/adr/0001-knowledge-store-as-separate-service.md)
   (knowledge-store is the single owner of cross-service config, same
   pattern as `TelegramLink`) — not a bare file living next to the Python
   process with no other service aware of it. The frontend uploads/manages
   the enrolled sample through `knowledge-store` (`frontend/006-voice-enrollment`);
   the Python service reads what it needs from `knowledge-store` (a path it
   hands back — §5.2) to run `speechbrain`'s `verify_batch`.

## 3. User Story & Acceptance Criteria

**As Felix**, I say a wake word, say what I want, and ALMA answers out loud
— without touching a keyboard, and without anyone else in the room being
able to trigger it by imitating the phrase, because it's *my* voice that
unlocks it, not just the words.

- **AC1 — Wake-word detection.** The daemon continuously listens on the
  local mic. Detecting the configured wake word triggers AC2 against a
  short rolling buffer of the last ~3 seconds (usually containing the wake
  phrase itself) — exact phrase/model and end-of-utterance detection
  resolved 2026-09-22, see §8 OQ1/OQ5.
- **AC2 — Speaker verification gates everything downstream.** The buffered
  audio from AC1 is checked against Felix's enrolled `VoiceProfile` (§5)
  via `speechbrain`'s speaker-verification (locked decision #4). A negative
  match (someone else said the wake word, or background noise triggered a
  false positive) is **silently discarded** — no transcription, no
  forwarding, no reply, no error sound — the same "don't reveal you're
  listening" posture `telegram-bot/001-channel` AC2 already established for
  an unbound `chat_id`. Confidence threshold and retry behavior resolved
  2026-09-22, see §8 OQ2 — single-attempt, no retry. **A positive match**
  speaks a short activation prompt out loud ("¿Sí?", `ConversationHandler`'s
  `DEFAULT_ACTIVATION_PROMPT`) — added 2026-09-22 at Felix's explicit
  request, confirming out loud that it's really him before he says the
  actual request — and *only then* does the daemon capture the command
  utterance AC3 onward act on (a separate capture window from AC1's
  verification buffer, so the activation prompt's own playback never gets
  captured as part of the command).
- **AC3 — No enrolled profile yet → daemon runs, never forwards.** If
  `VoiceProfile.status` is `NOT_TRAINED` (§5), the daemon still starts and
  still detects the wake word (so it's obviously "alive" for debugging),
  but every wake-word event is treated as an unverified/failed match per
  AC2 — nothing is ever forwarded without a trained profile. Mirrors
  `telegram-bot/001-channel` AC1's "no token configured → runs but does
  nothing" shape.
- **AC4 — STT via OpenAI Whisper API.** A verified utterance's audio is sent
  to OpenAI's `/v1/audio/transcriptions` endpoint (`model: whisper-1`, the
  same `OPENAI_API_KEY` `knowledge-store` already uses for embeddings —
  locked decision #2, amended 2026-09-22) and the returned text is used as
  the transcript. This is the one step in the pipeline where captured audio
  leaves the local machine.
- **AC5 — Forward to the orchestrator.** The transcribed text is sent to
  `orchestrator`'s `POST /api/inquire` with the same `KAA` header every
  other channel authenticates with, and the **remembered `sessionId`**
  (§4) — the reply's `sessionId` (new, or the same one) is what gets
  remembered for the next utterance, same shape as
  `telegram-bot/001-channel` AC3.
- **AC6 — Spoken reply.** The assistant's reply text is synthesized with
  Kokoro TTS and played out loud through the local machine's speakers
  (locked decision #3) — not streamed anywhere, not written to a file for
  the frontend to fetch.
- **AC7 — Health check.** `GET /health` on port 30028 responds whenever the
  daemon process is up, matching every other service's health-check
  convention (`CLAUDE.md`'s `curl .../health` pattern) — even though this
  isn't an Express/Node service, it exposes an equivalent minimal HTTP
  endpoint for the same purpose. Framework choice is a Plan-time decision.

## 4. Session continuity (extends `knowledge-store/003-chat-sessions`)

Recommended default, **not yet confirmed by Felix** — see §6 Default #1:
`voice-assistant` keeps **one** "current session" pointer (persisted,
surviving a restart), the same shape `telegram-bot/001-channel` §3 already
uses, rather than a per-conversation picker (voice has even less UI concept
of "pick a thread" than Telegram does). Both AC5 (forward) and AC6 (reply)
would read/update that same pointer — this is what would make "hablé por
voz, seguí en la web" work, reusing the exact same `ChatSession` row any
channel can open (`docs/context.md`'s "memoria unificada" decision).

## 5. Data & config

### 5.1 `knowledge-store` — new Prisma model

```prisma
// knowledge-store/prisma/schema.prisma — new model, owned there (not
// services/voice-assistant itself — no service besides knowledge-store
// touches Prisma, ADR-0001's rule holds, same as TelegramLink)
model VoiceProfile {
  id                   String             @id @default(cuid())
  userId               String             @unique
  user                 User               @relation(fields: [userId], references: [id])
  status               VoiceProfileStatus @default(NOT_TRAINED)
  enrollmentAudioPath  String?            // filesystem path to the raw enrollment sample — §5.2
  currentSessionId     String?            // the pointer §4 describes (Default, not yet confirmed)
  trainedAt            DateTime?
  createdAt            DateTime           @default(now())
  updatedAt            DateTime           @updatedAt
}

enum VoiceProfileStatus {
  NOT_TRAINED
  TRAINED
}
```

One `VoiceProfile` per `User` (`@unique` on `userId`) — matches the
single-user, single-`User`-row model already established
(`docs/context.md`'s no-auth decision). No multi-speaker enrollment this
round (§7).

### 5.2 Enrollment sample storage — raw audio file, not a persisted embedding

`knowledge-store` writes the uploaded enrollment sample to disk under a new
sibling folder to the vault — `%USERPROFILE%\Documents\alma\voice-profile\`
— following the same Windows-only, fixed-location convention
`docs/context.md` already established for `vault`. `enrollmentAudioPath`
stores that file's path. `knowledge-store` does **not** compute or persist
a speaker embedding itself — it stores the raw sample only; the Python
service loads it and runs `speechbrain` on its own side at verification
time. See §6 Default #2 for the reasoning (keeps `knowledge-store`, a Node
service, free of a `speechbrain`/`torch` dependency).

### 5.3 `knowledge-store` — new endpoints

| Method & path | Body | Returns | Notes |
|---|---|---|---|
| `POST /voice-profile/enroll` | multipart audio file (10–15s sample) | `200 { status, trainedAt, enrollmentAudioPath }` | Writes the file (§5.2), sets `status: TRAINED`, `trainedAt: now()`. Called by `frontend/006-voice-enrollment`'s enrollment action. |
| `GET /voice-profile` | — | `200 { status, trainedAt, enrollmentAudioPath, currentSessionId }` | Read on `voice-assistant` startup (to locate the sample and current session pointer) and by the frontend (status display, §6 Default #3 on why the path being present in the payload is fine under this repo's existing trust model). |
| `PATCH /voice-profile` | `{ currentSessionId }` | `200 { ...}` | Updates the session pointer as it changes — same shape as `TelegramLink`'s `PATCH /telegram-link`. Only relevant if §4/§6 Default #1 is confirmed as-is. |
| `DELETE /voice-profile` | — | `204` | Resets to `NOT_TRAINED`, clears `enrollmentAudioPath`/`trainedAt` — the re-train flow `frontend/006-voice-enrollment` triggers. |

`services/voice-assistant` and `services/frontend` both call these
directly — same ADR-0002-extended reasoning `telegram-bot/001-channel` §4
already used for its own config endpoints: this is channel-plumbing, not
LLM-reasoning content.

### 5.4 Wake-word phrase, confidence threshold, utterance-end detection — resolved values, still config not schema

These are Python-service-side configuration (env var / local config file),
**not** added to `VoiceProfile` or exposed to the frontend this round — no
Acceptance Criterion in this spec or in `frontend/006-voice-enrollment`
asks for a UI to edit them. Their values **are** resolved now (§8, locked
2026-09-22): wake-word model is one of `openwakeword`'s existing pretrained
models (e.g. "hey jarvis") used as a functional placeholder, not a
custom-trained "Hey ALMA" model; wake-word trigger threshold is score
≥0.5; speaker verification is a single `speechbrain` `verify_batch` call at
whatever default threshold `spkrec-ecapa-voxceleb` ships with, no
confirmation/retry; utterance-end detection is a fixed-duration capture
window (e.g. 5 seconds) after the wake word fires. If a future round adds a
settings UI for these, it would extend this same `VoiceProfile`-adjacent
config pattern rather than invent a new one.

### 5.5 Process management: PM2 (packaging/production) vs. `pnpm run dev` (local dev) — both true at once, not a contradiction

Resolved as part of OQ3 (§8, locked 2026-09-22): **PM2** is the
packaging/production-facing answer — an `ecosystem.config.js` (repo root or
`services/voice-assistant/`, Plan's call) runs the Python daemon the same
way the pasted reference script itself suggested, giving it auto-restart
and log management outside of any one dev terminal.

This does **not** replace this repo's own `pnpm run dev`/`pnpm run dev:all`
flow for local iteration — Felix explicitly wants `pnpm run dev:all` to
still start every service, including this one, with one command, the same
way it already starts the other six. Plan must wire **both**, not pick one:
a root `dev:voice-assistant` script that invokes the Python entrypoint
directly (PM2 is not in the loop for dev — PM2's job is production process
supervision, not hot-reload dev ergonomics), and `scripts/dev-all.mjs`
spawning it alongside the existing services. PM2 is what a packaged/
production deployment would use to keep the daemon alive; it is not how
Felix runs it day-to-day while developing.

## 6. Defaults & Assumptions (mark any correction inline)

1. **Session continuity defaults to "shared pointer, like Telegram"** (§4)
   — this is the recommended, consistent-with-`telegram-bot` answer, but
   **it was not asked and confirmed as its own fork** the way the four §2
   decisions were. Correct this here, not silently in Plan, if a per-voice
   -conversation model (or no persistence at all) turns out to be wanted
   instead.
2. **`knowledge-store` stores the raw enrollment audio file, not a
   precomputed speaker embedding** (§5.2). Reasoning: `knowledge-store` is
   a Node/TypeScript service with no reason to depend on `speechbrain`/
   `torch`; keeping it a dumb file store (same "row is metadata, the real
   content lives in the file" pattern already established for
   `KnowledgeEntry`) means only `services/voice-assistant` needs the ML
   stack. If Plan-time verification shows re-computing the embedding on
   every match is too slow, a caching strategy is an implementation detail
   for `services/voice-assistant`, not a reason to change what
   `knowledge-store` persists.
3. **No encryption on the stored enrollment sample or the `VoiceProfile`
   row** — same plaintext, single-user, no-auth trust model already
   accepted for `TelegramLink.botToken` (`telegram-bot/001-channel` §5
   Default #1). `GET /voice-profile` returning `enrollmentAudioPath` in
   plain JSON is consistent with that same trust model, not a new
   exception to it.
4. **10–15 second enrollment sample** (per the human's own ask for
   `frontend/006-voice-enrollment`) — exact audio format/codec/sample-rate
   requirements for `speechbrain`'s ECAPA-VoxCeleb model are an
   implementation detail for Plan, not specced here.
5. **`DELETE /voice-profile` is assumed sufficient for "un-enroll and
   retrain"** — parallel to `telegram-bot/001-channel` §5 Default #2's
   similarly light treatment of "disconnect." No confirmation flow, no
   "are you sure" business rule specified here (that's a frontend copy/UX
   decision, not a backend one).
6. **This is a single-listener setup** — one wake-word daemon, one mic,
   one PC (Felix's own), matching every other "single local user" default
   already in `docs/context.md`. Multiple rooms/mics is out of scope (§7).
7. **Constitution Clause III's Vitest requirement doesn't mechanically
   apply here** — `services/voice-assistant` is a Python codebase, and
   `CLAUDE.md`'s "Vitest required in every workspace" list only enumerates
   the six existing Node/TypeScript services. This spec assumes an
   equivalent verification discipline (e.g. `pytest`, with mocked
   audio/model calls) is required in spirit, but the exact tool and how
   each Acceptance Criterion above maps to a test is a Plan-time decision,
   not specced here — same treatment `desktop/001-installer` §7.2 already
   gives its own new, non-Vitest-shaped testing surface.
8. **Runs under Python 3.11, not this machine's default 3.13** — found
   during implementation, not specced up front: on Windows, Python 3.13 has
   no prebuilt wheel for the `numpy`/`blis` versions `openwakeword`/`kokoro`
   pull in, and this machine has no C/C++ compiler to build them from
   source. `services/voice-assistant/.venv` (gitignored) is a dedicated
   Python 3.11.9 virtualenv — the last 3.11 patch release with a Windows
   installer (3.11.10+ are source-only, security-fix-only releases) —
   installed independently of the system's default Python so
   `dev:voice-assistant`/`ecosystem.config.js` don't disturb whatever else
   on this machine expects `python` on `PATH` to mean 3.13.

## 7. Out of Scope — Future Work

- Browser-captured or browser-streamed audio, in either direction (ruled
  out by locked decisions #1 and #3, §2).
- A custom-trained "Hey ALMA" wake-word model — this round uses one of
  `openwakeword`'s existing pretrained models instead (§8 OQ1, resolved
  2026-09-22). Training a custom model needs synthetic data generation +
  training, deferred.
- VAD-based silence detection for utterance-end — this round uses a fixed
  capture window instead (§8 OQ5, resolved 2026-09-22).
- A confirmation/retry flow for a near-boundary speaker-verification score
  — single-attempt pass/fail only this round (§8 OQ2, resolved 2026-09-22).
- Multiple enrolled voices/speakers (§6 Default #6).
- A live "is the daemon currently listening" indicator in Settings —
  this round only surfaces `VoiceProfile.status` (trained/not trained) via
  `knowledge-store`, not the Python daemon's own runtime liveness beyond
  `GET /health`. A richer `/status` endpoint is future work if wanted.
- Push-to-talk fallback, or any input mode besides wake-word activation.
- Interrupting ("barge-in") an in-progress TTS reply with a new wake word.
- Noise-robustness/far-field mic tuning beyond whatever `openwakeword`
  does out of the box.
- Any containerization/Docker story, including `/dev/snd` device mapping
  (§8 OQ6) — this round assumes a plain local Python process on Felix's
  own Windows machine, the same posture `desktop/001-installer` already
  takes for "runs on Felix's own PC" concerns generally.
- WhatsApp or any other non-voice channel (`whatsapp-bot`, port 30024,
  still only `planned`) — unrelated to this spec.

## 8. Open Questions

### Resolved 2026-09-22

Closed via a second `AskUserQuestion` round with Felix (`grill-with-docs`).
Locked — do not re-litigate:

- **OQ1 — Exact wake-word phrase and detection model.** → **Use one of
  `openwakeword`'s existing pretrained models** (e.g. "hey jarvis") as a
  functional placeholder today, not a custom-trained "Hey ALMA" model.
  Training a custom wake word needs synthetic data generation + a training
  pass of its own — explicitly deferred future work (§7), not this round's
  job.
- **OQ2 — Speaker-verification confidence threshold and retry behavior.**
  → **Single-attempt, no retry, simple thresholds.** Wake-word score ≥0.5
  triggers capture; speaker verification is one `speechbrain`
  `verify_batch` call — a plain yes/no at whatever default threshold
  `spkrec-ecapa-voxceleb` ships with, no confirmation/retry flow. A failed
  match just means nothing happens (AC2's existing "silently discarded"
  behavior already covers this) — Felix can just repeat the phrase.
- **OQ3 — Process management/packaging for the Python daemon.** → **PM2**
  for packaging/production, matching the pasted reference script's own
  suggestion (an `ecosystem.config.js`). Reconciled explicitly with local
  dev needing `pnpm run dev:voice-assistant`/`pnpm run dev:all` to keep
  working, since Felix wants one command to still bring up every service —
  see new §5.5 for how both are true at once (PM2 supervises the packaged/
  production daemon; a plain root `dev:voice-assistant` script invokes the
  Python entrypoint directly for dev, no PM2 in that loop).
- **OQ5 — Utterance-end detection.** → **Fixed-duration recording window**
  (e.g. 5 seconds) after the wake word fires, then cut and send to STT.
  VAD-based silence detection is explicitly deferred future work (§7).

### Still open — non-blocking for local dev

Felix wants this running locally, on his own machine, today. Neither of
these two blocks that goal — they're deferred, not silently dropped, and
don't gate Plan (Constitution Clause I is satisfied: nothing about running
this locally depends on either answer):

- **OQ4 — Licensing/redistribution terms for the four bundled offline
  models** (`openwakeword`, `speechbrain`'s ECAPA-VoxCeleb, `faster-whisper`,
  Kokoro TTS) — not evaluated yet. Matters for this PFG project's own
  distribution/defense at some point (redistributing model weights, not
  just using them locally), but nothing about Felix running the daemon on
  his own PC today depends on the answer.
- **OQ6 — Future Docker/device-mapping story**, if `voice-assistant` is
  ever containerized alongside the other services (`/dev/snd` access,
  `desktop/001-installer`'s packaging territory) — deliberately deferred
  (§7), flagged here so it isn't silently forgotten once that installer
  spec is eventually un-blocked. Doesn't block a plain local Python process
  on Felix's own Windows machine, which is this round's actual target.
