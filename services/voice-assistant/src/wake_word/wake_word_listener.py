"""`openwakeword` + `pyaudio` continuous mic capture loop (AC1). No
dedicated test — a thin adapter over a real audio device and a real model,
same deliberate, permanent exception `telegram-bot`'s `grammy` wiring
already has in this repo (plan.md §8/§9). Exercised in manual end-to-end
verification instead (tasks.md T13).
"""

from __future__ import annotations

import logging
from collections import deque

import numpy as np

from config import Settings
from conversation.conversation_handler import ConversationHandler

logger = logging.getLogger(__name__)

CHUNK_SIZE = 1280  # openwakeword's expected frame size at 16kHz mono
SAMPLE_RATE = 16000
VERIFICATION_BUFFER_SECONDS = 3  # rolling window ending at the wake-word
# trigger, used for speaker verification (AC2) — long enough to usually
# contain the "hey jarvis" phrase itself, so Felix doesn't need to keep
# talking past the wake word just to get verified.


def run_wake_word_listener(
    settings: Settings,
    conversation_handler: ConversationHandler,
    openwakeword_model,
    pyaudio_module,
) -> None:
    pa = pyaudio_module.PyAudio()
    device_index = _resolve_input_device_index(pa, settings.audio_input_device_name)

    stream = pa.open(
        format=pyaudio_module.paInt16,
        channels=1,
        rate=SAMPLE_RATE,
        input=True,
        input_device_index=device_index,
        frames_per_buffer=CHUNK_SIZE,
    )
    logger.info(
        "Listening for wake word '%s' (threshold=%.2f)...",
        settings.wake_word_model,
        settings.wake_word_threshold,
    )

    verification_buffer_chunks = int(SAMPLE_RATE * VERIFICATION_BUFFER_SECONDS / CHUNK_SIZE)
    recent_chunks: deque[bytes] = deque(maxlen=verification_buffer_chunks)

    try:
        while True:
            chunk = stream.read(CHUNK_SIZE, exception_on_overflow=False)
            recent_chunks.append(chunk)
            # openwakeword's predict() needs an int16 numpy array, not raw
            # bytes — found by actually running this against a real mic
            # 2026-09-22 (PyAudio's stream.read() returns bytes).
            predictions = openwakeword_model.predict(np.frombuffer(chunk, dtype=np.int16))

            top_name, top_score = max(predictions.items(), key=lambda item: item[1])
            triggered = top_score >= settings.wake_word_threshold
            if not triggered:
                continue

            logger.info("Wake word '%s' detected (score=%.2f) — verifying speaker...", top_name, top_score)

            # Verify against the last few seconds leading up to the trigger
            # (usually contains the wake phrase itself) — not the command
            # that follows, which hasn't been said yet at this point.
            verification_audio = b"".join(recent_chunks)
            openwakeword_model.reset()
            recent_chunks.clear()

            is_verified = conversation_handler.verify_speaker(verification_audio)
            if not is_verified:
                continue

            # `verify_speaker` already spoke the activation prompt ("¿Sí?")
            # — only start capturing the real command after that finishes,
            # so it isn't clipped into the front of the recording.
            frames_needed = int(SAMPLE_RATE * settings.utterance_duration_seconds / CHUNK_SIZE)
            frames = [stream.read(CHUNK_SIZE, exception_on_overflow=False) for _ in range(frames_needed)]
            command_audio = b"".join(frames)

            conversation_handler.handle_command(command_audio)
    finally:
        stream.stop_stream()
        stream.close()
        pa.terminate()


def _resolve_input_device_index(pa, device_name_filter: str | None) -> int | None:
    """`None` tells `pyaudio` to use the OS default input device. Returns an
    explicit index only when `AUDIO_INPUT_DEVICE_NAME` is set and a matching
    device is found — see `config.py`'s Default & Assumption for why this
    exists (the OS default isn't reliably the real mic on every machine)."""
    if device_name_filter is None:
        default_name = pa.get_default_input_device_info().get("name")
        logger.info("Using the OS default audio input device: %s", default_name)
        return None

    needle = device_name_filter.lower()
    for i in range(pa.get_device_count()):
        info = pa.get_device_info_by_index(i)
        if info.get("maxInputChannels", 0) > 0 and needle in info.get("name", "").lower():
            logger.info("Using audio input device #%d matching %r: %s", i, device_name_filter, info["name"])
            return i

    logger.warning(
        "No audio input device matched AUDIO_INPUT_DEVICE_NAME=%r — falling back to the OS default.",
        device_name_filter,
    )
    default_name = pa.get_default_input_device_info().get("name")
    logger.info("Using the OS default audio input device: %s", default_name)
    return None
