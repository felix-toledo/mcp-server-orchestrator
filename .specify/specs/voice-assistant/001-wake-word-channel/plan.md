# Plan — Voice channel: wake word, speaker verification, local voice reply

Base: [`spec.md`](./spec.md). Two halves: (1) `knowledge-store`'s new
`VoiceProfile` model/endpoints — normal Node/Prisma work, same shape as
`TelegramLink` (`telegram-bot/001-channel`); (2) `services/voice-assistant`
itself — this repo's **first Python service**, a background daemon, not an
Express app. Design-pattern vocabulary (Service Layer, DI, Strategy) is
applied throughout in spirit even though nothing here is TypeScript —
[`docs/design-patterns.md`](../../../../docs/design-patterns.md)'s
principles aren't framework-specific.

## 1. `knowledge-store`: `VoiceProfile` schema + service + endpoints

Same layering as `TelegramLinkService`/`telegramLinkController`
(`telegram-bot/001-channel` T1) — `api/voiceProfileController.ts` +
`services/voiceProfileService.ts`, `VoiceProfileInputSchema`/response shapes
in `api/schemas.ts`, Prisma model exactly as spec §5.1.

```typescript
export class VoiceProfileService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly userService: UserService,
  ) {}
  get(): Promise<VoiceProfile | null>;                          // GET /voice-profile
  enroll(fileBuffer: Buffer, originalName: string): Promise<VoiceProfile>; // POST /voice-profile/enroll
  updateCurrentSession(currentSessionId: string): Promise<VoiceProfile>;   // PATCH /voice-profile
  reset(): Promise<void>;                                        // DELETE /voice-profile
}
```

