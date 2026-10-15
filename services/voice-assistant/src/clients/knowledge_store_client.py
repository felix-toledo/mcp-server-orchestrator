"""HTTP client for knowledge-store's VoiceProfile endpoints (spec §5.3) —
same direct-HTTP, ADR-0002-extended plumbing pattern every other channel's
own client already uses in this repo
(`services/telegram-bot/src/infrastructure/knowledgeStoreClient.ts`),
translated into Python's `requests`.

`get_voice_profile` fails open to `None` on any request error — this is
read once at startup (spec §5.3), and a `knowledge-store` outage at boot
must not crash the daemon: AC3 already treats "no profile" as "every
wake-word event is an unverified match," so a fetch failure degrades to the
exact same safe behavior instead of a new failure mode.
`update_current_session` is a runtime write and raises on failure instead —
the caller decides whether that's fatal for the current turn, same as
`telegram-bot`'s `ChannelService.handleIncomingMessage` leaving its own
session-pointer update uncaught.
"""

from __future__ import annotations

from dataclasses import dataclass

import requests


@dataclass(frozen=True)
class VoiceProfile:
    status: str
    enrollment_audio_path: str | None
    current_session_id: str | None
    trained_at: str | None
    tts_engine: str
    tts_voice_id: str | None


class KnowledgeStoreClient:
    def __init__(self, base_url: str) -> None:
        self._base_url = base_url

    def get_voice_profile(self) -> VoiceProfile | None:
        try:
            response = requests.get(f"{self._base_url}/voice-profile")
        except requests.RequestException:
            return None

        if response.status_code == 404:
            return None
        if not response.ok:
            return None

        body = response.json()
        return VoiceProfile(
            status=body["status"],
            enrollment_audio_path=body.get("enrollmentAudioPath"),
            current_session_id=body.get("currentSessionId"),
            trained_at=body.get("trainedAt"),
            # Defaults match knowledge-store's own VoiceProfile.ttsEngine
            # column default — a row created before this field existed (or
            # a body from an older knowledge-store) still means "free voice."
            tts_engine=body.get("ttsEngine", "KOKORO"),
            tts_voice_id=body.get("ttsVoiceId"),
        )

    def update_current_session(self, session_id: str) -> None:
        response = requests.patch(
            f"{self._base_url}/voice-profile",
            json={"currentSessionId": session_id},
        )
        response.raise_for_status()
