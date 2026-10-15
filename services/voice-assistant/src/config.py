"""Typed environment configuration, loaded via python-dotenv.

Mirrors this repo's Node services' single-`.env`-per-service convention
(`docs/ports.md`'s Rules) — one `Settings` object built once at startup by
`main.py` (the composition root) and passed down, never read from
`os.environ` ad hoc deeper in the call stack.
"""

from __future__ import annotations

import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Settings:
    port: int
    orchestrator_url: str
    key_allowed_agents: str
    knowledge_store_url: str
    wake_word_model: str
    wake_word_threshold: float
    utterance_duration_seconds: int
    openai_api_key: str
    audio_input_device_name: str | None
    kokoro_voice: str
    elevenlabs_api_key: str | None

    @staticmethod
    def load() -> "Settings":
        return Settings(
            port=int(os.environ.get("PORT", "30028")),
            orchestrator_url=os.environ["ORCHESTRATOR_URL"],
            key_allowed_agents=os.environ["KEY_ALLOWED_AGENTS"],
            knowledge_store_url=os.environ["KNOWLEDGE_STORE_URL"],
            wake_word_model=os.environ.get("WAKE_WORD_MODEL", "hey_jarvis"),
            wake_word_threshold=float(os.environ.get("WAKE_WORD_THRESHOLD", "0.5")),
            utterance_duration_seconds=int(os.environ.get("UTTERANCE_DURATION_SECONDS", "5")),
            openai_api_key=os.environ["OPENAI_API_KEY"],
            # Optional — a case-insensitive substring match against
            # PyAudio's device names (e.g. "Realtek"). Added 2026-09-22:
            # Windows' *default* recording device isn't reliably the real
            # mic — on Felix's machine it was a virtual "Iriun Webcam"
            # input, found only by logging which device got picked at
            # runtime. Unset falls back to the OS default, same as before.
            audio_input_device_name=os.environ.get("AUDIO_INPUT_DEVICE_NAME") or None,
            # Kokoro's `KPipeline.__call__` requires an explicit voice —
            # found 2026-09-22 (crashed with no default). "ef_dora" is one
            # of Kokoro's 3 Spanish voices (`ef_dora`/`em_alex`/`em_santa`,
            # per hexgrad/Kokoro-82M's own `voices/` listing) — matches
            # `main.py`'s `lang_code="e"`, since `orchestrator`'s replies
            # are in Spanish.
            kokoro_voice=os.environ.get("KOKORO_VOICE", "ef_dora"),
            # Optional — only needed when the user picks ELEVENLABS as
            # VoiceProfile.ttsEngine (Settings > Voz). Unset means main.py
            # always falls back to the free Kokoro voice, same fail-safe
            # posture as a missing enrollment sample.
            elevenlabs_api_key=os.environ.get("ELEVENLABS_API_KEY") or None,
        )
