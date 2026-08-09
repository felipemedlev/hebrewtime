#!/usr/bin/env python3
"""Sync episode timestamps using Whisper alignment (uses pipeline/lib/alignment.py)."""

import argparse
import json
import os
import sys
import tempfile
from pathlib import Path

import requests
from dotenv import load_dotenv
from openai import OpenAI

PIPELINE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(PIPELINE_DIR))

from lib.alignment import align_episode  # noqa: E402
from lib.paths import ENV_PATH, LEGACY_EPISODES_PATH  # noqa: E402

load_dotenv(ENV_PATH)

client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))


def load_episode_from_json(level: str, episode_number: int) -> dict | None:
    json_path = LEGACY_EPISODES_PATH
    if not json_path.exists():
        return None
    with json_path.open(encoding="utf-8") as f:
        episodes = json.load(f)
    if level == "intermediate":
        return next((ep for ep in episodes if ep.get("episode") == episode_number), None)
    return None


def main() -> None:
    parser = argparse.ArgumentParser(description="Whisper timestamp sync for an episode")
    parser.add_argument("--level", default="intermediate")
    parser.add_argument("--episode", type=int, default=1)
    parser.add_argument("--json-path", default=str(LEGACY_EPISODES_PATH))
    args = parser.parse_args()

    with open(args.json_path, encoding="utf-8") as f:
        episodes = json.load(f)

    ep = next((e for e in episodes if e.get("episode") == args.episode), None)
    if not ep:
        print(f"Episode {args.episode} not found!")
        return

    audio_url = ep.get("audio_url")
    if not audio_url:
        print("No audio_url on episode")
        return

    print(f"Downloading audio from {audio_url}...")
    resp = requests.get(audio_url, timeout=120)
    resp.raise_for_status()

    original_paras = [
        p if isinstance(p, str) else p.get("text", "")
        for p in ep.get("hebrew_paragraphs", [])
    ]

    with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
        tmp.write(resp.content)
        audio_path = tmp.name

    try:
        print("Transcribing and aligning with Whisper...")
        new_paras = align_episode(original_paras, audio_path, client)
        ep["hebrew_paragraphs"] = new_paras

        print(f"Saving updated {args.json_path}...")
        with open(args.json_path, "w", encoding="utf-8") as f:
            json.dump(episodes, f, ensure_ascii=False, indent=2)
        print(f"Done! Episode {args.episode} synchronized.")
    finally:
        os.remove(audio_path)


if __name__ == "__main__":
    main()
