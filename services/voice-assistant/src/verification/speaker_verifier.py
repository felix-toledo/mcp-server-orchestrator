"""Wraps speechbrain's `SpeakerRecognition.verify_batch` (AC2) — the gate
everything downstream depends on. `verify` returns a non-match whenever
`enrollment_audio_path` is `None` (AC3's "no enrolled profile yet" case)
without ever calling into speechbrain, matching spec §5.4's single-attempt,
no-retry, plain yes/no design (default `spkrec-ecapa-voxceleb` threshold,
no custom confirmation flow).

Amended 2026-09-22, found only by running this against a real mic and a
real enrolled sample: `verify_batch` needs float32 waveform *tensors*, not
raw PCM `bytes` (what `wake_word_listener.py` captures) or a bare file
*path* (what `enrollment_audio_path` is) — both need converting first.

The enrollment sample is whatever format the browser's `MediaRecorder`
produced (`frontend/006-voice-enrollment` — webm/opus in practice).
`torchaudio.load()` needs `torchcodec`, which in turn needs a *system*
FFmpeg install (not just a pip package) to actually decode anything —
confirmed unavailable on this machine. Decoding instead shells out to the
portable FFmpeg binary `imageio-ffmpeg` ships as a pip package (no system
install, no admin rights) and asks it to do the resample/downmix too, so
`torchaudio` isn't needed here at all.
"""

from __future__ import annotations

import io
import logging
import subprocess
import wave

import imageio_ffmpeg
import numpy as np
import torch

logger = logging.getLogger(__name__)

TARGET_SAMPLE_RATE = 16000  # matches wake_word_listener.py's capture rate
# and the ECAPA-VoxCeleb model's expected input rate.


class SpeakerVerifier:
    def __init__(self, speaker_recognition) -> None:
        self._speaker_recognition = speaker_recognition

    def verify(self, captured_audio: bytes, enrollment_audio_path: str | None) -> bool:
        if enrollment_audio_path is None:
            return False

        captured_signal = pcm_bytes_to_tensor(captured_audio)
        enrollment_signal = load_and_normalize(enrollment_audio_path)

        score, prediction = self._speaker_recognition.verify_batch(captured_signal, enrollment_signal)
        # Logged unconditionally (match or not) so a borderline score is
        # visible — added 2026-09-22 after a real false-negative with no
        # way to tell how close it was to the (speechbrain-default) threshold.
        logger.info("Speaker verification score=%s prediction=%s", score, prediction)
        return bool(prediction)


def pcm_bytes_to_tensor(pcm_bytes: bytes) -> torch.Tensor:
    """Raw 16-bit PCM at `TARGET_SAMPLE_RATE` (as `wake_word_listener.py`
    captures it) into the float32, batched `(1, time)` tensor shape
    `verify_batch` expects."""
    samples = np.frombuffer(pcm_bytes, dtype=np.int16).astype(np.float32) / 32768.0
    return torch.from_numpy(samples).unsqueeze(0)


def load_and_normalize(audio_path: str) -> torch.Tensor:
    """Decodes the enrollment sample (whatever format the browser recorded)
    via a portable FFmpeg binary, asking it to downmix to mono and resample
    to `TARGET_SAMPLE_RATE` in the same step, then parses the resulting WAV
    with the stdlib `wave` module (no `torchaudio`/`torchcodec` needed)."""
    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    result = subprocess.run(
        [ffmpeg_exe, "-i", audio_path, "-f", "wav", "-ar", str(TARGET_SAMPLE_RATE), "-ac", "1", "-"],
        capture_output=True,
        check=True,
    )
    with wave.open(io.BytesIO(result.stdout), "rb") as wav_file:
        pcm_bytes = wav_file.readframes(wav_file.getnframes())
    return pcm_bytes_to_tensor(pcm_bytes)
