#!/usr/bin/env python3
"""
Hebrew Time Podcast Scraper + Translator
Scrapes all episodes from hebrewtime.squarespace.com and translates them using OpenAI.

Requirements:
    pip install -r pipeline/requirements.txt

Usage:
    python3 pipeline/legacy/scraper.py
"""

from __future__ import annotations

import json
import os
import re
import sys
import time
from pathlib import Path

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv

PIPELINE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PIPELINE_DIR))

from lib.paths import (  # noqa: E402
    DATA_DIR,
    ENV_PATH,
    LEGACY_EPISODES_CHECKPOINT_PATH,
    LEGACY_EPISODES_PATH,
)

load_dotenv(ENV_PATH)

# ── CONFIG ────────────────────────────────────────────────────────────────────
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
BASE_URL = "https://hebrewtime.squarespace.com/episodes/{:02d}"
TOTAL_EPISODES = 50
DELAY_BETWEEN_REQUESTS = 1.5   # seconds — be polite to the server
# ─────────────────────────────────────────────────────────────────────────────


def norm(s: str) -> str:
    # Whitespace-only differences are common across HTML extraction strategies.
    return " ".join((s or "").split()).strip()


def fetch_episode(episode_num: int) -> dict | None:
    """Fetch and parse a single episode page."""
    url = BASE_URL.format(episode_num)
    try:
        resp = requests.get(url, timeout=15, headers={
            "User-Agent": "Mozilla/5.0 (compatible; HebrewTimeScraper/1.0)"
        })
        if resp.status_code == 404:
            print(f"  Episode {episode_num:02d}: 404 — skipping")
            return None
        resp.raise_for_status()
    except requests.RequestException as e:
        print(f"  Episode {episode_num:02d}: fetch error — {e}")
        return None

    soup = BeautifulSoup(resp.text, "html.parser")

    # ── Title ─────────────────────────────────────────────────────────────────
    title_tag = soup.find("h1")
    title = title_tag.get_text(strip=True) if title_tag else f"Episode {episode_num:02d}"

    # Normalize formats like "[20] Title" to "Episode 20: Title"
    match = re.match(r"^\[(\d+)\]\s*(.*)", title)
    if match:
        title = f"Episode {match.group(1)}: {match.group(2)}"

    # ── Main content ──────────────────────────────────────────────────────────
    content_block = (
        soup.find("article")
        or soup.find("main")
        or soup.find("div", class_=re.compile(r"sqs-block-content"))
    )

    if content_block:
        for tag in content_block.find_all(["figure", "figcaption", "nav"]):
            tag.decompose()
        paragraphs = []
        seen_parents = set()

        for p in content_block.find_all("p"):
            text = p.get_text(strip=True)
            if not text:
                continue

            parent = p.parent
            if parent not in seen_parents:
                seen_parents.add(parent)
                first_non_empty_p = next(
                    (cp for cp in parent.find_all("p") if cp.get_text(strip=True)), None
                )
                if p is first_non_empty_p:
                    lead_parts = []
                    for el in parent.descendants:
                        if el is first_non_empty_p:
                            break
                        if getattr(el, "name", None) is None:
                            s = str(el).strip()
                            if s:
                                lead_parts.append(s)
                    lead_text = " ".join(lead_parts).strip()

                    if lead_text and not any(norm(cp.get_text(strip=True)) == norm(lead_text) for cp in parent.find_all("p")):
                        paragraphs.append(lead_text)

            paragraphs.append(text)
    else:
        paragraphs = []

    if not paragraphs:
        print(f"  Episode {episode_num:02d}: no paragraphs found — skipping")
        return None

    hebrew_text = "\n\n".join(paragraphs)
    print(f"  Episode {episode_num:02d}: ✓ scraped ({len(paragraphs)} paragraphs)")

    # ── Audio URL ─────────────────────────────────────────────────────────────
    audio_match = re.search(r"\"(https://[^\"]+\.mp3[^\"]*)\"", resp.text)
    if audio_match:
        audio_url = audio_match.group(1)
    else:
        drive_match = re.search(r"href=\"https://drive\.google\.com/file/d/([^/]+)/view[^\"]*\"", resp.text)
        if drive_match:
            file_id = drive_match.group(1)
            audio_url = f"https://drive.google.com/uc?export=download&id={file_id}"
        else:
            audio_url = None

    return {
        "episode": episode_num,
        "url": url,
        "title": title,
        "audio_url": audio_url,
        "hebrew_paragraphs": paragraphs,
        "hebrew_text": hebrew_text,
        "english_paragraphs": [],
    }


