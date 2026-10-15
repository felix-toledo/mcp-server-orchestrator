from dataclasses import replace

from clients.knowledge_store_client import VoiceProfile
from config import Settings
from tts.elevenlabs_speaker import ElevenLabsSpeaker
from tts.speaker import Speaker
from tts.speaker_factory import build_speaker

BASE_SETTINGS = Settings(
    port=30028,
    orchestrator_url="http://localhost:30021",
    key_allowed_agents="secret",
    knowledge_store_url="http://localhost:30025",
    wake_word_model="hey_jarvis",
    wake_word_threshold=0.5,
    utterance_duration_seconds=5,
    openai_api_key="sk-test",
    audio_input_device_name=None,
    kokoro_voice="ef_dora",
    elevenlabs_api_key="el-key",
)

BASE_PROFILE = VoiceProfile(
    status="TRAINED",
    enrollment_audio_path="C:\\voice-profile\\sample.wav",
    current_session_id=None,
    trained_at=None,
    tts_engine="ELEVENLABS",
    tts_voice_id="voice-123",
)


def test_build_speaker_picks_elevenlabs_when_fully_configured(mocker):
    pyaudio_module = mocker.Mock(paInt16="int16-format")
    speaker = build_speaker(BASE_SETTINGS, BASE_PROFILE, pyaudio_module, kokoro_pipeline=mocker.Mock())

    assert isinstance(speaker, ElevenLabsSpeaker)


def test_build_speaker_falls_back_to_kokoro_when_no_voice_profile(mocker):
    pyaudio_module = mocker.Mock(paFloat32="float32-format")
    speaker = build_speaker(BASE_SETTINGS, None, pyaudio_module, kokoro_pipeline=mocker.Mock())

    assert isinstance(speaker, Speaker)


def test_build_speaker_falls_back_to_kokoro_when_engine_is_kokoro(mocker):
    profile = replace(BASE_PROFILE, tts_engine="KOKORO")
    pyaudio_module = mocker.Mock(paFloat32="float32-format")
    speaker = build_speaker(BASE_SETTINGS, profile, pyaudio_module, kokoro_pipeline=mocker.Mock())

    assert isinstance(speaker, Speaker)


def test_build_speaker_falls_back_to_kokoro_when_no_voice_id(mocker):
    profile = replace(BASE_PROFILE, tts_voice_id=None)
    pyaudio_module = mocker.Mock(paFloat32="float32-format")
    speaker = build_speaker(BASE_SETTINGS, profile, pyaudio_module, kokoro_pipeline=mocker.Mock())

    assert isinstance(speaker, Speaker)


def test_build_speaker_falls_back_to_kokoro_when_no_api_key_configured(mocker):
    settings = replace(BASE_SETTINGS, elevenlabs_api_key=None)
    pyaudio_module = mocker.Mock(paFloat32="float32-format")
    speaker = build_speaker(settings, BASE_PROFILE, pyaudio_module, kokoro_pipeline=mocker.Mock())

    assert isinstance(speaker, Speaker)
