"""Minimal Flask app exposing GET /health (AC7) — this daemon's only real
HTTP surface, run in a background thread by main.py so `scripts/dev-all.mjs`
and manual `curl` checks get the same liveness story every other service in
this repo already has.
"""

from __future__ import annotations

from flask import Flask, jsonify

from config import Settings


def create_health_app() -> Flask:
    app = Flask(__name__)

    @app.get("/health")
    def health():
        return jsonify({"status": "ok"})

    return app


def run_health_server(settings: Settings) -> None:
    create_health_app().run(port=settings.port)
