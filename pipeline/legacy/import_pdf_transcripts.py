#!/usr/bin/env python3
"""Import full Intermediate transcripts from PDFs (episodes 41–115).

Replaces truncated Patreon teasers in episodes.json, generates English
translations, and optionally scrapes audio URLs for new episodes.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import time
import unicodedata
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path

import logging
import pdfplumber
from dotenv import load_dotenv

logging.getLogger("pdfminer").setLevel(logging.ERROR)

PIPELINE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PIPELINE_DIR))

from lib.paths import CHECKPOINT_DIR, DATA_DIR, ENV_PATH, LEGACY_EPISODES_PATH  # noqa: E402
from lib.translation_utils import translate_paragraphs  # noqa: E402
from legacy.scraper import fetch_episode  # noqa: E402

load_dotenv(ENV_PATH)

PDF_DIR = DATA_DIR / "Transcripts_Intermediate"
CHECKPOINT_PREFIX = "pdf_transcript_import"
EPISODE_MIN = 41
EPISODE_MAX = 115
TTS_EPISODE_MIN = 41
TTS_EPISODE_MAX = 50
HEBREW_RE = re.compile(r"[\u0590-\u05FF]")
LINE_Y_TOLERANCE = 3.5
WORD_GAP_FACTOR = 0.45
MIN_HEBREW_CHARS = 400
LEGACY_TTS_CONFIG = {
    "language_code": "he-IL",
    "model_name": "gemini-3.1-flash-tts-preview",
    "voice_name": "Achernar",
    "prompt": (
        "Read aloud in a warm, natural podcast tone. Speak clearly at an "
        "intermediate learner pace: not too slow, with natural rhythm and emotion. "
        "Sound like you are talking to a friend, not reading a book."
    ),
    "speaking_rate": 1.0,
    "pitch": 0,
    "sentence_gap_ms": 180,
    "paragraph_gap_ms": 550,
}
CTA_RE = re.compile(
    r"patreon|ko[- ]?fi|kofi|partreon|"
    r"המשך\s*(?:הטרנסקריפט|התמליל)|"
    r"(?:הטרנסקריפט|התמליל)\s*(?:המלא|של)|"
    r"(?:לעשות|יעשה|תעשו|עשה|עשו|עשתה)\s+מנוי|מחיר\s+המנוי|"
    r"לקבל\s+את\s+(?:הטרנסקריפט|התמליל)|"
    r"(?:לתמוך|תמוך|תמכו|תמך)\s+בפודקאסט|לקנות\s+לי\s+קפה|"
    r"to get access to the full transcript|"
    r"чтобы получить доступ",
    re.I,
)
HEADER_RE = re.compile(
    r"^[\W\d]*("
    r"זמן עברית|hebrew time|episode\s*\d+|פרק\s*\d+"
    r")[\W\d]*$",
    re.I,
)


@dataclass(frozen=True)
class TextLine:
    """A reconstructed Hebrew line and the source line used for filtering."""

    text: str
    raw_text: str
    top: float
    bottom: float
    page_number: int


def has_hebrew(text: str) -> bool:
    return bool(HEBREW_RE.search(text or ""))


def hebrew_ratio(text: str) -> float:
    letters = [ch for ch in text if ch.isalpha() or "\u0590" <= ch <= "\u05FF"]
    if not letters:
        return 0.0
    heb = sum(1 for ch in letters if "\u0590" <= ch <= "\u05FF")
    return heb / len(letters)


def strip_isolates(text: str) -> str:
    return "".join(ch for ch in text if unicodedata.category(ch) not in {"Cf", "Cc"})


def parse_pdf_role(path: Path) -> tuple[int | None, str]:
    """Return (episode_number, role) where role is transcript, part2, or skip."""
    name = strip_isolates(path.name)
    if "מילים שימושיות" in name:
        return None, "skip"
    if "50.2" in name:
        return 50, "part2"
    if re.search(r"\[1[._]50\]", name):
        return 50, "part1"

    nums = re.findall(r"\[(?:\u200e|\u200f)?(\d{2,3})(?:\.\d+)?\]", name)
    if not nums:
        nums = re.findall(r"\[(\d{2,3})\]", name)
    for raw in nums:
        n = int(raw.split(".")[0])
        if EPISODE_MIN <= n <= EPISODE_MAX:
            return n, "transcript"
    return None, "skip"


def title_from_filename(path: Path, episode_number: int) -> str:
    name = strip_isolates(path.stem)
    name = re.sub(r"\[[^\]]*\]", " ", name)
    name = re.sub(r"\s*\(\d+\)\s*$", "", name)
    name = re.sub(r"\s+", " ", name).strip(" -–—")
    if not name:
        name = f"Episode {episode_number:02d}"
    if not re.match(r"^Episode\s", name, re.I):
        name = f"Episode {episode_number:02d}: {name}"
    return name


def is_cta_or_junk(text: str) -> bool:
    compact = re.sub(r"\s+", "", text)
    if CTA_RE.search(text) or CTA_RE.search(compact):
        return True
    if HEADER_RE.match(text.strip()):
        return True
    if text.strip() in {"*", "•", "-", "—"}:
        return True
    return False


def _cluster_lines(words: list[dict]) -> list[list[dict]]:
    if not words:
        return []
    ordered = sorted(words, key=lambda w: (w["top"], w["x0"]))
    lines: list[list[dict]] = []
    current: list[dict] = []
    current_top: float | None = None
    for word in ordered:
        top = word["top"]
        if current_top is None or abs(top - current_top) <= LINE_Y_TOLERANCE:
            current.append(word)
            current_top = sum(w["top"] for w in current) / len(current)
        else:
            lines.append(current)
            current = [word]
            current_top = top
    if current:
        lines.append(current)
    return lines


def _join_visual_tokens(line: list[dict]) -> str:
    tokens = sorted(line, key=lambda w: w["x0"])
    if not tokens:
        return ""
    widths = [max(t["x1"] - t["x0"], 1.0) for t in tokens]
    avg_width = sum(widths) / len(widths)
    gap_limit = max(avg_width * WORD_GAP_FACTOR, 2.5)
    parts = [tokens[0]["text"]]
    for prev, cur in zip(tokens, tokens[1:]):
        gap = cur["x0"] - prev["x1"]
        if gap > gap_limit:
            parts.append(" ")
        parts.append(cur["text"])
    return "".join(parts)


def _fix_hebrew_token(text: str) -> str:
    """Convert one Canva visual token to logical order.

    Canva's PDF text layer stores Hebrew glyphs and the visual token order
    backwards. Reversing individual code points corrupts mixed tokens such as
    ``19-ה`` and ``1,000-ו`` because digit runs are already in logical order.
    Reverse the runs instead, and reverse only Hebrew runs internally.
    """

    if not text:
        return text

    if not has_hebrew(text):
        # Numeric tokens are often emitted with a punctuation mark on the
        # visual (left) side. Move that punctuation after the number while
        # preserving decimal/thousands separators and percent signs.
        match = re.fullmatch(r"([^\w\d]*)(\d+(?:[,.]\d+)*)([%!?;:]*)", text)
        if match:
            lead, number, trail = match.groups()
            return f"{number}{trail}{lead}"
        return text

    runs = re.findall(
        r"[\u0590-\u05FF]+|[A-Za-z]+|\d+(?:[,.]\d+)*|[^\u0590-\u05FFA-Za-z\d]+",
        text,
    )
    if not runs:
        return text
    logical_runs = [run[::-1] if has_hebrew(run) else run for run in reversed(runs)]
    return "".join(logical_runs)


def _logical_hebrew_line(line: list[dict]) -> str:
    tokens = sorted(line, key=lambda w: w["x0"])
    if not tokens:
        return ""
    # Canva groups glyphs left-to-right, so each Hebrew word is reversed and
    # the visual word order is also reversed. Pure English/Russian columns are
    # removed before this function is called.
    rtl = " ".join(_fix_hebrew_token(t["text"]) for t in reversed(tokens))
    rtl = re.sub(r"\s+", " ", rtl).strip()
    # Match the punctuation convention used by the existing legacy entries.
    return re.sub(r'([.!?])(["״])', r"\2\1", rtl)


def _select_hebrew_words(words: list[dict], page_width: float) -> list[dict]:
    del page_width  # Selection is line-local; page-level columns lose Hebrew.
    selected: list[dict] = []
    for word in words:
        text = (word.get("text") or "").strip()
        if not text:
            continue
        # Selecting per line naturally drops English/Russian translation
        # columns while retaining Hebrew text that spans the full page. Keep
        # numeric runs because they are part of the spoken transcript.
        if has_hebrew(text) or re.search(r"\d", text):
            selected.append(word)
    return selected


def _paragraph_gap_limit(gaps: list[float]) -> float:
    positive_gaps = sorted(gap for gap in gaps if gap >= 0)
    if not positive_gaps:
        return 4.0
    baseline_gap = positive_gaps[max(0, int(len(positive_gaps) * 0.25) - 1)]
    # Canva exports use a consistent line gap, but the actual gap differs by
    # template. Paragraph gaps are generally at least 1.6x the line gap.
    return max(baseline_gap * 1.6, baseline_gap + 3.0, 4.0)


def _lines_to_paragraphs(lines: list[tuple[float, float, str]]) -> list[str]:
    if not lines:
        return []
    gaps = [lines[i][0] - (lines[i - 1][0] + lines[i - 1][1]) for i in range(1, len(lines))]
    gap_limit = _paragraph_gap_limit(gaps)
    paragraphs: list[str] = []
    buf: list[str] = []
    prev_bottom: float | None = None
    for top, height, text in lines:
        if not text:
            continue
        if prev_bottom is not None and (top - prev_bottom) > gap_limit and buf:
            paragraphs.append(" ".join(buf))
            buf = []
        buf.append(text)
        prev_bottom = top + height
    if buf:
        paragraphs.append(" ".join(buf))
    return paragraphs


def _group_line_records(lines: list[TextLine]) -> list[tuple[str, str]]:
    """Group one page of reconstructed lines into (text, source) paragraphs."""

    if not lines:
        return []
    paragraphs: list[tuple[str, str]] = []
    start = 0
    gaps = [lines[i].top - lines[i - 1].bottom for i in range(1, len(lines))]
    gap_limit = _paragraph_gap_limit(gaps)
    for index, line in enumerate(lines):
        if index > start and (line.top - lines[index - 1].bottom) > gap_limit:
            text = " ".join(item.text for item in lines[start:index]).strip()
            raw = " ".join(item.raw_text for item in lines[start:index]).strip()
            if text:
                paragraphs.append((text, raw))
            start = index
    text = " ".join(item.text for item in lines[start:]).strip()
    raw = " ".join(item.raw_text for item in lines[start:]).strip()
    if text:
        paragraphs.append((text, raw))
    return paragraphs


def _extract_page_lines(page, page_number: int) -> list[TextLine]:
    words = page.extract_words(use_text_flow=False, keep_blank_chars=False) or []
    if not words:
        # Keep a text-layer fallback for unusual exports where word extraction
        # is empty even though `extract_text` can recover the page.
        fallback: list[TextLine] = []
        for index, raw_line in enumerate((page.extract_text() or "").splitlines()):
            raw_line = re.sub(r"\s+", " ", raw_line).strip()
            if not raw_line:
                continue
            tokens = [
                {"text": token, "x0": token_index, "x1": token_index + len(token)}
                for token_index, token in enumerate(raw_line.split())
                if has_hebrew(token) or re.search(r"\d", token)
            ]
            if not tokens:
                continue
            text = _logical_hebrew_line(tokens)
            if text and hebrew_ratio(text) >= 0.5:
                fallback.append(TextLine(text, raw_line, index * 20.0, index * 20.0 + 14.0, page_number))
        return fallback

    result: list[TextLine] = []
    for group in _cluster_lines(words):
        raw_text = _join_visual_tokens(group)
        selected = _select_hebrew_words(group, page.width or 0)
        if not selected:
            continue
        text = re.sub(r"\s+", " ", _logical_hebrew_line(selected)).strip()
        if not text or hebrew_ratio(text) < 0.5:
            continue
        top = min(word["top"] for word in group)
        bottom = max(word["bottom"] for word in group)
        result.append(TextLine(text, raw_text, top, bottom, page_number))
    return result


def extract_hebrew_paragraphs(pdf_path: Path) -> list[str]:
    page_lines: list[list[TextLine]] = []
    with pdfplumber.open(pdf_path) as pdf:
        for page_number, page in enumerate(pdf.pages, 1):
            lines = _extract_page_lines(page, page_number)
            if lines:
                page_lines.append(lines)

    all_lines = [line for lines in page_lines for line in lines]
    first_greeting = next(
        (index for index, line in enumerate(all_lines) if re.search(r"שלום\s+לכולם|שלום\s+לכולן", line.text)),
        None,
    )
    if first_greeting is not None:
        all_lines = all_lines[first_greeting:]

    # Re-split by page after trimming the cover so page coordinate resets never
    # get mistaken for a paragraph gap.
    by_page: dict[int, list[TextLine]] = defaultdict(list)
    for line in all_lines:
        by_page[line.page_number].append(line)

    collected: list[str] = []
    for lines in by_page.values():
        for para, raw in _group_line_records(lines):
            para = strip_isolates(re.sub(r"\s+", " ", para)).strip()
            raw = strip_isolates(re.sub(r"\s+", " ", raw)).strip()
            if not para or is_cta_or_junk(f"{para} {raw}"):
                continue
            if HEADER_RE.match(para):
                continue
            if hebrew_ratio(para) < 0.55:
                continue
            if len(HEBREW_RE.findall(para)) < 8:
                continue
            collected.append(para)

    cleaned: list[str] = []
    for para in collected:
        para = strip_isolates(re.sub(r"\s+", " ", para)).strip()
        if not para or is_cta_or_junk(para):
            continue
        if hebrew_ratio(para) < 0.55:
            continue
        if len(HEBREW_RE.findall(para)) < 8:
            continue
        if para:
            cleaned.append(para)
    return split_long_paragraphs(cleaned)


def split_long_paragraphs(paragraphs: list[str], limit: int = 900) -> list[str]:
    out: list[str] = []
    for para in paragraphs:
        if len(para) <= limit:
            out.append(para)
            continue
        parts = re.split(r"(?<=[.!?…])\s+", para)
        buf: list[str] = []
        for part in parts:
            candidate = " ".join(buf + [part]).strip()
            if buf and len(candidate) > limit:
                out.append(" ".join(buf).strip())
                buf = [part]
            else:
                buf.append(part)
        if buf:
            remainder = " ".join(buf).strip()
            while len(remainder) > limit:
                cut = remainder.rfind(" ", 0, limit + 1)
                if cut <= 0:
                    cut = limit
                out.append(remainder[:cut].strip())
                remainder = remainder[cut:].strip()
            if remainder:
                out.append(remainder)
    return [p for p in out if p]


def validate_paragraphs(episode_number: int, paragraphs: list[str]) -> None:
    if not paragraphs:
        raise SystemExit(f"Episode {episode_number}: no paragraphs extracted.")
    joined = " ".join(paragraphs)
    heb_chars = len(HEBREW_RE.findall(joined))
    if heb_chars < MIN_HEBREW_CHARS:
        raise SystemExit(
            f"Episode {episode_number}: too little Hebrew ({heb_chars} letters, "
            f"{len(paragraphs)} paragraphs)."
        )
    avg_len = sum(len(p) for p in paragraphs) / len(paragraphs)
    short_paragraphs = sum(len(p) < 12 for p in paragraphs)
    if len(paragraphs) > 80 and (avg_len < 12 or short_paragraphs / len(paragraphs) > 0.5):
        raise SystemExit(
            f"Episode {episode_number}: extraction looks like per-letter garbage "
            f"({len(paragraphs)} paragraphs, avg len {avg_len:.1f}, "
            f"{short_paragraphs} short)."
        )


def index_pdfs(pdf_dir: Path) -> dict[int, dict[str, list[Path]]]:
    grouped: dict[int, dict[str, list[Path]]] = defaultdict(lambda: defaultdict(list))
    for path in sorted(pdf_dir.glob("*.pdf")):
        number, role = parse_pdf_role(path)
        if number is None or role == "skip":
            print(f"  skip {path.name}")
            continue
        print(f"  {path.name} -> episode {number} ({role})")
        grouped[number][role].append(path)
    return grouped


def paragraphs_for_episode(number: int, files: dict[str, list[Path]]) -> tuple[list[str], Path]:
    if number == 50:
        part1 = files.get("part1") or files.get("transcript")
        part2 = files.get("part2")
        if not part1:
            raise SystemExit("Episode 50: missing part 1 PDF")
        if not part2:
            raise SystemExit("Episode 50: missing part 2 PDF")
        primary = part1[0]
        paras = extract_hebrew_paragraphs(primary)
        paras.extend(extract_hebrew_paragraphs(part2[0]))
        return paras, primary

    paths = files.get("transcript") or files.get("part1") or []
    if not paths:
        raise SystemExit(f"Episode {number}: no transcript PDF")
    primary = paths[0]
    return extract_hebrew_paragraphs(primary), primary


def fetch_audio_url(episode_num: int) -> tuple[str, str | None]:
    """Use the legacy scraper's tested HTML/audio extraction for new episodes."""

    url = f"https://hebrewtime.squarespace.com/episodes/{episode_num:02d}"
    try:
        episode = fetch_episode(episode_num)
    except Exception as exc:  # Best effort: transcript import must continue.
        print(f"  Episode {episode_num:02d}: audio fetch error — {exc}")
        return url, None
    if not episode:
        return url, None
    return episode.get("url") or url, episode.get("audio_url")


