"""Strips Markdown before handing text to Kokoro (AC6) — `orchestrator`'s
replies are written for a chat UI (bold, bullet lists, headers) and Kokoro
reads punctuation/symbols literally, so "**Nombre:**" comes out as
"asterisco asterisco Nombre dos puntos asterisco asterisco" unless this
runs first. Found 2026-09-22, the first time a markdown-heavy reply was
actually spoken out loud.
"""

from __future__ import annotations

import re

_BOLD_ITALIC = re.compile(r"\*\*(.+?)\*\*|__(.+?)__|\*(.+?)\*|_(.+?)_")
_HEADER = re.compile(r"^#{1,6}\s*", re.MULTILINE)
_LINK = re.compile(r"\[([^\]]+)\]\([^)]+\)")
_INLINE_CODE = re.compile(r"`([^`]+)`")
_BULLET = re.compile(r"^\s*[-*]\s+", re.MULTILINE)
_WHITESPACE = re.compile(r"[ \t]+")
_BLANK_LINES = re.compile(r"\n{2,}")


def normalize_for_speech(text: str) -> str:
    text = _LINK.sub(r"\1", text)
    text = _INLINE_CODE.sub(r"\1", text)
    text = _BOLD_ITALIC.sub(lambda m: next(g for g in m.groups() if g is not None), text)
    text = _HEADER.sub("", text)
    text = _BULLET.sub("", text)
    text = _BLANK_LINES.sub(". ", text)
    text = text.replace("\n", ". ")
    text = _WHITESPACE.sub(" ", text)
    return text.strip()
