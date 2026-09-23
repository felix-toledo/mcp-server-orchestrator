from stt.transcriber import Transcriber


def test_transcribe_posts_wav_wrapped_audio_and_returns_stripped_text(mocker):
    mock_response = mocker.Mock()
    mock_response.raise_for_status.return_value = None
    mock_response.json.return_value = {"text": " hola mundo "}
    mock_post = mocker.patch("stt.transcriber.requests.post", return_value=mock_response)

    transcriber = Transcriber(api_key="sk-test")
    result = transcriber.transcribe(b"\x00\x01" * 100)

    assert result == "hola mundo"
    _, kwargs = mock_post.call_args
    assert kwargs["headers"]["Authorization"] == "Bearer sk-test"
    assert kwargs["data"]["model"] == "whisper-1"
    filename, file_bytes, content_type = kwargs["files"]["file"]
    assert filename == "utterance.wav"
    assert file_bytes.startswith(b"RIFF")
    assert content_type == "audio/wav"


def test_transcribe_raises_when_the_api_returns_an_error_status(mocker):
    mock_response = mocker.Mock()
    mock_response.raise_for_status.side_effect = RuntimeError("401 unauthorized")
    mocker.patch("stt.transcriber.requests.post", return_value=mock_response)

    transcriber = Transcriber(api_key="sk-bad")

    try:
        transcriber.transcribe(b"\x00\x01")
        assert False, "expected raise_for_status's error to propagate"
    except RuntimeError as exc:
        assert str(exc) == "401 unauthorized"
