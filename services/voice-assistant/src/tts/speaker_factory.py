"""Factory Pattern (docs/design-patterns.md) — picks the TTS engine per the
user's Settings > Voz choice (`VoiceProfile.ttsEngine`/`ttsVoiceId`),
falling back to the free `Speaker`/Kokoro voice whenever ElevenLabs isn't
fully usable (no profile yet, engine left at KOKORO, no voice picked, or no
`ELEVENLABS_API_KEY` configured on this machine) — same fail-safe posture
`main.py` already applies to a missing enrollment sample (AC3).
"""

from __future__ import annotations

from clients.knowledge_store_client import VoiceProfile
from config import Settings
from tts.elevenlabs_speaker import ElevenLabsSpeaker
from tts.speaker import PyAudioPlayback, Speaker


def build_speaker(settings: Settings, voice_profile: VoiceProfile | None, pyaudio_module, kokoro_pipeline):
    if (
        voice_profile is not None
        and voice_profile.tts_engine == "ELEVENLABS"
        and voice_profile.tts_voice_id
        and settings.elevenlabs_api_key
    ):
        return ElevenLabsSpeaker(
            api_key=settings.elevenlabs_api_key,
            voice_id=voice_profile.tts_voice_id,
            playback=PyAudioPlayback(pyaudio_module, sample_format=pyaudio_module.paInt16),
        )

    return Speaker(kokoro_pipeline, PyAudioPlayback(pyaudio_module), settings.kokoro_voice)
