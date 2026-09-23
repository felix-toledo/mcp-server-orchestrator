"""Wraps Kokoro TTS synthesis + local playback (AC6) — a full local
voice-out loop: synthesized audio is played through this machine's own
speakers, never streamed anywhere or written to a file for another service
to fetch.

`pipeline` (a `kokoro.KPipeline` instance) and `playback` are both injected
(DI, plan.md §7) — this is what lets `test_speaker.py` exercise `speak`
without touching a real Kokoro model or a real audio device.
"""

from __future__ import annotations

from typing import Callable

from tts.text_normalizer import normalize_for_speech

KOKORO_SAMPLE_RATE = 24000


class Speaker:
    def __init__(self, pipeline, playback: Callable[[object, int], None], voice: str) -> None:
        self._pipeline = pipeline
        self._playback = playback
        self._voice = voice

    def speak(self, text: str) -> None:
        # `voice` is required by Kokoro's `KPipeline.__call__` — found only
        # by actually running this 2026-09-22 (ValueError: "Specify a voice").
        # `orchestrator`'s replies are Markdown (chat-UI formatting) — read
        # literally by Kokoro otherwise (found the same day, on a reply with
        # bold text and a bullet list).
        speakable_text = normalize_for_speech(text)
        for _graphemes, _phonemes, audio in self._pipeline(speakable_text, voice=self._voice):
            self._playback(audio, KOKORO_SAMPLE_RATE)


class PyAudioPlayback:
    """Real local-speaker playback via `pyaudio` — the one already-required
    dependency this service uses for mic capture too, so no extra audio
    library is needed just for output. Not unit-tested: a thin adapter over
    a real audio device, same class of exception `wake_word_listener.py`
    already has in this file tree (plan.md §8).
    """

    def __init__(self, pyaudio_module) -> None:
        self._pyaudio_module = pyaudio_module

    def __call__(self, audio, sample_rate: int) -> None:
        # Kokoro yields a torch.Tensor, not a numpy array — `.tobytes()`
        # doesn't exist on it directly. Found only by actually running this
        # 2026-09-22 (AttributeError: 'Tensor' object has no attribute
        # 'tobytes'). `.detach().cpu().numpy()` is the standard conversion
        # regardless of whether the tensor requires grad or sits on a GPU
        # (this service runs CPU-only, but being correct here is free).
        audio_bytes = audio.detach().cpu().numpy().tobytes() if hasattr(audio, "detach") else audio.tobytes()

        pa = self._pyaudio_module.PyAudio()
        try:
            stream = pa.open(format=self._pyaudio_module.paFloat32, channels=1, rate=sample_rate, output=True)
            try:
                stream.write(audio_bytes)
            finally:
                stream.stop_stream()
                stream.close()
        finally:
            pa.terminate()
