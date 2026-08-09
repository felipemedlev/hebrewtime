#!/usr/bin/env python3
"""Backfill missing episode translations in Supabase using gpt-5.4-mini."""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

import requests
from dotenv import load_dotenv
from openai import OpenAI

PIPELINE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(PIPELINE_DIR))

from lib.paths import CHECKPOINT_DIR, ENV_PATH  # noqa: E402
from lib.translation_utils import (  # noqa: E402
    TARGET_LANGS,
    normalize_paragraph_texts,
    translate_paragraphs,
)

load_dotenv(ENV_PATH)

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
CHECKPOINT_PATH = CHECKPOINT_DIR / "translation_backfill.json"


def headers() -> dict:
    if not SUPABASE_URL or not SERVICE_KEY:
        raise SystemExit("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
    return {
        "Content-Type": "application/json",
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
    }


def load_checkpoint() -> dict:
    if CHECKPOINT_PATH.exists():
        with CHECKPOINT_PATH.open(encoding="utf-8") as f:
            return json.load(f)
    return {"completed": {}}


def save_checkpoint(data: dict) -> None:
    CHECKPOINT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with CHECKPOINT_PATH.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def fetch_episodes(level: str | None, episode: int | None) -> list[dict]:
    query = "episodes?select=id,level_slug,episode_number,hebrew_paragraphs,english_paragraphs,translations&is_published=eq.true&order=level_slug.asc,episode_number.asc"
    if level:
        query += f"&level_slug=eq.{level}"
    if episode is not None:
        query += f"&episode_number=eq.{episode}"
    res = requests.get(f"{SUPABASE_URL}/rest/v1/{query}", headers=headers(), timeout=60)
    if not res.ok:
        raise SystemExit(f"Fetch failed: {res.status_code} {res.text}")
    return res.json()


def patch_translations(episode_id: str, translations: dict) -> None:
    res = requests.patch(
        f"{SUPABASE_URL}/rest/v1/episodes?id=eq.{episode_id}",
        headers={**headers(), "Prefer": "return=minimal"},
        json={"translations": translations},
        timeout=60,
    )
    if res.status_code not in (200, 204):
        raise RuntimeError(f"PATCH failed: {res.status_code} {res.text}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill episode translations in Supabase")
    parser.add_argument("--dry-run", action="store_true", help="List work only; no OpenAI or DB writes")
    parser.add_argument("--level", help="Limit to one level slug")
    parser.add_argument("--episode", type=int, help="Limit to one episode number")
    parser.add_argument("--lang", choices=["en", *TARGET_LANGS], help="Fill only one language")
    parser.add_argument("--force", action="store_true", help="Regenerate even if language exists")
    args = parser.parse_args()

    if not args.dry_run and not os.environ.get("OPENAI_API_KEY"):
        raise SystemExit("OPENAI_API_KEY required unless --dry-run")

    client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY")) if not args.dry_run else None
    checkpoint = load_checkpoint()
    episodes = fetch_episodes(args.level, args.episode)

    langs_to_fill = [args.lang] if args.lang else ["en", *TARGET_LANGS]
    if "en" in langs_to_fill:
        langs_to_fill = [l for l in langs_to_fill if l != "en"]

    total_jobs = 0
    for ep in episodes:
        level = ep["level_slug"]
        num = ep["episode_number"]
        key = f"{level}:{num:02d}"
        hebrew_texts = normalize_paragraph_texts(ep.get("hebrew_paragraphs") or [])
        english = ep.get("english_paragraphs") or []
        translations = dict(ep.get("translations") or {})
        if not translations.get("en") and english:
            translations["en"] = english

        missing = []
        for lang in langs_to_fill:
            existing = translations.get(lang) or []
            if args.force or len(existing) != len(hebrew_texts):
                missing.append(lang)

        if not missing and not (args.force and "en" not in langs_to_fill):
            continue

        total_jobs += 1
        print(f"\n{level} episode {num}: missing {missing}")

        if args.dry_run:
            continue

        for lang in missing:
            ck = f"{key}:{lang}"
            if not args.force and checkpoint.get("completed", {}).get(ck):
                print(f"  skip {lang} (checkpoint)")
                translations[lang] = translations.get(lang) or []
                continue

            print(f"  translating → {lang} ({len(hebrew_texts)} paragraphs)")
            translations[lang] = translate_paragraphs(client, hebrew_texts, lang)
            if len(translations[lang]) != len(hebrew_texts):
                raise RuntimeError(
                    f"Paragraph count mismatch for {key} {lang}: "
                    f"{len(translations[lang])} vs {len(hebrew_texts)}"
                )
            checkpoint.setdefault("completed", {})[ck] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            save_checkpoint(checkpoint)
            time.sleep(0.2)

        patch_translations(ep["id"], translations)
        print(f"  ✓ updated {key}")

    print(f"\nDone. Processed {total_jobs} episode(s).")


if __name__ == "__main__":
    main()
