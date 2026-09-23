import requests

from clients.orchestrator_client import OrchestratorClient


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


def test_inquire_posts_with_kaa_header_and_returns_reply_and_session(mocker):
    post_mock = mocker.patch(
        "clients.orchestrator_client.requests.post",
        return_value=FakeResponse(
            200,
            {"success": True, "message": {"role": "assistant", "content": "hola"}, "sessionId": "s1"},
        ),
    )

    client = OrchestratorClient("http://localhost:30021", "secret")
    reply_text, session_id = client.inquire("hola", "s0")

    assert reply_text == "hola"
    assert session_id == "s1"
    post_mock.assert_called_once_with(
        "http://localhost:30021/api/inquire",
        headers={"Content-Type": "application/json", "KAA": "secret"},
        json={"messages": [{"role": "user", "content": "hola"}], "sessionId": "s0"},
    )


def test_inquire_omits_session_id_when_none(mocker):
    post_mock = mocker.patch(
        "clients.orchestrator_client.requests.post",
        return_value=FakeResponse(
            200,
            {"success": True, "message": {"role": "assistant", "content": "hola"}, "sessionId": "s1"},
        ),
    )

    client = OrchestratorClient("http://localhost:30021", "secret")
    client.inquire("hola", None)

    post_mock.assert_called_once_with(
        "http://localhost:30021/api/inquire",
        headers={"Content-Type": "application/json", "KAA": "secret"},
        json={"messages": [{"role": "user", "content": "hola"}]},
    )


def test_inquire_handles_missing_session_id_in_response(mocker):
    mocker.patch(
        "clients.orchestrator_client.requests.post",
        return_value=FakeResponse(
            200,
            {"success": True, "message": {"role": "assistant", "content": "hola"}},
        ),
    )

    client = OrchestratorClient("http://localhost:30021", "secret")
    reply_text, session_id = client.inquire("hola", None)

    assert reply_text == "hola"
    assert session_id is None


def test_inquire_raises_on_non_ok(mocker):
    mocker.patch(
        "clients.orchestrator_client.requests.post",
        return_value=FakeResponse(500),
    )

    client = OrchestratorClient("http://localhost:30021", "secret")

    try:
        client.inquire("hola", None)
        assert False, "expected raise_for_status to raise"
    except requests.HTTPError:
        pass