def episode_checkpoint_path(episode_number: int) -> Path:
    return CHECKPOINT_DIR / f"{CHECKPOINT_PREFIX}_{episode_number:03d}.json"


def load_episode_checkpoint(episode_number: int) -> dict:
    path = episode_checkpoint_path(episode_number)
    if not path.exists():
        return {}
    try:
        with path.open(encoding="utf-8") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError) as exc:
        print(f"  Episode {episode_number:03d}: ignoring invalid checkpoint ({exc})")
        return {}


def save_episode_checkpoint(episode_number: int, data: dict) -> None:
    CHECKPOINT_DIR.mkdir(parents=True, exist_ok=True)
    path = episode_checkpoint_path(episode_number)
    temp_path = path.with_suffix(path.suffix + ".tmp")
    with temp_path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    temp_path.replace(path)


def update_episode_checkpoint(episode_number: int, data: dict) -> dict:
    """Merge checkpoint fields so translation and audio can resume independently."""

    checkpoint = load_episode_checkpoint(episode_number)
    checkpoint.update(data)
    save_episode_checkpoint(episode_number, checkpoint)
    return checkpoint


def write_json(path: Path, data: list[dict]) -> None:
    """Write the merged episode file atomically after each completed episode."""

    path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = path.with_suffix(path.suffix + ".tmp")
    with temp_path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    temp_path.replace(path)


