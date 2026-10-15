"""The AC2-AC6 orchestration — this channel's `ChannelService` equivalent
(plan.md §4). Split 2026-09-22 into two phases, at Felix's request, for a
more natural voice-assistant UX:

1. `verify_speaker` — runs right after the wake word triggers, against a
   short buffered clip (see `wake_word_listener.py`'s rolling buffer).
   A match speaks a short activation prompt ("¿Sí?") so Felix knows to
   keep talking; a non-match is silently discarded (AC2 — no reply, no
   error sound, same "don't reveal you're listening" posture as before).
2. `handle_command` — runs only after a successful `verify_speaker`,
   against the utterance captured *after* the activation prompt: transcribe
   -> forward to orchestrator with the remembered session -> persist the
   (possibly new) session pointer only if it changed -> speak the reply.

`enrollment_audio_path`/`current_session_id` are constructor-injected
rather than re-read from `knowledge_store_client` on every call: plan.md §4
documents `main.py` reading `VoiceProfile` once at startup and passing
`enrollment_audio_path` "into SpeakerVerifier/ConversationHandler" — the
class shape sketched a few lines above that prose only lists the five
collaborator dependencies, an inconsistency in the plan itself (flagged,
not silently resolved either way) between its own prose and its abbreviated
code snippet. Following the prose is what actually makes AC3's "no profile
-> always no-match, restart needed to pick up a fresh enrollment" behavior
possible at all; a per-call re-read of `enrollmentAudioPath` would silently
contradict that documented limitation.
"""

from __future__ import annotations

import logging

from clients.knowledge_store_client import KnowledgeStoreClient
from clients.orchestrator_client import OrchestratorClient
from stt.transcriber import Transcriber
from tts.speaker import SpeakerLike
from verification.speaker_verifier import SpeakerVerifier

logger = logging.getLogger(__name__)

DEFAULT_ACTIVATION_PROMPT = "¿Sí?"


class ConversationHandler:
    def __init__(
        self,
        speaker_verifier: SpeakerVerifier,
        transcriber: Transcriber,
        orchestrator_client: OrchestratorClient,
        knowledge_store_client: KnowledgeStoreClient,
        speaker: SpeakerLike,
        enrollment_audio_path: str | None,
        current_session_id: str | None = None,
        activation_prompt: str = DEFAULT_ACTIVATION_PROMPT,
    ) -> None:
        self._speaker_verifier = speaker_verifier
        self._transcriber = transcriber
        self._orchestrator_client = orchestrator_client
        self._knowledge_store_client = knowledge_store_client
        self._speaker = speaker
        self._enrollment_audio_path = enrollment_audio_path
        self._current_session_id = current_session_id
        self._activation_prompt = activation_prompt

    def verify_speaker(self, audio_bytes: bytes) -> bool:
        """AC2/AC3 gate. Returns whether `handle_command` should run next —
        `wake_word_listener.py` only captures/forwards the actual command
        when this returns `True`, so a stranger's wake word never even gets
        as far as a follow-up capture window."""
        # These log lines only ever reach Felix's own terminal (this
        # process's stdout) — they don't violate AC2's "no reply, no error
        # sound" rule, which is about not reacting audibly/visibly toward
        # whoever is in the room, not about hiding diagnostics from the
        # person running the daemon. Added 2026-09-22 after Felix had no
        # way to tell whether the daemon was hearing him at all.
        if self._enrollment_audio_path is None:
            logger.warning(
                "Wake word detected, but no voice profile is enrolled yet — "
                "ignoring (AC3). Enroll one at Settings > Voz in the web UI."
            )
            return False

        logger.info("Wake word detected, verifying speaker...")
        is_match = self._speaker_verifier.verify(audio_bytes, self._enrollment_audio_path)
        if not is_match:
            logger.info("Speaker verification failed — ignoring (AC2, not your voice).")
            return False

        logger.info("Speaker verified — prompting for the command...")
        self._speaker.speak(self._activation_prompt)
        return True

    def handle_command(self, audio_bytes: bytes) -> None:
        """Only ever called after `verify_speaker` returned `True` — no
        re-verification here, same single-attempt design as before."""
        logger.info("Transcribing command...")
        text = self._transcriber.transcribe(audio_bytes)
        logger.info("Transcribed: %r", text)

        reply_text, new_session_id = self._orchestrator_client.inquire(text, self._current_session_id)
        logger.info("Orchestrator replied: %r", reply_text)

        if new_session_id and new_session_id != self._current_session_id:
            self._current_session_id = new_session_id
            self._knowledge_store_client.update_current_session(new_session_id)

        self._speaker.speak(reply_text)
