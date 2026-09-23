from conversation.conversation_handler import ConversationHandler


def make_handler(mocker, *, enrollment_audio_path="C:\\voice-profile\\sample.wav", current_session_id="session-1"):
    speaker_verifier = mocker.Mock()
    transcriber = mocker.Mock()
    orchestrator_client = mocker.Mock()
    knowledge_store_client = mocker.Mock()
    speaker = mocker.Mock()

    handler = ConversationHandler(
        speaker_verifier=speaker_verifier,
        transcriber=transcriber,
        orchestrator_client=orchestrator_client,
        knowledge_store_client=knowledge_store_client,
        speaker=speaker,
        enrollment_audio_path=enrollment_audio_path,
        current_session_id=current_session_id,
    )
    return handler, speaker_verifier, transcriber, orchestrator_client, knowledge_store_client, speaker


def test_ac2_no_match_returns_false_and_speaks_nothing(mocker):
    handler, speaker_verifier, transcriber, orchestrator_client, knowledge_store_client, speaker = make_handler(mocker)
    speaker_verifier.verify.return_value = False

    result = handler.verify_speaker(b"audio-bytes")

    assert result is False
    speaker_verifier.verify.assert_called_once_with(b"audio-bytes", "C:\\voice-profile\\sample.wav")
    speaker.speak.assert_not_called()


def test_ac3_no_enrolled_profile_short_circuits_before_the_verifier(mocker):
    """Amended 2026-09-22: short-circuits before even calling
    `speaker_verifier.verify` (previously called it with `None` and relied
    on the verifier's own `None`-path short-circuit, T6) — added so a
    missing profile can log a distinct, actionable warning instead of a
    silent "verification failed" that looks identical to a real stranger's
    voice being rejected. `SpeakerVerifier.verify`'s own `None`-path
    short-circuit (T6) is now unreachable from here but stays in place —
    it's still exercised directly by `test_speaker_verifier.py`."""
    handler, speaker_verifier, transcriber, orchestrator_client, knowledge_store_client, speaker = make_handler(
        mocker, enrollment_audio_path=None
    )

    result = handler.verify_speaker(b"audio-bytes")

    assert result is False
    speaker_verifier.verify.assert_not_called()
    speaker.speak.assert_not_called()


def test_verify_speaker_speaks_the_activation_prompt_on_a_match(mocker):
    """2026-09-22, at Felix's request: a verified wake word gets an audible
    "¿Sí?" so he knows to keep talking, before any command capture happens
    — `wake_word_listener.py` only starts that capture after this returns
    `True`."""
    handler, speaker_verifier, transcriber, orchestrator_client, knowledge_store_client, speaker = make_handler(mocker)
    speaker_verifier.verify.return_value = True

    result = handler.verify_speaker(b"audio-bytes")

    assert result is True
    speaker.speak.assert_called_once_with("¿Sí?")
    transcriber.transcribe.assert_not_called()
    orchestrator_client.inquire.assert_not_called()


def test_activation_prompt_is_configurable(mocker):
    speaker_verifier = mocker.Mock()
    speaker_verifier.verify.return_value = True
    speaker = mocker.Mock()
    handler = ConversationHandler(
        speaker_verifier=speaker_verifier,
        transcriber=mocker.Mock(),
        orchestrator_client=mocker.Mock(),
        knowledge_store_client=mocker.Mock(),
        speaker=speaker,
        enrollment_audio_path="C:\\voice-profile\\sample.wav",
        activation_prompt="Decime",
    )

    handler.verify_speaker(b"audio-bytes")

    speaker.speak.assert_called_once_with("Decime")


def test_ac4_to_ac6_handle_command_happy_path(mocker):
    handler, speaker_verifier, transcriber, orchestrator_client, knowledge_store_client, speaker = make_handler(
        mocker, current_session_id="session-1"
    )
    transcriber.transcribe.return_value = "que hora es"
    orchestrator_client.inquire.return_value = ("son las 5", "session-1")

    handler.handle_command(b"audio-bytes")

    transcriber.transcribe.assert_called_once_with(b"audio-bytes")
    orchestrator_client.inquire.assert_called_once_with("que hora es", "session-1")
    speaker.speak.assert_called_once_with("son las 5")
    speaker_verifier.verify.assert_not_called()


def test_session_pointer_persists_only_when_it_actually_changed(mocker):
    handler, speaker_verifier, transcriber, orchestrator_client, knowledge_store_client, speaker = make_handler(
        mocker, current_session_id="session-1"
    )
    transcriber.transcribe.return_value = "hola"
    orchestrator_client.inquire.return_value = ("hola de nuevo", "session-1")

    handler.handle_command(b"audio-bytes")

    knowledge_store_client.update_current_session.assert_not_called()


def test_session_pointer_persists_and_updates_when_it_changed(mocker):
    handler, speaker_verifier, transcriber, orchestrator_client, knowledge_store_client, speaker = make_handler(
        mocker, current_session_id="session-1"
    )
    transcriber.transcribe.return_value = "hola"
    orchestrator_client.inquire.return_value = ("hola de nuevo", "session-2")

    handler.handle_command(b"audio-bytes")

    knowledge_store_client.update_current_session.assert_called_once_with("session-2")

    orchestrator_client.inquire.return_value = ("otra vez", "session-2")
    handler.handle_command(b"audio-bytes")

    orchestrator_client.inquire.assert_called_with("hola", "session-2")
    knowledge_store_client.update_current_session.assert_called_once_with("session-2")