def validate_tts_range(
    tts_from: int | None,
    tts_to: int | None,
    import_from: int,
    import_to: int,
) -> tuple[int, int] | None:
    """Validate the bounded 41–50 TTS range for the current import."""

    if (tts_from is None) != (tts_to is None):
        raise SystemExit("--tts-from-episode and --tts-to-episode must be provided together")
    if tts_from is None or tts_to is None:
        return None
    if tts_from > tts_to:
        raise SystemExit("--tts-from-episode must not be greater than --tts-to-episode")
    if tts_from < TTS_EPISODE_MIN or tts_to > TTS_EPISODE_MAX:
        raise SystemExit(
            f"TTS range must stay within episodes {TTS_EPISODE_MIN}–{TTS_EPISODE_MAX}"
        )
    if tts_from < import_from or tts_to > import_to:
        raise SystemExit("TTS range must fall within the selected import range")
    return tts_from, tts_to


def tts_checkpoint_fingerprint(hebrew_paragraphs: list[str]) -> str:
    payload = {
        "hebrew_paragraphs": hebrew_paragraphs,
        "tts": LEGACY_TTS_CONFIG,
    }
    encoded = json.dumps(payload, ensure_ascii=False, sort_keys=True).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def checkpoint_audio_path(episode_number: int) -> Path:
    CHECKPOINT_DIR.mkdir(parents=True, exist_ok=True)
    return CHECKPOINT_DIR / f"{CHECKPOINT_PREFIX}_{episode_number:03d}.mp3"


