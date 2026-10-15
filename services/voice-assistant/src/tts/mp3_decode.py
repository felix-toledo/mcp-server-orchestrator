"""Decodes MP3 bytes (ElevenLabs' TTS response format) to mono 16-bit PCM.

Shells out to the ffmpeg binary `imageio-ffmpeg` already vendors — already a
transitive dependency of this service (Kokoro's own chain needs it), so this
needs no extra system install and no new dependency. Not unit-tested: a thin
adapter over a real subprocess, same class of exception `PyAudioPlayback`
already has in this file tree.
"""

from __future__ import annotations

import subprocess

import imageio_ffmpeg


def decode_mp3_to_pcm16(mp3_bytes: bytes, sample_rate: int) -> bytes:
    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    result = subprocess.run(
        [ffmpeg_exe, "-loglevel", "error", "-i", "pipe:0", "-f", "s16le", "-ar", str(sample_rate), "-ac", "1", "pipe:1"],
        input=mp3_bytes,
        capture_output=True,
        check=True,
    )
    return result.stdout
