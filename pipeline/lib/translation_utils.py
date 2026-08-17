"""Shared Hebrew paragraph translation utilities for pipelines and backfill."""

from __future__ import annotations

import json
import time
from typing import Callable

from openai import OpenAI

TRANSLATION_MODEL = "gpt-5.4-mini"
TARGET_LANGS = ("ru", "uk", "pt", "es", "fr")

LANG_NAMES = {
    "en": "English",
    "ru": "Russian",
    "uk": "Ukrainian",
    "pt": "Portuguese",
    "es": "Spanish",
    "fr": "French",
}


def translation_system_prompt(target_lang: str) -> str:
    lang_name = LANG_NAMES.get(target_lang, target_lang)
    return (
        f"You are a professional Hebrew-to-{lang_name} translator. "
        f"Translate the following Modern Hebrew paragraph naturally and accurately into {lang_name}. "
        "Preserve paragraph structure. Output ONLY the translation."
    )


def translate_paragraph(client: OpenAI, hebrew: str, target_lang: str) -> str:
    if not hebrew.strip():
        return ""
    response = client.chat.completions.create(
        model=TRANSLATION_MODEL,
        messages=[
            {"role": "system", "content": translation_system_prompt(target_lang)},
            {"role": "user", "content": hebrew},
        ],
        temperature=0.2,
    )
    return response.choices[0].message.content.strip()


def translate_paragraphs(
    client: OpenAI,
    hebrew_paragraphs: list[str],
    target_lang: str,
    *,
    on_progress: Callable[[int, int], None] | None = None,
    delay_sec: float = 0.15,
) -> list[str]:
    if not hebrew_paragraphs:
        return []

    lang_name = LANG_NAMES.get(target_lang, target_lang)
    payload = {
        "model": TRANSLATION_MODEL,
        "messages": [
            {
                "role": "system",
                "content": (
                    f"You are a professional Hebrew-to-{lang_name} translator. "
                    f"Translate each Modern Hebrew paragraph naturally into {lang_name}. "
                    "Return JSON {\"paragraphs\": [\"...\"]} with the SAME number of strings, same order. "
                    "Preserve meaning, not word order."
                ),
            },
            {
                "role": "user",
                "content": json.dumps({"paragraphs": hebrew_paragraphs}, ensure_ascii=False),
            },
        ],
        "response_format": {"type": "json_object"},
    }
    try:
        response = client.chat.completions.create(**payload)
        data = json.loads(response.choices[0].message.content.strip())
        translated = data.get("paragraphs") or data.get("translations") or []
        if isinstance(translated, list) and len(translated) == len(hebrew_paragraphs):
            if on_progress:
                on_progress(len(hebrew_paragraphs), len(hebrew_paragraphs))
            return [str(item) for item in translated]
        print(
            f"    Batch {target_lang} translation length mismatch "
            f"({len(translated)} vs {len(hebrew_paragraphs)}); falling back."
        )
    except Exception as exc:
        print(f"    Batch {target_lang} translation failed ({exc}); falling back.")

    translated = []
    total = len(hebrew_paragraphs)
    for i, para in enumerate(hebrew_paragraphs):
        if on_progress:
            on_progress(i + 1, total)
        try:
            translated.append(translate_paragraph(client, para, target_lang))
        except Exception as exc:
            print(f"    Translation error ({target_lang}, para {i}): {exc}")
            translated.append("[translation error]")
        if delay_sec > 0:
            time.sleep(delay_sec)
    return translated


def build_translations_map(
    client: OpenAI,
    hebrew_paragraphs: list[str],
    english_paragraphs: list[str],
    *,
    langs: tuple[str, ...] = TARGET_LANGS,
    on_lang: Callable[[str], None] | None = None,
) -> dict[str, list[str]]:
    """Build translations map with English plus requested target languages."""
    result: dict[str, list[str]] = {"en": list(english_paragraphs)}
    for lang in langs:
        if on_lang:
            on_lang(lang)
        result[lang] = translate_paragraphs(client, hebrew_paragraphs, lang)
    return result


def normalize_paragraph_texts(hebrew_paragraphs: list) -> list[str]:
    texts: list[str] = []
    for item in hebrew_paragraphs:
        if isinstance(item, str):
            texts.append(item)
        elif isinstance(item, dict) and "text" in item:
            texts.append(str(item["text"]))
        else:
            texts.append(str(item))
    return texts