def timed_paragraphs_are_valid(
    timed_paragraphs: object,
    hebrew_paragraphs: list[str],
) -> bool:
    """Ensure cached direct-TTS timings still match the source paragraphs."""

    if not isinstance(timed_paragraphs, list) or len(timed_paragraphs) != len(hebrew_paragraphs):
        return False

    previous_end = 0.0
    for timed, source in zip(timed_paragraphs, hebrew_paragraphs):
        if not isinstance(timed, dict) or timed.get("text") != source:
            return False
        start = timed.get("start")
        end = timed.get("end")
        if not isinstance(start, (int, float)) or not isinstance(end, (int, float)):
            return False
        if start < previous_end or end <= start:
            return False
        sentences = timed.get("sentences", [])
        if not isinstance(sentences, list) or not sentences:
            return False
        sentence_end = start
        for sentence in sentences:
            if not isinstance(sentence, dict):
                return False
            sentence_start = sentence.get("start")
            sentence_finish = sentence.get("end")
            if (
                not isinstance(sentence_start, (int, float))
                or not isinstance(sentence_finish, (int, float))
                or sentence_start < sentence_end
                or sentence_finish <= sentence_start
                or sentence_finish > end
            ):
                return False
            sentence_end = sentence_finish
        previous_end = end
    return True


