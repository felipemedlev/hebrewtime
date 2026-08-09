#!/usr/bin/env python3
"""One-time migration of episodes.json into Supabase as level=intermediate."""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

import requests
from dotenv import load_dotenv

PIPELINE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(PIPELINE_DIR))

from lib.paths import ENV_PATH, LEGACY_EPISODES_PATH  # noqa: E402

load_dotenv(ENV_PATH)

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
LEVEL = "intermediate"


def headers() -> dict:
    if not SUPABASE_URL or not SERVICE_KEY:
        raise SystemExit("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
    return {
        "Content-Type": "application/json",
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Prefer": "resolution=merge-duplicates",
    }


def ensure_levels() -> None:
    levels = [
        {"slug": "beginner", "name": "Beginner", "cefr": "A1", "sort_order": 0},
        {"slug": "intermediate", "name": "Intermediate", "cefr": "B1", "sort_order": 1},
        {"slug": "intermediate-2", "name": "Intermediate 2", "cefr": "B1", "sort_order": 2},
        {"slug": "advanced", "name": "Advanced", "cefr": "B2", "sort_order": 3},
    ]
    for level in levels:
        res = requests.post(
            f"{SUPABASE_URL}/rest/v1/levels?on_conflict=slug",
            headers=headers(),
            json=level,
            timeout=30,
        )
        if res.status_code not in (200, 201, 409):
            print(f"Warning: levels upsert {level['slug']}: {res.status_code} {res.text}")


def normalize_title(title: str, episode_number: int) -> str:
    import re

    normalized = title
    bracket = re.match(r"^\[(\d+)\]\s*(.*)", normalized)
    if bracket:
        normalized = f"Episode {bracket.group(1)}: {bracket.group(2)}"
    if not re.match(r"^Episode\s", normalized, re.I):
        normalized = f"Episode {episode_number:02d}: {normalized}"
    return normalized


def upsert_episode(ep: dict, dry_run: bool) -> None:
    episode_number = int(ep["episode"])
    row = {
        "level_slug": LEVEL,
        "episode_number": episode_number,
        "title": normalize_title(ep.get("title", ""), episode_number),
        "url": ep.get("url", ""),
        "audio_url": ep.get("audio_url"),
        "hebrew_text": ep.get("hebrew_text", ""),
        "hebrew_paragraphs": ep.get("hebrew_paragraphs", []),
        "english_paragraphs": ep.get("english_paragraphs", []),
        "translations": ep.get("translations")
        or {"en": ep.get("english_paragraphs", [])},
        "is_published": True,
    }

    if dry_run:
        print(f"[dry-run] Would upsert intermediate episode {episode_number}: {row['title'][:60]}")
        return

    res = requests.post(
        f"{SUPABASE_URL}/rest/v1/episodes?on_conflict=level_slug,episode_number",
        headers=headers(),
        json=row,
        timeout=60,
    )
    if res.status_code not in (200, 201):
        print(f"Failed episode {episode_number}: {res.status_code} {res.text}")
        sys.exit(1)
    print(f"Migrated episode {episode_number}: {row['title'][:60]}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Migrate episodes.json to Supabase")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--json-path", default=str(LEGACY_EPISODES_PATH))
    args = parser.parse_args()

    json_path = Path(args.json_path)
    if not json_path.exists():
        raise SystemExit(f"Not found: {json_path}")

    with json_path.open(encoding="utf-8") as f:
        episodes = json.load(f)

    if not args.dry_run:
        ensure_levels()

    episodes.sort(key=lambda e: int(e["episode"]))
    for ep in episodes:
        upsert_episode(ep, args.dry_run)

    print(f"Done. Migrated {len(episodes)} episodes to level={LEVEL}.")


if __name__ == "__main__":
    main()
