"""Wraps Kokoro TTS synthesis + local playback (AC6) — a full local
voice-out loop: synthesized audio is played through this machine's own
speakers, never streamed anywhere or written to a file for another service
to fetch.

`pipeline` (a `kokoro.KPipeline` instance) and `playback` are both injected
(DI, plan.md §7) — this is what lets `test_speaker.py` exercise `speak`
without touching a real Kokoro model or a real audio device.
"""

from __future__ import annotations

from typing import Callable, Protocol

from tts.text_normalizer import normalize_for_speech

KOKORO_SAMPLE_RATE = 24000


class SpeakerLike(Protocol):
    """Structural type for `ConversationHandler`'s `speaker` — both `Speaker`
    (Kokoro) and `ElevenLabsSpeaker` satisfy it, so callers don't need to
    know which engine `tts/speaker_factory.py` picked.
    """

    def speak(self, text: str) -> None: ...


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

    `sample_format` defaults to `paFloat32` (Kokoro's own output dtype) —
    `ElevenLabsSpeaker` passes `paInt16` instead, since its audio is already
    decoded PCM16 bytes (`tts/mp3_decode.py`), not a tensor.
    """

    def __init__(self, pyaudio_module, sample_format=None) -> None:
        self._pyaudio_module = pyaudio_module
        self._sample_format = sample_format if sample_format is not None else pyaudio_module.paFloat32

    def __call__(self, audio, sample_rate: int) -> None:
        # Kokoro yields a torch.Tensor, not a numpy array — `.tobytes()`
        # doesn't exist on it directly. Found only by actually running this
        # 2026-09-22 (AttributeError: 'Tensor' object has no attribute
        # 'tobytes'). `.detach().cpu().numpy()` is the standard conversion
        # regardless of whether the tensor requires grad or sits on a GPU
        # (this service runs CPU-only, but being correct here is free).
        # `ElevenLabsSpeaker` already hands over raw PCM16 `bytes` — nothing
        # left to convert there.
        if isinstance(audio, (bytes, bytearray)):
            audio_bytes = bytes(audio)
        elif hasattr(audio, "detach"):
            audio_bytes = audio.detach().cpu().numpy().tobytes()
        else:
            audio_bytes = audio.tobytes()

        pa = self._pyaudio_module.PyAudio()
        try:
            stream = pa.open(format=self._sample_format, channels=1, rate=sample_rate, output=True)
            try:
                stream.write(audio_bytes)
            finally:
                stream.stop_stream()
                stream.close()
        finally:
            pa.terminate()