def synthesize_tts_episode(
    episode_number: int,
    hebrew_paragraphs: list[str],
) -> tuple[Path, list[dict], float]:
    """Synthesize one imported transcript and checkpoint its exact timings."""

    checkpoint = load_episode_checkpoint(episode_number)
    fingerprint = tts_checkpoint_fingerprint(hebrew_paragraphs)
    audio_path = checkpoint_audio_path(episode_number)
    aligned = checkpoint.get("aligned_paragraphs")
    if (
        checkpoint.get("tts_fingerprint") == fingerprint
        and audio_path.exists()
        and timed_paragraphs_are_valid(aligned, hebrew_paragraphs)
    ):
        duration = checkpoint.get("audio_duration_sec")
        if isinstance(duration, (int, float)) and duration > 0:
            print(f"  Episode {episode_number:03d}: using cached Google TTS audio")
            return audio_path, aligned, float(duration)

    from generate_episodes import synthesize_episode

    print(
        f"  Episode {episode_number:03d}: synthesizing Google TTS "
        f"({len(hebrew_paragraphs)} paragraphs)…",
        flush=True,
    )
    duration, aligned = synthesize_episode(
        hebrew_paragraphs,
        LEGACY_TTS_CONFIG,
        audio_path,
    )
    if not timed_paragraphs_are_valid(aligned, hebrew_paragraphs):
        raise SystemExit(f"Episode {episode_number}: generated TTS timings are invalid")
    update_episode_checkpoint(
        episode_number,
        {
            "episode": episode_number,
            "hebrew_paragraphs": hebrew_paragraphs,
            "tts_fingerprint": fingerprint,
            "audio_ready": True,
            "audio_duration_sec": round(duration, 2),
            "aligned_paragraphs": aligned,
            "alignment_method": "direct_sentence_tts",
        },
    )
    return audio_path, aligned, duration


