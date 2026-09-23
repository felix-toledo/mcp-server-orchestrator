from config import Settings


def test_settings_load_reads_every_documented_env_var(monkeypatch):
    monkeypatch.setenv("PORT", "30028")
    monkeypatch.setenv("ORCHESTRATOR_URL", "http://localhost:30021")
    monkeypatch.setenv("KEY_ALLOWED_AGENTS", "secret")
    monkeypatch.setenv("KNOWLEDGE_STORE_URL", "http://localhost:30025")
    monkeypatch.setenv("WAKE_WORD_MODEL", "hey_jarvis")
    monkeypatch.setenv("WAKE_WORD_THRESHOLD", "0.5")
    monkeypatch.setenv("UTTERANCE_DURATION_SECONDS", "5")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
    monkeypatch.setenv("AUDIO_INPUT_DEVICE_NAME", "Realtek")
    monkeypatch.setenv("KOKORO_VOICE", "af_bella")

    settings = Settings.load()

    assert settings.port == 30028
    assert settings.orchestrator_url == "http://localhost:30021"
    assert settings.key_allowed_agents == "secret"
    assert settings.knowledge_store_url == "http://localhost:30025"
    assert settings.wake_word_model == "hey_jarvis"
    assert settings.wake_word_threshold == 0.5
    assert settings.utterance_duration_seconds == 5
    assert settings.openai_api_key == "sk-test"
    assert settings.audio_input_device_name == "Realtek"
    assert settings.kokoro_voice == "af_bella"


def test_settings_audio_input_device_name_defaults_to_none_when_unset(monkeypatch):
    monkeypatch.setenv("ORCHESTRATOR_URL", "http://localhost:30021")
    monkeypatch.setenv("KEY_ALLOWED_AGENTS", "secret")
    monkeypatch.setenv("KNOWLEDGE_STORE_URL", "http://localhost:30025")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
    monkeypatch.delenv("AUDIO_INPUT_DEVICE_NAME", raising=False)

    settings = Settings.load()

    assert settings.audio_input_device_name is None


def test_settings_parses_numeric_env_vars_to_their_real_types(monkeypatch):
    monkeypatch.setenv("PORT", "12345")
    monkeypatch.setenv("ORCHESTRATOR_URL", "http://localhost:30021")
    monkeypatch.setenv("KEY_ALLOWED_AGENTS", "secret")
    monkeypatch.setenv("KNOWLEDGE_STORE_URL", "http://localhost:30025")
    monkeypatch.setenv("WAKE_WORD_THRESHOLD", "0.75")
    monkeypatch.setenv("UTTERANCE_DURATION_SECONDS", "8")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")

    settings = Settings.load()

    assert isinstance(settings.port, int)
    assert settings.port == 12345
    assert isinstance(settings.wake_word_threshold, float)
    assert settings.wake_word_threshold == 0.75
    assert isinstance(settings.utterance_duration_seconds, int)
    assert settings.utterance_duration_seconds == 8


def test_settings_defaults_wake_word_config_when_unset(monkeypatch):
    monkeypatch.setenv("ORCHESTRATOR_URL", "http://localhost:30021")
    monkeypatch.setenv("KEY_ALLOWED_AGENTS", "secret")
    monkeypatch.setenv("KNOWLEDGE_STORE_URL", "http://localhost:30025")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
    monkeypatch.delenv("PORT", raising=False)
    monkeypatch.delenv("WAKE_WORD_MODEL", raising=False)
    monkeypatch.delenv("WAKE_WORD_THRESHOLD", raising=False)
    monkeypatch.delenv("UTTERANCE_DURATION_SECONDS", raising=False)

    settings = Settings.load()

    assert settings.port == 30028
    assert settings.wake_word_model == "hey_jarvis"
    assert settings.wake_word_threshold == 0.5
    assert settings.utterance_duration_seconds == 5
    assert settings.kokoro_voice == "ef_dora"
