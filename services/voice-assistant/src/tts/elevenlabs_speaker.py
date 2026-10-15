"""Wraps ElevenLabs TTS synthesis + local playback — the paid alternative
to `KokoroSpeaker`/`Speaker` (tts/speaker.py, "la voz gratis y fea"). Same
`.speak(text)` shape (Strategy pattern, docs/design-patterns.md), picked in
main.py based on the user's Settings > Voz choice
(`VoiceProfile.ttsEngine`/`ttsVoiceId`).

ElevenLabs' REST API returns MP3, not raw PCM — PCM `output_format`s need a
paid tier this account isn't guaranteed to have, so `mp3_decode.py` always
decodes via ffmpeg instead of asking for one.
"""

from __future__ import annotations

from typing import Callable

import requests

from tts.mp3_decode import decode_mp3_to_pcm16
from tts.text_normalizer import normalize_for_speech

ELEVENLABS_SAMPLE_RATE = 24000
ELEVENLABS_API_BASE = "https://api.elevenlabs.io/v1"
# Only multilingual model that reliably speaks Spanish well — the
# turbo/flash models are English-first and mangle Spanish prosody.
ELEVENLABS_MODEL_ID = "eleven_multilingual_v2"


class ElevenLabsSpeaker:
    def __init__(self, api_key: str, voice_id: str, playback: Callable[[bytes, int], None]) -> None:
        self._api_key = api_key
        self._voice_id = voice_id
        self._playback = playback

    def speak(self, text: str) -> None:
        speakable_text = normalize_for_speech(text)
        response = requests.post(
            f"{ELEVENLABS_API_BASE}/text-to-speech/{self._voice_id}",
            headers={
                "xi-api-key": self._api_key,
                "Accept": "audio/mpeg",
                "Content-Type": "application/json",
            },
            json={"text": speakable_text, "model_id": ELEVENLABS_MODEL_ID},
        )
        response.raise_for_status()
        pcm = decode_mp3_to_pcm16(response.content, ELEVENLABS_SAMPLE_RATE)
        self._playback(pcm, ELEVENLABS_SAMPLE_RATE)