def translate_episode(episode_number: int, hebrew: list[str]) -> list[str]:
    checkpoint = load_episode_checkpoint(episode_number)
    if checkpoint.get("hebrew_paragraphs") != hebrew:
        # Source changes invalidate the translation and any generated audio,
        # while a retry for the same source preserves a completed TTS result.
        checkpoint = {
            "episode": episode_number,
            "hebrew_paragraphs": hebrew,
        }
        save_episode_checkpoint(episode_number, checkpoint)
    if (
        checkpoint.get("hebrew_paragraphs") == hebrew
        and isinstance(checkpoint.get("english_paragraphs"), list)
        and len(checkpoint["english_paragraphs"]) == len(hebrew)
        and all(item and item != "[translation error]" for item in checkpoint["english_paragraphs"])
    ):
        print(f"  Episode {episode_number:03d}: English from checkpoint")
        return list(checkpoint["english_paragraphs"])

    api_key = os.environ.get("OPENAI_API_KEY", "")
    if not api_key:
        raise SystemExit("Missing OPENAI_API_KEY")
    from openai import OpenAI

    client = OpenAI(api_key=api_key)
    print(f"  Episode {episode_number:03d}: translating {len(hebrew)} paragraphs to English…")
    update_episode_checkpoint(
        episode_number,
        {"episode": episode_number, "hebrew_paragraphs": hebrew, "english_paragraphs": []},
    )
    english = translate_paragraphs(client, hebrew, "en")
    if len(english) != len(hebrew) or any(not item or item == "[translation error]" for item in english):
        update_episode_checkpoint(
            episode_number,
            {"episode": episode_number, "hebrew_paragraphs": hebrew, "english_paragraphs": english},
        )
        raise SystemExit(f"Episode {episode_number}: translation failed; rerun to resume")
    update_episode_checkpoint(
        episode_number,
        {"episode": episode_number, "hebrew_paragraphs": hebrew, "english_paragraphs": english},
    )
    time.sleep(0.2)
    return english


