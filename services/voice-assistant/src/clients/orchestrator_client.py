"""HTTP client for orchestrator's `POST /api/inquire` — same `KAA`-header
contract every other channel already authenticates with
(`services/telegram-bot/src/infrastructure/orchestratorClient.ts`), reduced
to the plain `inquire(text, session_id) -> (reply_text, new_session_id)`
shape this channel needs (plan.md §4) — no live-status polling, this
channel has no surface to display it on.
"""

from __future__ import annotations

import requests


class OrchestratorClient:
    def __init__(self, base_url: str, kaa_key: str) -> None:
        self._base_url = base_url
        self._kaa_key = kaa_key

    def inquire(self, text: str, session_id: str | None) -> tuple[str, str | None]:
        body: dict[str, object] = {"messages": [{"role": "user", "content": text}]}
        if session_id:
            body["sessionId"] = session_id

        response = requests.post(
            f"{self._base_url}/api/inquire",
            headers={"Content-Type": "application/json", "KAA": self._kaa_key},
            json=body,
        )
        response.raise_for_status()

        payload = response.json()
        reply_text = payload["message"]["content"] or ""
        return reply_text, payload.get("sessionId")
