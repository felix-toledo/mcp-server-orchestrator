import requests

from tts.elevenlabs_speaker import ELEVENLABS_MODEL_ID, ELEVENLABS_SAMPLE_RATE, ElevenLabsSpeaker


class FakeResponse:
    def __init__(self, status_code=200, content=b""):
        self.status_code = status_code
        self.ok = 200 <= status_code < 300
        self.content = content

    def raise_for_status(self):
        if not self.ok:
            raise requests.HTTPError(f"status {self.status_code}")


def test_speak_posts_to_elevenlabs_decodes_and_plays(mocker):
    post_mock = mocker.patch(
        "tts.elevenlabs_speaker.requests.post",
        return_value=FakeResponse(200, content=b"mp3-bytes"),
    )
    decode_mock = mocker.patch(
        "tts.elevenlabs_speaker.decode_mp3_to_pcm16",
        return_value=b"pcm-bytes",
    )
    played = []
    speaker = ElevenLabsSpeaker(
        api_key="key-123",
        voice_id="voice-abc",
        playback=lambda audio, rate: played.append((audio, rate)),
    )

    speaker.speak("**hola**, ¿cómo estás?")

    post_mock.assert_called_once_with(
        "https://api.elevenlabs.io/v1/text-to-speech/voice-abc",
        headers={
            "xi-api-key": "key-123",
            "Accept": "audio/mpeg",
            "Content-Type": "application/json",
        },
        json={"text": "hola, ¿cómo estás?", "model_id": ELEVENLABS_MODEL_ID},
    )
    decode_mock.assert_called_once_with(b"mp3-bytes", ELEVENLABS_SAMPLE_RATE)
    assert played == [(b"pcm-bytes", ELEVENLABS_SAMPLE_RATE)]


def test_speak_raises_on_non_ok_response(mocker):
    mocker.patch("tts.elevenlabs_speaker.requests.post", return_value=FakeResponse(401))
    speaker = ElevenLabsSpeaker(api_key="bad-key", voice_id="voice-abc", playback=mocker.Mock())

    try:
        speaker.speak("hola")
        assert False, "expected raise_for_status to raise"
    except requests.HTTPError:
        pass