def merge_episodes(
    existing: list[dict],
    imported: dict[int, dict],
) -> list[dict]:
    by_num = {int(ep["episode"]): ep for ep in existing}
    for number, payload in imported.items():
        prev = by_num.get(number, {})
        preserve_legacy_location = number < 51
        row = {
            "episode": number,
            "url": (prev.get("url") or payload["url"]) if preserve_legacy_location else payload["url"],
            "title": payload["title"],
            "hebrew_paragraphs": payload["hebrew_paragraphs"],
            "hebrew_text": payload["hebrew_text"],
            "english_paragraphs": payload["english_paragraphs"],
            "translations": {"en": payload["english_paragraphs"]},
            "audio_url": payload.get("audio_url") or prev.get("audio_url"),
        }
        by_num[number] = row
    return [by_num[n] for n in sorted(by_num)]


def main() -> None:
    parser = argparse.ArgumentParser(description="Import Intermediate PDF transcripts 41–115")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--pdf-dir", default=str(PDF_DIR))
    parser.add_argument("--json-path", default=str(LEGACY_EPISODES_PATH))
    parser.add_argument("--from-episode", type=int, default=EPISODE_MIN)
    parser.add_argument("--to-episode", type=int, default=EPISODE_MAX)
    parser.add_argument("--skip-audio", action="store_true")
    parser.add_argument("--skip-translate", action="store_true")
    parser.add_argument(
        "--tts-from-episode",
        type=int,
        default=None,
        help="Generate Google TTS starting at this episode (supported range: 41–50).",
    )
    parser.add_argument(
        "--tts-to-episode",
        type=int,
        default=None,
        help="Generate Google TTS through this episode (supported range: 41–50).",
    )
    args = parser.parse_args()

    if not (EPISODE_MIN <= args.from_episode <= EPISODE_MAX):
        raise SystemExit(f"--from-episode must be between {EPISODE_MIN} and {EPISODE_MAX}")
    if not (EPISODE_MIN <= args.to_episode <= EPISODE_MAX):
        raise SystemExit(f"--to-episode must be between {EPISODE_MIN} and {EPISODE_MAX}")
    if args.from_episode > args.to_episode:
        raise SystemExit("--from-episode must not be greater than --to-episode")
    tts_range = validate_tts_range(
        args.tts_from_episode,
        args.tts_to_episode,
        args.from_episode,
        args.to_episode,
    )
    if tts_range and args.skip_audio:
        raise SystemExit("TTS generation cannot be combined with --skip-audio")

    pdf_dir = Path(args.pdf_dir)
    if not pdf_dir.exists():
        raise SystemExit(f"PDF directory not found: {pdf_dir}")

    if tts_range and not args.dry_run:
        from generate_episodes import resolve_credentials_path

        if not resolve_credentials_path():
            raise SystemExit(
                "Google service account JSON not found. Set "
                "GOOGLE_APPLICATION_CREDENTIALS before enabling TTS."
            )

    print("Indexing PDFs…", flush=True)
    grouped = index_pdfs(pdf_dir)
    expected = set(range(args.from_episode, args.to_episode + 1))
    missing = sorted(expected - set(grouped))
    if missing:
        raise SystemExit(f"Missing PDFs for episodes: {missing}")

    json_path = Path(args.json_path)
    if json_path.exists() and not args.dry_run:
        with json_path.open(encoding="utf-8") as f:
            existing = json.load(f)
    else:
        existing = []

    imported: dict[int, dict] = {}

    for number in range(args.from_episode, args.to_episode + 1):
        primary_hint = (grouped[number].get("transcript") or grouped[number].get("part1") or [None])[0]
        print(f"Extracting episode {number:03d} ({primary_hint.name if primary_hint else '?'})…", flush=True)
        paras, primary = paragraphs_for_episode(number, grouped[number])
        validate_paragraphs(number, paras)
        title = title_from_filename(primary, number)
        if number == 50:
            title = "Episode 50: משבר חסר תקדים"
        print(
            f"Episode {number:03d}: {len(paras)} paragraphs, "
            f"{sum(len(HEBREW_RE.findall(p)) for p in paras)} Hebrew letters",
            flush=True,
        )
        print(f"  first: {paras[0][:120]}", flush=True)
        print(f"  last:  {paras[-1][:120]}", flush=True)
        payload = {
            "title": title,
            "hebrew_paragraphs": paras,
            "hebrew_text": "\n\n".join(paras),
            "english_paragraphs": [],
            "url": f"https://hebrewtime.squarespace.com/episodes/{number:02d}",
            "audio_url": None,
            "source": str(primary),
        }

        if args.dry_run:
            imported[number] = payload
            continue

        if args.skip_translate:
            english = [""] * len(paras)
        else:
            english = translate_episode(number, paras)
        if len(english) != len(paras):
            raise SystemExit(f"Episode {number}: translation length mismatch")
        payload["english_paragraphs"] = english

        prev = next((ep for ep in existing if int(ep["episode"]) == number), {})
        has_tts = bool(tts_range and tts_range[0] <= number <= tts_range[1])
        if has_tts:
            audio_path, aligned, duration = synthesize_tts_episode(number, paras)
            from generate_episodes import upload_audio

            print(f"  Episode {number:03d}: uploading Google TTS audio…", flush=True)
            payload["audio_url"] = upload_audio("intermediate", number, audio_path)
            payload["hebrew_paragraphs"] = aligned
            payload["url"] = prev.get("url") or payload["url"]
            update_episode_checkpoint(
                number,
                {
                    "audio_url": payload["audio_url"],
                    "audio_duration_sec": round(duration, 2),
                },
            )
        elif prev.get("audio_url"):
            payload["audio_url"] = prev.get("audio_url")
            payload["url"] = prev.get("url") or payload["url"]
        elif number >= 51 and not args.skip_audio:
            url, audio = fetch_audio_url(number)
            payload["url"] = url
            payload["audio_url"] = audio
            if audio:
                print(f"  Episode {number:03d}: audio found", flush=True)
            time.sleep(0.8)

        imported[number] = payload
        existing = merge_episodes(existing, {number: payload})
        write_json(json_path, existing)

    if args.dry_run:
        print(f"\nDry run complete. {len(imported)} episodes extracted. No files written.", flush=True)
        return

    print(f"\nWrote {len(existing)} episodes to {json_path}", flush=True)
    print("Next: python3 pipeline/migrate_legacy_episodes.py --from-episode 41", flush=True)


if __name__ == "__main__":
    main()
