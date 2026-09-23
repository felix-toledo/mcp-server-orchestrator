# Tasks — Voice channel: wake word, speaker verification, local voice reply

Base: [`plan.md`](./plan.md) §9. `knowledge-store` tasks (T1) are ordinary
Node/Prisma work and can be picked up independently of the Python tasks
(T2–T11); the Python tasks are sequential per plan §9's dependency chain
(each later module's test fakes the ones before it).

- [ ] **T1 — `knowledge-store`: `VoiceProfile` schema + service + endpoints**
  (plan §1). Prisma migration for `VoiceProfile`/`VoiceProfileStatus`
  (spec §5.1). `VoiceProfileService.get`/`enroll`/`updateCurrentSession`/`reset`.
  New `src/voiceProfile/voiceProfileStorage.ts` (writes the uploaded sample
  to `%USERPROFILE%\Documents\alma\voice-profile\`, spec §5.2). `multer`
  added as a new dependency (one-line justification: this service's first
  multipart endpoint). `voiceProfileController.ts` wires
  `GET`/`POST /voice-profile/enroll`/`PATCH`/`DELETE /voice-profile`
  (spec §5.3).
  **Test**: `voiceProfileService.test.ts` (mocked `PrismaClient`) — enroll
  sets `status: TRAINED` + `trainedAt`, `reset` clears both plus
  `enrollmentAudioPath`, `updateCurrentSession` only touches
  `currentSessionId`. `server.test.ts` additions (supertest) — one test per
  route/status code, including a real multipart `POST` for `enroll`.

- [x] **T2 — Scaffold `services/voice-assistant`**: `requirements.txt`
  (plan §2 — flag the Kokoro package-name assumption inline in a comment at
  the top of the file, per plan §2's Default & Assumption, so it isn't lost
  between plan and code), `.env.example`, `config.py` (typed `Settings`
  loaded via `python-dotenv`), `pytest.ini`. No root `package.json` script
  yet (T9).
  **Test**: `test_config.py` — `Settings` loads every documented env var,
  including the `WAKE_WORD_THRESHOLD`/`UTTERANCE_DURATION_SECONDS` numeric
  parsing.

- [x] **T3 — `health/health_server.py`** (plan §3): a one-route Flask app,
  `GET /health` → `{"status": "ok"}`.
  **Test**: `test_health_server.py` — a request against the Flask test
  client returns `200` with the expected body.

- [x] **T4 — `clients/knowledge_store_client.py`**: `get_voice_profile()`,
  `update_current_session(session_id)` against `knowledge-store`'s new
  endpoints (T1) — mirrors this repo's Node `KnowledgeStoreClient`s (`fail`
  vs. `fail-open` per call, matching spec §5.3's read-on-startup use).
  **Test**: `test_knowledge_store_client.py` (mocked `requests`) — request
  shape, response parsing, error handling.

- [x] **T5 — `clients/orchestrator_client.py`**: `inquire(text, session_id)`
  → `(reply_text, new_session_id)`, `POST /api/inquire` with the `KAA`
  header (AC5) — same contract every other channel already uses.
  **Test**: `test_orchestrator_client.py` (mocked `requests`) — header/body
  shape, response parsing, `session_id` omitted vs. included correctly.

- [x] **T6 — `verification/speaker_verifier.py`**: wraps `speechbrain`'s
  `SpeakerRecognition.verify_batch` (AC2). `verify(captured_audio,
  enrollment_audio_path)` returns a non-match whenever
  `enrollment_audio_path` is `None` (AC3) without calling `speechbrain` at
  all in that case.
  **Test**: `test_speaker_verifier.py` (`speechbrain` model mocked/injected)
  — match, no-match, and the `None`-path short-circuit case.

- [x] **T7 — `stt/transcriber.py`**: wraps `faster-whisper` (AC4),
  `transcribe(audio_bytes) -> str`.
  **Test**: `test_transcriber.py` (mocked `faster-whisper` model) — returns
  the mocked model's text, never touches a real model file.

- [x] **T8 — `tts/speaker.py`**: wraps Kokoro TTS synthesis + local
  playback (AC6), `speak(text) -> None`.
  **Test**: `test_speaker.py` (both Kokoro's synth call and the playback
  call mocked) — called with the right text, playback invoked with the
  synthesized audio, no real audio device touched.

- [x] **T9 — `conversation/conversation_handler.py`** (plan §4): the
  AC2–AC6 orchestration — `handle_wake_word(audio_bytes)`.
  **Test**: `test_conversation_handler.py` (all five collaborators from
  T4–T8 injected as fakes/mocks) — AC2's no-match short-circuit (never
  reaches transcription or the orchestrator call), AC3's no-profile
  short-circuit, AC4–AC6's happy path end to end through the fakes, and the
  session-pointer update only firing when `new_session_id` actually
  differs from what was read.

- [x] **T10 — `wake_word/wake_word_listener.py`** (plan §2, §9): `openwakeword`
  + `pyaudio` continuous capture loop, calls
  `conversation_handler.handle_wake_word(...)` on each detected wake event
  crossing `WAKE_WORD_THRESHOLD` (AC1), then records
  `UTTERANCE_DURATION_SECONDS` of audio before handing it off (AC1's
  resolved fixed-window behavior, §8 OQ5). No dedicated test (plan §8's
  documented, permanent exception) — exercised in T12's manual
  verification only.

- [x] **T11 — `main.py` composition root**: builds every client/wrapper
  from T3–T10, reads `VoiceProfile` once at startup via
  `knowledge_store_client.get_voice_profile()` (AC3), starts
  `health_server`'s Flask app in a background thread, runs
  `wake_word_listener`'s blocking loop in the main thread.
  **Test**: none beyond what T3–T10 already cover individually — a
  composition root has no business logic of its own to unit-test (same
  treatment this repo's Node `index.ts` files already get).

- [x] **T12 — Wiring scripts**: root `package.json` gains
  `dev:voice-assistant` (plan §5); `scripts/dev-all.mjs` gains
  `voice-assistant` to `COLORS` + `DEPENDENTS`; `docs/ports.md` row flips
  `planned` → `active`; `services/voice-assistant/ecosystem.config.js`
  added (plan §6, PM2 packaging/production only — not wired into
  `dev:voice-assistant`/`dev:all`).

- [x] **T13 — Manual end-to-end — fully passed 2026-09-22.** Felix ran
  `pnpm run dev:all`, enrolled a real `VoiceProfile` via
  `frontend/006-voice-enrollment`, said "hey jarvis" + a real question out
  loud, and confirmed the complete AC1–AC6 loop for real: wake word
  detected → his voice verified against the enrolled sample (score 0.57,
  comfortably above the 0.25 threshold) → transcribed via the OpenAI
  Whisper API → forwarded to `orchestrator` → reply received → spoken back
  out loud through this machine's speakers via Kokoro. The AC2 negative
  case (a different voice) was exercised once earlier in the same session
  (score 0.125, correctly rejected) — not re-confirmed after every fix
  landed, low risk since nothing in the fixes below touches that gate's
  logic. Nine real bugs found only by actually running this end to end,
  none caught by the pytest suite (which mocks every external call) — each
  fixed in place, not deferred:
  1. **`openwakeword`'s `Model()` defaults to `tflite`, which has no
     Windows wheel.** Fixed by passing
     `inference_framework="onnx"` explicitly (`main.py`) — matches the
     pasted reference script's own choice, which this spec's earlier
     write-up hadn't carried over.
  2. **`openwakeword`'s pretrained model *weights* aren't installed by
     `pip install` — a separate `openwakeword.utils.download_models()`
     call is required once.** Not yet automated (no code changes this
     round) — a manual one-time step after `pip install -r requirements.txt`,
     same category as `pip install` itself. Needs a follow-up task if this
     should become part of setup docs or a first-run check in `main.py`.
  3. **`openwakeword_model.predict()` needs an `int16` numpy array, not
     the raw `bytes` `pyaudio`'s `stream.read()` returns.** Fixed in
     `wake_word/wake_word_listener.py` (`np.frombuffer(chunk, dtype=np.int16)`)
     — the exact conversion the pasted reference script already did and
     this repo's implementation had dropped.
  4. **`cmd.exe` (what `pnpm`/npm-run-script shells out to on Windows)
     silently no-ops — exit code 0, zero output — when the command's
     first token is an executable path using forward slashes** (e.g.
     `services/voice-assistant/.venv/Scripts/python.exe`), instead of the
     usual "not recognized" error. Root `package.json`'s
     `dev:voice-assistant` now uses backslashes for the interpreter path
     specifically (`services\voice-assistant\.venv\Scripts\python.exe`,
     `main.py`'s own path argument stays forward-slash since Python
     resolves that fine) — found only by testing the actual `pnpm run
     dev:voice-assistant`/`dev:all` commands, not by running
     `.venv\Scripts\python.exe` directly.
  5. **The OS default audio input device isn't reliably the real mic.**
     On this machine it was a virtual "Iriun Webcam" input (a phone-as-
     webcam app), so the daemon was listening to nothing. Added a new
     optional `AUDIO_INPUT_DEVICE_NAME` setting (`config.py`,
     `wake_word_listener.py`'s `_resolve_input_device_index`) — a
     case-insensitive substring match against `pyaudio`'s device names,
     pinned to `"Realtek"` in this machine's real `.env`. Unset still falls
     back to the OS default, logged explicitly either way so this is never
     silently wrong again.
  6. **`speechbrain`'s `verify_batch` needs float32 waveform *tensors*, not
     raw PCM `bytes` or a bare file *path*.** `verification/speaker_verifier.py`
     now converts both sides explicitly (`pcm_bytes_to_tensor`,
     `load_and_normalize`) before calling it.
  7. **Loading the enrollment sample (webm/opus, from the browser's
     `MediaRecorder`) via `torchaudio.load()` needs `torchcodec`, which
     itself needs a *system* FFmpeg install** — not just a pip package,
     and none was available. Swapped to shelling out to the portable FFmpeg
     binary `imageio-ffmpeg` ships as a pure pip package (no system
     install, no admin rights needed), asking it to downmix/resample in
     the same step — `torchaudio` isn't used for loading at all anymore.
  8. **Kokoro's `KPipeline.__call__` requires an explicit `voice` argument**
     — crashed with no default. `tts/speaker.py`'s `Speaker` now takes a
     `voice` constructor argument, wired from a new `KOKORO_VOICE` setting
     (default `"ef_dora"` — see item 10 below for how this ended up Spanish
     after all).
  9. **Kokoro yields `torch.Tensor` chunks, not numpy arrays** —
     `PyAudioPlayback.__call__`'s `audio.tobytes()` doesn't exist on a
     tensor. Fixed with an explicit `.detach().cpu().numpy()` conversion.
  10. **Spanish TTS turned out not to need a system `espeak-ng` install
      after all** — corrected same day, right after being written up above
      as a deferred follow-up. `espeakng_loader` (already pulled in
      transitively by `misaki[en]`, already in `requirements.txt`) bundles
      espeak-ng's shared library + data files as a pure pip package.
      `main.py`'s `KPipeline(lang_code="e")` (Spanish) plus
      `KOKORO_VOICE=ef_dora` (one of Kokoro's 3 Spanish voices — the other
      two are `em_alex`/`em_santa`, confirmed via `hexgrad/Kokoro-82M`'s
      own `voices/` listing on Hugging Face) — verified live, spoken reply
      is Spanish now.
  11. **`orchestrator`'s replies are Markdown** (bold, bullet lists,
      written for the chat UI) **and Kokoro read the literal symbols out
      loud** (asterisks, dashes) the first time a formatted reply came
      back. New `tts/text_normalizer.py` (`normalize_for_speech`, a pure
      function, actually unit-tested unlike this file's other AC6 pieces)
      strips bold/italic markers, headers, links, inline code, and bullet
      markers, and collapses blank lines into sentence breaks before the
      text ever reaches Kokoro — verified live against a real multi-bullet
      `orchestrator` reply.
  12. **Two-phase activation, at Felix's explicit request** (not a bug —
      a UX change to AC2, spec.md updated): `ConversationHandler` split
      into `verify_speaker` (runs against `wake_word_listener.py`'s new
      ~3s rolling buffer of audio leading up to the trigger, usually
      containing the wake phrase itself; on a match, speaks
      `"¿Sí?"` and returns `True`) and `handle_command` (only ever called
      after a `True`, against a *separate* capture window that starts
      after the activation prompt finishes playing — transcribe/forward/
      reply, no re-verification). Previously, verification and the actual
      command shared one fixed-window capture, forcing Felix to say the
      whole request in one breath immediately after the wake word with no
      feedback that he'd been recognized.
  Confirmed end to end with Felix's own real voice, a real enrollment, and
  real Spanish speech both ways (including a markdown-formatted reply
  spoken cleanly) — not simulated. Python 3.13 (this machine's default)
  still can't install this service's dependencies at all — see spec.md §6
  Default #8 — the dedicated Python 3.11.9 venv
  (`services/voice-assistant/.venv`) is what actually runs it.
