from tts.text_normalizer import normalize_for_speech


def test_strips_bold_and_italic_markers():
    assert normalize_for_speech("**Nombre:** Felix") == "Nombre: Felix"
    assert normalize_for_speech("es *muy* importante") == "es muy importante"
    assert normalize_for_speech("__hola__ y _chau_") == "hola y chau"


def test_strips_bullet_list_markers_and_joins_lines():
    text = "Tenés esto:\n\n- Nombre: Felix\n- Ciudad: Rosario\n- Mascota: Firulais"
    result = normalize_for_speech(text)
    assert "- " not in result
    assert "Nombre: Felix" in result
    assert "Ciudad: Rosario" in result


def test_strips_headers():
    assert normalize_for_speech("## Resumen\ntexto") == "Resumen. texto"


def test_strips_links_and_inline_code():
    assert normalize_for_speech("mirá [esto](https://example.com)") == "mirá esto"
    assert normalize_for_speech("usá `pnpm dev`") == "usá pnpm dev"


def test_collapses_blank_lines_and_whitespace():
    result = normalize_for_speech("primero\n\n\nsegundo   tercero")
    assert result == "primero. segundo tercero"


def test_real_orchestrator_reply_example():
    text = (
        "¡Todo bien por acá! Acá va lo que tengo anotado sobre vos:\n\n"
        "- **Nombre:** Felix\n"
        "- **Ciudad natal:** Rosario\n\n"
        "¿Querés que ajuste algo?"
    )
    result = normalize_for_speech(text)
    assert "**" not in result
    assert "- " not in result
    assert "Nombre: Felix" in result
    assert "Ciudad natal: Rosario" in result
    assert "¿Querés que ajuste algo?" in result
