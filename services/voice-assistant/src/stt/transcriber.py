"""Wraps the OpenAI Whisper API for speech-to-text (AC4). Amended
2026-09-22 from a local `faster-whisper` model to this API — see
spec.md's Open Questions §2 item 2 for why. Reuses the same
`OPENAI_API_KEY` `knowledge-store` already holds for embeddings.
"""

from __future__ import annotations

import io
import wave

import requests

OPENAI_TRANSCRIPTIONS_URL = "https://api.openai.com/v1/audio/transcriptions"
SAMPLE_RATE = 16000


class Transcriber:
    def __init__(self, api_key: str) -> None:
        self._api_key = api_key

    def transcribe(self, audio_bytes: bytes) -> str:
        wav_bytes = _wrap_pcm_as_wav(audio_bytes)
        response = requests.post(
            OPENAI_TRANSCRIPTIONS_URL,
            headers={"Authorization": f"Bearer {self._api_key}"},
            files={"file": ("utterance.wav", wav_bytes, "audio/wav")},
            data={"model": "whisper-1"},
            timeout=30,
        )
        response.raise_for_status()
        return response.json()["text"].strip()


def _wrap_pcm_as_wav(pcm_bytes: bytes) -> bytes:
    """`wake_word_listener.py` hands over raw 16-bit PCM, no container —
    the Whisper API needs a real audio file, so wrap it as a WAV in memory
    (stdlib `wave`, no new dependency)."""
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(SAMPLE_RATE)
        wav_file.writeframes(pcm_bytes)
    return buffer.getvalue()
