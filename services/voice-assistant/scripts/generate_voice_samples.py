"""One-off maintenance script — NOT part of the running service, no test
coverage (real network calls to ElevenLabs + a real ffmpeg subprocess, same
class of exception this file tree already gives pure I/O adapters like
`tts/mp3_decode.py`).

Fetches every voice on this ElevenLabs account, synthesizes a short Spanish
sample for each, trims it to ~2 seconds (Felix asked for "un audio de
muestra... 2 segundos cada voz" for the Settings > Voz voice picker), and
writes the mp3s + a manifest straight into the frontend's `public/` folder
so the picker can serve them as plain static files — no new backend
endpoint needed for something this static (the catalog only changes when
someone edits voices in the ElevenLabs dashboard).

Run once (or whenever that catalog changes) with:
    ELEVENLABS_API_KEY=... python scripts/generate_voice_samples.py
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from pathlib import Path

import imageio_ffmpeg
import requests

ELEVENLABS_API_BASE = "https://api.elevenlabs.io/v1"
ELEVENLABS_MODEL_ID = "eleven_multilingual_v2"
SAMPLE_DURATION_SECONDS = 2.2
SAMPLE_TEXT = "Hola, soy {name}, tu asistente de voz."

OUTPUT_DIR = Path(__file__).resolve().parents[2] / "frontend" / "public" / "voice-samples"


def display_name(raw_name: str) -> str:
    # ElevenLabs premade voice names are e.g. "Roger - Laid-Back, Casual,
    # Resonant" — only the part before " - " reads as a first name when
    # spoken out loud in the sample text itself.
    return raw_name.split(" - ", 1)[0].strip()


def fetch_voices(api_key: str) -> list[dict]:
    response = requests.get(f"{ELEVENLABS_API_BASE}/voices", headers={"xi-api-key": api_key})
    response.raise_for_status()
    return response.json()["voices"]


def synthesize(api_key: str, voice_id: str, text: str, attempts: int = 3) -> bytes:
    # This account's connection dropped mid-response on one voice out of 30
    # during the first real run (`ChunkedEncodingError`/`IncompleteRead`) —
    # a plain retry-with-backoff, not a real API error, so no reason to
    # abort the whole batch over it.
    last_error: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            response = requests.post(
                f"{ELEVENLABS_API_BASE}/text-to-speech/{voice_id}",
                headers={"xi-api-key": api_key, "Accept": "audio/mpeg", "Content-Type": "application/json"},
                json={"text": text, "model_id": ELEVENLABS_MODEL_ID},
            )
            response.raise_for_status()
            return response.content
        except (requests.exceptions.ChunkedEncodingError, requests.exceptions.ConnectionError) as error:
            last_error = error
            print(f"  attempt {attempt}/{attempts} failed ({error}), retrying...")
            time.sleep(2 * attempt)
    raise last_error


def trim_to_sample_length(mp3_bytes: bytes) -> bytes:
    # A hard cut at exactly 2s often lands mid-word — a short fade-out over
    # the last 0.3s instead of silence makes the trim sound intentional.
    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    result = subprocess.run(
        [
            ffmpeg_exe,
            "-loglevel",
            "error",
            "-i",
            "pipe:0",
            "-t",
            str(SAMPLE_DURATION_SECONDS),
            "-af",
            f"afade=t=out:st={SAMPLE_DURATION_SECONDS - 0.3}:d=0.3",
            "-f",
            "mp3",
            "pipe:1",
        ],
        input=mp3_bytes,
        capture_output=True,
        check=True,
    )
    return result.stdout


def main() -> None:
    api_key = os.environ.get("ELEVENLABS_API_KEY")
    if not api_key:
        print("ELEVENLABS_API_KEY is not set.", file=sys.stderr)
        sys.exit(1)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    voices = fetch_voices(api_key)
    print(f"Found {len(voices)} voices on this account.")

    manifest = []
    for voice in voices:
        voice_id = voice["voice_id"]
        name = display_name(voice["name"])
        labels = voice.get("labels", {})
        sample_path = OUTPUT_DIR / f"{voice_id}.mp3"

        if sample_path.exists():
            # Idempotent re-run — a previous pass already synthesized this
            # one, don't spend ElevenLabs quota (or risk the same connection
            # drop) regenerating it.
            print(f"Skipping {name} ({voice_id}) — sample already exists.")
        else:
            print(f"Synthesizing sample for {name} ({voice_id})...")
            mp3_bytes = synthesize(api_key, voice_id, SAMPLE_TEXT.format(name=name))
            trimmed = trim_to_sample_length(mp3_bytes)
            sample_path.write_bytes(trimmed)

        manifest.append(
            {
                "id": voice_id,
                "name": name,
                "gender": labels.get("gender"),
                "accent": labels.get("accent"),
                "sampleUrl": f"/voice-samples/{voice_id}.mp3",
            }
        )

    manifest_path = OUTPUT_DIR / "voices.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(manifest)} samples + manifest to {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
