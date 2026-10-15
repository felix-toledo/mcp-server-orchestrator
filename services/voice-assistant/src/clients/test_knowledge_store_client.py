import requests

from clients.knowledge_store_client import KnowledgeStoreClient, VoiceProfile


class FakeResponse:
    def __init__(self, status_code=200, json_body=None):
        self.status_code = status_code
        self.ok = 200 <= status_code < 300
        self._json_body = json_body or {}

    def json(self):
        return self._json_body

    def raise_for_status(self):
        if not self.ok:
            raise requests.HTTPError(f"status {self.status_code}")


def test_get_voice_profile_parses_response(mocker):
    mocker.patch(
        "clients.knowledge_store_client.requests.get",
        return_value=FakeResponse(
            200,
            {
                "status": "TRAINED",
                "enrollmentAudioPath": "C:\\voice-profile\\sample.wav",
                "currentSessionId": "session-1",
                "trainedAt": "2026-09-22T00:00:00.000Z",
                "ttsEngine": "ELEVENLABS",
                "ttsVoiceId": "voice-123",
            },
        ),
    )

    client = KnowledgeStoreClient("http://localhost:30025")
    profile = client.get_voice_profile()

    assert profile == VoiceProfile(
        status="TRAINED",
        enrollment_audio_path="C:\\voice-profile\\sample.wav",
        current_session_id="session-1",
        trained_at="2026-09-22T00:00:00.000Z",
        tts_engine="ELEVENLABS",
        tts_voice_id="voice-123",
    )


def test_get_voice_profile_defaults_tts_engine_to_kokoro_when_absent(mocker):
    mocker.patch(
        "clients.knowledge_store_client.requests.get",
        return_value=FakeResponse(
            200,
            {
                "status": "NOT_TRAINED",
                "enrollmentAudioPath": None,
                "currentSessionId": None,
                "trainedAt": None,
            },
        ),
    )

    client = KnowledgeStoreClient("http://localhost:30025")
    profile = client.get_voice_profile()

    assert profile.tts_engine == "KOKORO"
    assert profile.tts_voice_id is None


def test_get_voice_profile_returns_none_on_404(mocker):
    mocker.patch(
        "clients.knowledge_store_client.requests.get",
        return_value=FakeResponse(404),
    )

    client = KnowledgeStoreClient("http://localhost:30025")

    assert client.get_voice_profile() is None


def test_get_voice_profile_fails_open_to_none_on_request_error(mocker):
    mocker.patch(
        "clients.knowledge_store_client.requests.get",
        side_effect=requests.ConnectionError("ECONNREFUSED"),
    )

    client = KnowledgeStoreClient("http://localhost:30025")

    assert client.get_voice_profile() is None


def test_get_voice_profile_fails_open_to_none_on_server_error(mocker):
    mocker.patch(
        "clients.knowledge_store_client.requests.get",
        return_value=FakeResponse(500),
    )

    client = KnowledgeStoreClient("http://localhost:30025")

    assert client.get_voice_profile() is None


def test_update_current_session_sends_patch_with_body(mocker):
    patch_mock = mocker.patch(
        "clients.knowledge_store_client.requests.patch",
        return_value=FakeResponse(200, {"currentSessionId": "session-2"}),
    )

    client = KnowledgeStoreClient("http://localhost:30025")
    client.update_current_session("session-2")

    patch_mock.assert_called_once_with(
        "http://localhost:30025/voice-profile",
        json={"currentSessionId": "session-2"},
    )


def test_update_current_session_raises_on_error(mocker):
    mocker.patch(
        "clients.knowledge_store_client.requests.patch",
        return_value=FakeResponse(500),
    )

    client = KnowledgeStoreClient("http://localhost:30025")

    try:
        client.update_current_session("session-2")
        assert False, "expected raise_for_status to raise"
    except requests.HTTPError:
        pass