`enroll` writes the uploaded sample to
`%USERPROFILE%\Documents\alma\voice-profile\` (spec §5.2 — a new sibling
`src/voiceProfile/voiceProfileStorage.ts`, same shape as `vault/vaultRepository.ts`
but for this one file instead of a folder of notes), then upserts the row
with `status: TRAINED`, `trainedAt: now()`, `enrollmentAudioPath`.

**New dependency: `multer`.** `POST /voice-profile/enroll` is this
service's first multipart endpoint — every other write endpoint in
`knowledge-store` today is plain JSON. `multer` (Express's standard
multipart middleware, already a transitive-safe, widely used choice) parses
the incoming file into a `Buffer` at the controller boundary; the service
itself never touches `req`/multipart parsing directly (architecture.md's
"controllers thin, services don't know about transport" rule holds).

## 2. `services/voice-assistant` — folder structure

```
services/voice-assistant/
├── src/
│   ├── main.py                        # composition root — builds every client/wrapper,
│   │                                   # starts the health server thread, runs the
│   │                                   # blocking wake-word listen loop
│   ├── config.py                      # env var loading (python-dotenv) into a typed Settings object
│   ├── health/
│   │   ├── health_server.py           # tiny Flask app, GET /health only — §3 below
│   │   └── test_health_server.py
│   ├── wake_word/
│   │   └── wake_word_listener.py      # openwakeword + pyaudio continuous capture (AC1) —
│   │                                   # no dedicated test, §6, same class of exception
│   │                                   # telegram-bot's grammy wiring already has
│   ├── verification/
│   │   ├── speaker_verifier.py        # wraps speechbrain's SpeakerRecognition.verify_batch (AC2)
│   │   └── test_speaker_verifier.py
│   ├── stt/
│   │   ├── transcriber.py             # wraps faster-whisper (AC4)
│   │   └── test_transcriber.py
│   ├── tts/
│   │   ├── speaker.py                 # Kokoro synth + local playback (AC6)
│   │   └── test_speaker.py
│   ├── clients/
│   │   ├── orchestrator_client.py     # POST /api/inquire, same KAA header pattern (AC5)
│   │   ├── test_orchestrator_client.py
│   │   ├── knowledge_store_client.py  # GET/PATCH /voice-profile
│   │   └── test_knowledge_store_client.py
│   └── conversation/
│       ├── conversation_handler.py    # this service's ChannelService equivalent — §4
│       └── test_conversation_handler.py
├── requirements.txt
├── .env.example
├── ecosystem.config.js                # PM2 — packaging/production only, spec §5.5
└── pytest.ini
```

**Test file naming, translated for Python**: `docs/conventions/naming.md`'s
"test file sits next to the file it tests" rule, expressed as `pytest`'s own
`test_<module>.py` discovery convention (a suffix doesn't work for pytest's
collector) rather than this repo's usual `.test.ts` suffix — same rule,
different language's idiom. Flagged as a Default, not silently improvised.

`.env` (`services/voice-assistant/.env.example`):

```env
PORT=30028
ORCHESTRATOR_URL=http://localhost:30021
KEY_ALLOWED_AGENTS=your-secret-key
KNOWLEDGE_STORE_URL=http://localhost:30025
WAKE_WORD_MODEL=hey_jarvis
WAKE_WORD_THRESHOLD=0.5
UTTERANCE_DURATION_SECONDS=5
```

`PORT` matches this repo's one-`PORT`-per-`.env` convention
(`docs/ports.md`'s Rules) even though this service has no real HTTP API of
its own — it's what the health endpoint (§3) binds to. `KEY_ALLOWED_AGENTS`
must match `orchestrator`'s value, same as every other channel.
`WAKE_WORD_MODEL`/`WAKE_WORD_THRESHOLD`/`UTTERANCE_DURATION_SECONDS` are the
spec §5.4/§8-resolved values as env-overridable config, not hardcoded
constants, so Felix can tune them without a code change.

`requirements.txt`:

```
pyaudio
openwakeword
speechbrain
torch
torchaudio
faster-whisper
kokoro
flask
python-dotenv
requests
pytest
pytest-mock
```

**Default & Assumption — Kokoro's pip package name.** Assumed `kokoro`
(the package name the upstream Kokoro-82M project publishes) rather than
`kokoro-onnx` (a separate, ONNX-runtime-based community port with a smaller
footprint but a different API surface). This is genuinely unverified at
spec/plan time — `implementer` must confirm the correct package (and its
actual synthesis API — likely a `KPipeline`/similar object, not a bare
function) against PyPI before writing `tts/speaker.py`, and correct this
line if `kokoro-onnx` turns out to be the better fit for a CPU-only local
setup. Not a business rule, just an unverified library fact — flagged
rather than guessed silently.

## 3. Health endpoint — judgment call, recommended yes

Spec AC7 already asks for `GET /health` on port 30028. Flagging the
reasoning explicitly since it's the one place this service structurally
differs from every other one in this repo: **`voice-assistant` is a
daemon, not a request-serving API**, so a health endpoint isn't "free" the
way it is for an Express app that already has an HTTP server running.

**Recommendation: build the minimal endpoint anyway** (`health/health_server.py`,
a five-line Flask app — one route, `{"status": "ok"}` — run via
`Thread(target=app.run, kwargs={"port": settings.port}, daemon=True)` inside
`main.py`, alongside the blocking wake-word loop in the main thread).
Reasoning: every other service in this monorepo has a uniform
`curl .../health` story (`CLAUDE.md`'s own health-check convention), and
`scripts/dev-all.mjs`'s wait-for-health pattern (§5 below) depends on that
uniformity to know a service is actually up, not just "the process started."
Deviating here — no `/health` at all, or a different liveness signal —
would be a real inconsistency, not a neutral simplification. This is still
a judgment call, not something Felix confirmed explicitly as its own fork;
correct it if a lighter-weight liveness mechanism turns out to be preferred.

## 4. `conversation_handler.py` — the AC2–AC6 orchestration

Shape mirrors `telegram-bot`'s `ChannelService.handleIncomingMessage`
closely — same "gate → transcribe → forward → reply" flow, one channel's
worth of glue logic, no business rule invented beyond what spec §2–§5
already locked:

```python
class ConversationHandler:
    def __init__(
        self,
        speaker_verifier: SpeakerVerifier,
        transcriber: Transcriber,
        orchestrator_client: OrchestratorClient,
        knowledge_store_client: KnowledgeStoreClient,
        speaker: Speaker,
    ) -> None: ...

    def handle_wake_word(self, audio_bytes: bytes) -> None:
        """AC2-AC6, in order: verify -> (silent return on no match) ->
        transcribe -> forward to orchestrator with the remembered session ->
        persist the (possibly new) session pointer -> speak the reply."""
