#!/usr/bin/env python3
"""
Efficiently patch existing episodes.json when the scraper was missing the first
transcript paragraph (Squarespace transcript markdown sometimes renders the first
paragraph as leading text nodes before the first <p>).

This script:
1) Loads local `episodes.json`
2) Re-fetches each episode's Hebrew paragraphs using the updated `scraper.fetch_episode`
3) Detects if the only difference is a missing prefix paragraph(s)
4) Translates only the missing paragraph(s) and prepends them to english_paragraphs
5) Updates hebrew_text and writes a new episodes.json (with a backup)

By default it does a dry-run (no OpenAI calls, no file writes).
Use --apply --translate to perform the real updates.
"""

from __future__ import annotations

import argparse
import copy
import json
import os
import shutil
import time
from datetime import datetime, timezone
from typing import Any

from openai import OpenAI
from dotenv import load_dotenv

import scraper


load_dotenv()

MODEL = "gpt-4o-mini"
SYSTEM_PROMPT = (
    "You are a professional Hebrew-to-English translator. "
    "Translate the following Modern Hebrew paragraph naturally and accurately. "
    "Preserve paragraph structure. Output ONLY the English translation."
)


def norm(s: str) -> str:
    # Whitespace-only differences are common across HTML extraction strategies.
    return " ".join(s.split()).strip()


def translate_paragraph(client: OpenAI, hebrew: str) -> str:
    resp = client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": hebrew},
        ],
        temperature=0.2,
    )
    return resp.choices[0].message.content.strip()


def find_prefix_shift(old_paras: list[str], new_paras: list[str], max_shift: int = 3) -> int | None:
    """
    Returns shift i such that new_paras[i:i+len(old)] matches old_paras (under whitespace normalization).
    If multiple i match, the smallest i is returned.
    """
    if not old_paras:
        return 0
    old_norm = [norm(p) for p in old_paras]
    new_norm = [norm(p) for p in new_paras]
    for shift in range(0, min(max_shift, len(new_paras)) + 1):
        if shift + len(old_norm) > len(new_norm):
            continue
        window = new_norm[shift : shift + len(old_norm)]
        if window == old_norm:
            return shift
    return None


def main() -> None:
    parser_cli = argparse.ArgumentParser()
    parser_cli.add_argument("--limit", type=int, default=0, help="Only patch first N episodes in episodes.json")
    parser_cli.add_argument("--dry-run", action="store_true", help="Default behavior (no translations, no writes)")
    parser_cli.add_argument("--translate", action="store_true", help="Actually translate missing paragraphs with OpenAI")
    parser_cli.add_argument("--apply", action="store_true", help="Write updated episodes.json (requires --translate)")
    parser_cli.add_argument("--max-shift", type=int, default=3, help="How many leading paragraphs to consider missing")
    args = parser_cli.parse_args()

    # Default to dry-run if neither translate nor apply is enabled.
    do_translate = bool(args.translate)
    do_apply = bool(args.apply)
    if do_apply and not do_translate:
        raise SystemExit("Refusing to apply without --translate.")

    episodes_path = "episodes.json"
    with open(episodes_path, "r", encoding="utf-8") as f:
        episodes_data: list[dict[str, Any]] = json.load(f)

    old_by_ep: dict[int, dict[str, Any]] = {}
    for ep in episodes_data:
        ep_num = int(ep["episode"])
        old_by_ep[ep_num] = ep

    ep_nums = sorted(old_by_ep.keys())
    if args.limit and args.limit > 0:
        ep_nums = ep_nums[: args.limit]

    # OpenAI client only if we actually translate.
    client: OpenAI | None = None
    if do_translate:
        openai_key = os.environ.get("OPENAI_API_KEY", "")
        if not openai_key:
            raise SystemExit("Missing OPENAI_API_KEY in environment.")
        client = OpenAI(api_key=openai_key)

    changes = []
    total_missing_paras = 0
    start = time.time()

    for ep_num in ep_nums:
        old_ep = old_by_ep[ep_num]
        old_hebrew = old_ep.get("hebrew_paragraphs", []) or []
        old_english = old_ep.get("english_paragraphs", []) or []

        new_ep = scraper.fetch_episode(ep_num)
        if not new_ep:
            continue
        new_hebrew = new_ep.get("hebrew_paragraphs", []) or []

        shift = find_prefix_shift(old_hebrew, new_hebrew, max_shift=args.max_shift)
        if shift is None:
            changes.append(
                {
                    "episode": ep_num,
                    "status": "complex_mismatch",
                    "old_len": len(old_hebrew),
                    "new_len": len(new_hebrew),
                }
            )
            continue

        if shift == 0:
            continue

        missing_hebrew = new_hebrew[:shift]

        # The old english_paragraphs should match the old Hebrew length.
        if len(old_english) != len(old_hebrew):
            changes.append(
                {
                    "episode": ep_num,
                    "status": "length_mismatch",
                    "old_hebrew_len": len(old_hebrew),
                    "old_english_len": len(old_english),
                }
            )
            continue

        if do_translate:
            assert client is not None
            missing_english: list[str] = []
            for p in missing_hebrew:
                if not p.strip():
                    missing_english.append("")
                    continue
                missing_english.append(translate_paragraph(client, p))
                time.sleep(0.15)  # be gentle
        else:
            missing_english = ["<skipped>"] * len(missing_hebrew)

        total_missing_paras += len(missing_hebrew)
        changes.append(
            {
                "episode": ep_num,
                "status": "patched_prefix",
                "missing_count": len(missing_hebrew),
                "missing_preview": (missing_hebrew[0][:60] + "…") if missing_hebrew else "",
                "translate": do_translate,
            }
        )

        if do_apply:
            # Mutate the old episode object in-place.
            old_ep["hebrew_paragraphs"] = new_hebrew
            old_ep["english_paragraphs"] = missing_english + old_english
            old_ep["hebrew_text"] = "\n\n".join(new_hebrew)

    elapsed = time.time() - start
    print(f"Checked {len(ep_nums)} episodes in {elapsed:.1f}s")
    patched = [c for c in changes if c.get("status") == "patched_prefix"]
    complex = [c for c in changes if c.get("status") == "complex_mismatch"]
    length_mismatch = [c for c in changes if c.get("status") == "length_mismatch"]

    print(f"Patched episodes: {len(patched)}")
    print(f"Total missing paragraphs needing translation: {total_missing_paras}")
    print(f"Complex mismatches: {len(complex)}")
    print(f"English/Hebrew length mismatches: {len(length_mismatch)}")

    if do_apply:
        backup_path = (
            f"episodes.json.bak.{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
        )
        print(f"Backing up to: {backup_path}")
        shutil.copy2(episodes_path, backup_path)
        with open(episodes_path, "w", encoding="utf-8") as f:
            json.dump(episodes_data, f, ensure_ascii=False, indent=2)
        print("episodes.json updated.")
    else:
        print("No file writes (dry-run behavior).")


if __name__ == "__main__":
    main()