def _paragraph_texts(hebrew_paragraphs: list) -> list[str]:
    texts: list[str] = []
    for item in hebrew_paragraphs:
        if isinstance(item, str):
            texts.append(item)
        elif isinstance(item, dict) and "text" in item:
            texts.append(str(item["text"]))
        else:
            texts.append(str(item))
    return texts


def translate_episode(episode: dict) -> dict:
    """Translate Hebrew paragraphs to all supported languages using OpenAI."""
    from openai import OpenAI

    from lib.translation_utils import build_translations_map, translate_paragraphs

    client = OpenAI(api_key=OPENAI_API_KEY)
    hebrew_texts = _paragraph_texts(episode["hebrew_paragraphs"])

    print(f"  Episode {episode['episode']:02d}: translating to English…")
    english = translate_paragraphs(client, hebrew_texts, "en")
    episode["english_paragraphs"] = english

    print(f"  Episode {episode['episode']:02d}: translating to ru, es, fr…")
    extra = build_translations_map(client, hebrew_texts, english, langs=("ru", "es", "fr"))
    episode["translations"] = extra
    print(f"  Episode {episode['episode']:02d}: ✓ translated (4 languages including English)")
    return episode


def scrape_all() -> list[dict]:
    """Scrape all episodes, with resume support via checkpoint file."""
    checkpoint = LEGACY_EPISODES_CHECKPOINT_PATH
    if checkpoint.exists():
        with checkpoint.open(encoding="utf-8") as f:
            done = {ep["episode"]: ep for ep in json.load(f)}
        print(f"Resuming — {len(done)} episodes already scraped.\n")
    else:
        done = {}

    for n in range(1, TOTAL_EPISODES + 1):
        if n in done:
            continue
        print(f"Fetching episode {n:02d}...")
        ep = fetch_episode(n)
        if ep:
            done[n] = ep
            DATA_DIR.mkdir(parents=True, exist_ok=True)
            with checkpoint.open("w", encoding="utf-8") as f:
                json.dump(list(done.values()), f, ensure_ascii=False, indent=2)
        time.sleep(DELAY_BETWEEN_REQUESTS)

    return sorted(done.values(), key=lambda e: e["episode"])


def translate_all(episodes: list[dict]) -> list[dict]:
    """Translate any episodes missing English translations."""
    checkpoint = LEGACY_EPISODES_CHECKPOINT_PATH
    updated = []
    for ep in episodes:
        if ep.get("english_paragraphs"):
            updated.append(ep)
            continue
        print(f"Translating episode {ep['episode']:02d}...")
        ep = translate_episode(ep)
        updated.append(ep)
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        with checkpoint.open("w", encoding="utf-8") as f:
            json.dump(updated + [e for e in episodes if e not in updated],
                      f, ensure_ascii=False, indent=2)
        time.sleep(0.5)
    return updated


def main():
    print("═" * 55)
    print("  Hebrew Time — Scraper & Translator")
    print("═" * 55)

    if not OPENAI_API_KEY:
        print("\n⚠️  No OPENAI_API_KEY found. Make sure your .env file contains:")
        print("   OPENAI_API_KEY=sk-...\n")

    print("\n[1/2] Scraping episodes…")
    episodes = scrape_all()
    print(f"\n✓ Scraped {len(episodes)} episodes.")

    if OPENAI_API_KEY:
        print("\n[2/2] Translating…")
        episodes = translate_all(episodes)
        print("\n✓ Translation complete.")
    else:
        print("\n[2/2] Skipping translation (no API key set).")

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    print(f"\nSaving {LEGACY_EPISODES_PATH}…")
    with LEGACY_EPISODES_PATH.open("w", encoding="utf-8") as f:
        json.dump(episodes, f, ensure_ascii=False, indent=2)
    print(f"✓ Saved {LEGACY_EPISODES_PATH}")

    print("\n" + "═" * 55)
    print("  Done! Re-run migrate_legacy_episodes.py to push changes to Supabase.")
    print("═" * 55)


if __name__ == "__main__":
    main()