```

**AC3's "no enrolled profile" case**: `main.py` reads `VoiceProfile` once at
startup (spec §5.3's "read on startup" wording) and passes
`enrollment_audio_path: str | None` into `SpeakerVerifier`/`ConversationHandler`.
`SpeakerVerifier.verify(...)` returns a non-match whenever the reference
path is `None` — explicit handling, not a crash, not an accidental
side-effect of a missing file. **Known limitation, flagged rather than
silently accepted**: enrolling (or re-enrolling) while the daemon is
already running needs a process restart to pick up the new
`VoiceProfile` — spec §5.3 only specifies a startup read, no polling. Fine
for this round's single-listener, single-operator setup; revisit if that
friction turns out to matter in practice.

## 5. Dev wiring — `pnpm run dev:voice-assistant` and `scripts/dev-all.mjs`

Root `package.json` gains:

```json
"dev:voice-assistant": "python services/voice-assistant/src/main.py"
```

**Default & Assumption**: assumes a `python` executable on `PATH` with
`requirements.txt` already installed — either a global interpreter or an
already-activated virtualenv. This repo doesn't set up automatic
cross-platform venv activation (Windows' `.venv\Scripts\activate` vs.
POSIX's `.venv/bin/activate` differ enough that scripting it uniformly is
its own small project, not something to improvise inline here) — Felix runs
one manual one-time step, `pip install -r services/voice-assistant/requirements.txt`,
the Python-world equivalent of this repo's own `pnpm install`. No
`build:voice-assistant`/`start:voice-assistant` counterpart — Python isn't
compiled/bundled, and production packaging is PM2 (§6), not a `dist/`
output.

`scripts/dev-all.mjs` changes: add `voice-assistant` to `COLORS` and to the
`DEPENDENTS` array (`{ name: 'voice-assistant', script: 'dev:voice-assistant' }`),
alongside `orchestrator`/`scheduler`/`telegram-bot`/`frontend` — it starts in
parallel with those, not gated on `knowledge-store`/`mcp-server`'s health
the way `FOUNDATION` is, since nothing else in `dev-all.mjs`'s own startup
sequence needs to wait on *it* (same treatment `telegram-bot`/`frontend`
already get despite also depending on `orchestrator` being reachable).

`docs/ports.md`'s row 30028 flips `planned` → `active` once this lands.

## 6. Process management: PM2 for packaging/production

`services/voice-assistant/ecosystem.config.js` (PM2's own config format) —
one app entry running the same `python src/main.py` entrypoint `dev:voice-assistant`
already uses, with PM2's `autorestart`/log-file options doing what a crashed
daemon needs (Felix isn't watching a terminal for a production run the way
he is in dev). Shape (declarative config, not logic — PM2 loads this file,
this codebase never imports it):

```javascript
module.exports = {
  apps: [
    {
      name: 'voice-assistant',
      script: 'src/main.py',
      interpreter: 'python',
      cwd: __dirname,
      env: { /* loaded from .env by config.py itself, not duplicated here */ },
    },
  ],
};
```

This is **only** the packaging/production story (spec §5.5, §8 OQ3
resolved) — `dev:voice-assistant`/`dev:all` never invoke PM2, by design
(§5).

## 7. Design patterns applied (language-agnostic reading of `docs/design-patterns.md`)

- **Service Layer equivalent**: `ConversationHandler` holds all the
  gate/transcribe/forward/reply logic — `main.py` and `wake_word_listener.py`
  both stay thin (the listener just calls `conversation_handler.handle_wake_word(...)`
  on each detected wake event).
- **Dependency Injection**: every external client/model wrapper
  (`SpeakerVerifier`, `Transcriber`, `Speaker`, `OrchestratorClient`,
  `KnowledgeStoreClient`) is constructed exactly once in `main.py` (the
  composition root) and passed into `ConversationHandler`'s constructor —
  never instantiated inline inside a function body. This is what lets
  `test_conversation_handler.py` inject fakes for all five instead of
  touching real audio hardware/models/network in a unit test.
- **Strategy/Factory**: not introduced this round — one wake-word engine,
  one STT engine, one TTS engine (`docs/conventions/architecture.md`'s
  "introduce the abstraction when the second real case shows up, not
  before"). If a second STT/TTS provider is ever wanted, that's when an
  interface gets extracted, not speculatively now.
- **Knowledge-store side**: same `VoiceProfileService` Service Layer + DI
  shape every other `knowledge-store` entity already uses (`SkillService`,
  `TelegramLinkService`) — no new pattern needed there.

## 8. Test strategy

| Target | Tool | Covers |
|---|---|---|
| `knowledge-store`'s `VoiceProfileService` | Vitest (mocked `PrismaClient`) | enroll/get/updateCurrentSession/reset (spec §5.1/§5.3) |
| `voiceProfileController` | Vitest + supertest | one test per endpoint/status, including the multipart `enroll` route |
| `SpeakerVerifier` | pytest + `pytest-mock` | match/no-match, and the "no enrollment path → always no-match" AC3 case, `speechbrain` call itself mocked |
| `Transcriber` | pytest + `pytest-mock` | returns the mocked `faster-whisper` model's text, doesn't touch a real model file in the test |
| `Speaker` | pytest + `pytest-mock` | calls Kokoro's synth + the playback call, both mocked — no real audio device touched in CI |
| `OrchestratorClient`/`KnowledgeStoreClient` | pytest + `pytest-mock` (mocked `requests`) | request shape (`KAA` header, body), response parsing, same coverage shape as this repo's Node HTTP clients |
| `ConversationHandler` | pytest + `pytest-mock` | AC2 (no-match short-circuits before transcription/forwarding), AC3 (no profile → no-match), AC4–AC6 happy path, session-pointer update only when it changed |
| `health_server.py` | pytest | `GET /health` returns 200 |
| `wake_word_listener.py` | — | no dedicated test — thin adapter over a continuous `pyaudio`/`openwakeword` loop, same deliberate, permanent exception `telegram-bot.py`'s `grammy` wiring already has in this repo. Exercised in manual end-to-end verification instead. |

## 9. Build order (→ `tasks.md`)

1. `knowledge-store`: `VoiceProfile` schema + `VoiceProfileService` +
   `voiceProfileController` + `multer` dependency + tests (§1).
2. `services/voice-assistant` scaffold: `requirements.txt`, `.env.example`,
   `config.py`, `pytest.ini`.
3. `health/health_server.py` + test (§3).
4. `clients/knowledge_store_client.py` + `clients/orchestrator_client.py` +
   tests.
5. `verification/speaker_verifier.py` + test.
6. `stt/transcriber.py` + test.
7. `tts/speaker.py` + test.
8. `conversation/conversation_handler.py` (§4) + test — the real
   orchestration logic, built against fakes for everything from steps 3–7.
9. `wake_word/wake_word_listener.py` (§2) — no dedicated test, manual
   verification only (step 12).
10. `main.py` composition root — wires everything, starts the health server
    thread + the blocking listen loop.
11. Root `package.json`'s `dev:voice-assistant`; `scripts/dev-all.mjs`
    update; `docs/ports.md` row flips `planned` → `active` (§5).
12. `ecosystem.config.js` (PM2, §6).
13. Manual end-to-end: enroll a real voice sample via
    `frontend/006-voice-enrollment`, start the daemon
    (`pnpm run dev:voice-assistant`), say the configured wake word + a
    request out loud, confirm the full AC1–AC6 loop — including that a
    second, different voice saying the same wake word produces no reaction
    at all (AC2).
