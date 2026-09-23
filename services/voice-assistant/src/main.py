"""Composition root — builds every client/wrapper, reads `VoiceProfile`
once at startup (AC3), starts the health server in a background thread,
and runs the blocking wake-word listen loop in the main thread. No
business logic of its own — same treatment this repo's Node `index.ts`
entry points already get (no dedicated test).
"""

from __future__ import annotations

import logging
from threading import Thread

import pyaudio
from kokoro import KPipeline
from openwakeword.model import Model as OpenWakeWordModel
from speechbrain.inference.speaker import SpeakerRecognition

from clients.knowledge_store_client import KnowledgeStoreClient
from clients.orchestrator_client import OrchestratorClient
from config import Settings
from conversation.conversation_handler import ConversationHandler
from health.health_server import run_health_server
from stt.transcriber import Transcriber
from tts.speaker import PyAudioPlayback, Speaker
from verification.speaker_verifier import SpeakerVerifier
from wake_word.wake_word_listener import run_wake_word_listener

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)


def main() -> None:
    settings = Settings.load()

    knowledge_store_client = KnowledgeStoreClient(settings.knowledge_store_url)
    orchestrator_client = OrchestratorClient(settings.orchestrator_url, settings.key_allowed_agents)

    voice_profile = knowledge_store_client.get_voice_profile()
    enrollment_audio_path = voice_profile.enrollment_audio_path if voice_profile else None
    current_session_id = voice_profile.current_session_id if voice_profile else None

    if enrollment_audio_path is None:
        logger.warning(
            "No voice profile enrolled yet (AC3) — the wake word will be "
            "detected but every match will be ignored until you enroll one "
            "at Settings > Voz in the web UI, then restart this daemon."
        )
    else:
        logger.info("Voice profile loaded: %s", enrollment_audio_path)

    speaker_recognition = SpeakerRecognition.from_hparams(source="speechbrain/spkrec-ecapa-voxceleb")
    speaker_verifier = SpeakerVerifier(speaker_recognition)

    transcriber = Transcriber(settings.openai_api_key)

    # lang_code="e" (Spanish) — ALMA's replies are in Spanish. Needs
    # espeak-ng's phonemizer backend; confirmed 2026-09-22 this doesn't need
    # a system install after all — `espeakng_loader` (already a transitive
    # dependency via misaki[en]) bundles the shared library + data files.
    kokoro_pipeline = KPipeline(lang_code="e")
    speaker = Speaker(kokoro_pipeline, PyAudioPlayback(pyaudio), settings.kokoro_voice)

    conversation_handler = ConversationHandler(
        speaker_verifier=speaker_verifier,
        transcriber=transcriber,
        orchestrator_client=orchestrator_client,
        knowledge_store_client=knowledge_store_client,
        speaker=speaker,
        enrollment_audio_path=enrollment_audio_path,
        current_session_id=current_session_id,
    )

    Thread(target=run_health_server, args=(settings,), daemon=True).start()

    # `inference_framework="onnx"` matches the pasted reference script's own
    # choice — openwakeword defaults to tflite when both variants exist for
    # a pretrained model, and `tflite-runtime` has no easy Windows wheel;
    # `onnxruntime` is already a dependency (openwakeword's own), so this
    # avoids a second inference runtime for no benefit. Found by actually
    # running this at 2026-09-22 — main.py crashed on startup without it.
    openwakeword_model = OpenWakeWordModel(
        wakeword_models=[settings.wake_word_model], inference_framework="onnx"
    )
    run_wake_word_listener(settings, conversation_handler, openwakeword_model, pyaudio)


if __name__ == "__main__":
    main()
