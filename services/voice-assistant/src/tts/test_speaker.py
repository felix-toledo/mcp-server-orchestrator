from tts.speaker import KOKORO_SAMPLE_RATE, Speaker


class FakePipeline:
    def __init__(self, chunks):
        self.chunks = chunks
        self.calls = []

    def __call__(self, text, voice=None):
        self.calls.append(text)
        return iter(self.chunks)


def test_speak_synthesizes_and_plays_each_chunk():
    pipeline = FakePipeline([("g1", "p1", "audio-1"), ("g2", "p2", "audio-2")])
    played = []
    speaker = Speaker(pipeline, playback=lambda audio, rate: played.append((audio, rate)), voice="af_heart")

    speaker.speak("hola")

    assert pipeline.calls == ["hola"]
    assert played == [("audio-1", KOKORO_SAMPLE_RATE), ("audio-2", KOKORO_SAMPLE_RATE)]


def test_speak_calls_synth_and_playback_without_touching_a_real_audio_device(mocker):
    pipeline = mocker.Mock(return_value=iter([("g", "p", "synthesized-audio")]))
    playback = mocker.Mock()
    speaker = Speaker(pipeline, playback, voice="af_heart")

    speaker.speak("hola")

    pipeline.assert_called_once_with("hola", voice="af_heart")
    playback.assert_called_once_with("synthesized-audio", KOKORO_SAMPLE_RATE)
