"""Whisper-based paragraph and sentence alignment for Hebrew podcast episodes."""

from __future__ import annotations

import difflib
import re
from pathlib import Path
from typing import Any


def norm(text: str) -> str:
    return "".join(text.split()).lower()


def _seg_field(seg: Any, field: str, default: str | float = "") -> str | float:
    if seg is None:
        return default
    if isinstance(seg, dict):
        return seg.get(field, default)
    return getattr(seg, field, default)


def _seg_text(seg: Any) -> str:
    return str(_seg_field(seg, "text", ""))


def _seg_start(seg: Any) -> float:
    return float(_seg_field(seg, "start", 0))


def _seg_end(seg: Any) -> float:
    return float(_seg_field(seg, "end", 0))


def align_paragraphs(original_paras: list[str], segments: list[Any]) -> list[dict]:
    """Align original paragraph strings with Whisper segment timestamps."""
    aligned_paras: list[dict] = []

    full_whisper_text = ""
    char_to_segment: list[tuple[int, int, int]] = []

    for i, seg in enumerate(segments):
        start_char = len(full_whisper_text)
        seg_text = _seg_text(seg)
        full_whisper_text += seg_text + " "
        end_char = len(full_whisper_text)
        char_to_segment.append((start_char, end_char, i))

    s = difflib.SequenceMatcher(None, full_whisper_text, "")
    current_search_start = 0

    for para_text in original_paras:
        s.set_seq2(para_text)
        match = s.find_longest_match(current_search_start, len(full_whisper_text), 0, len(para_text))

        if match.size < 10:
            best_match = None
            best_ratio = 0.0
            for offset in range(
                max(0, current_search_start - 100),
                min(len(full_whisper_text), current_search_start + 1000),
            ):
                window = full_whisper_text[offset : offset + len(para_text) + 50]
                ratio = difflib.SequenceMatcher(None, window, para_text).ratio()
                if ratio > best_ratio:
                    best_ratio = ratio
                    best_match = (offset, offset + len(para_text))
                if ratio > 0.9:
                    break

            if best_ratio > 0.5 and best_match:
                start_idx, end_idx = best_match
            else:
                start_idx = current_search_start
                end_idx = current_search_start + len(para_text)
        else:
            start_idx = match.a
            end_idx = match.a + match.size

        start_time = None
        end_time = None

        for cs, ce, si in char_to_segment:
            if cs <= start_idx < ce:
                start_time = _seg_start(segments[si])
            if cs <= end_idx <= ce:
                end_time = _seg_end(segments[si])

        if start_time is None:
            start_time = _seg_start(segments[0])
        if end_time is None:
            end_time = _seg_end(segments[-1])

        if aligned_paras and start_time < aligned_paras[-1]["end"]:
            start_time = aligned_paras[-1]["end"]
        if end_time < start_time:
            end_time = start_time + 5.0

        aligned_paras.append(
            {
                "text": para_text,
                "start": round(float(start_time), 2),
                "end": round(float(end_time), 2),
            }
        )

        current_search_start = end_idx

    return aligned_paras


def split_hebrew_sentences(text: str) -> list[str]:
    """Split paragraph text into sentences on common Hebrew/Latin terminators."""
    parts = re.split(r"(?<=[.!?…])\s+|\n+", text.strip())
    return [p.strip() for p in parts if p.strip()]


def split_sentences(paragraph: dict) -> dict:
    """Add sentence-level timings within a paragraph window."""
    sentences_text = split_hebrew_sentences(paragraph["text"])
    if len(sentences_text) <= 1:
        return paragraph

    para_start = paragraph["start"]
    para_end = paragraph["end"]
    para_duration = max(para_end - para_start, 0.1)

    total_chars = sum(len(s) for s in sentences_text) or 1
    sentence_timings: list[dict] = []
    cursor = para_start

    for i, sent in enumerate(sentences_text):
        proportion = len(sent) / total_chars
        sent_duration = para_duration * proportion
        sent_end = cursor + sent_duration
        if i == len(sentences_text) - 1:
            sent_end = para_end

        sentence_timings.append(
            {
                "text": sent,
                "start": round(cursor, 2),
                "end": round(sent_end, 2),
            }
        )
        cursor = sent_end

    return {**paragraph, "sentences": sentence_timings}


def align_episode(hebrew_paragraphs: list[str], audio_path: str | Path, client) -> list[dict]:
    """Transcribe audio with Whisper and return paragraph + sentence timings."""
    audio_path = Path(audio_path)
    with audio_path.open("rb") as audio_file:
        transcript = client.audio.transcriptions.create(
            file=audio_file,
            model="whisper-1",
            response_format="verbose_json",
            timestamp_granularities=["segment"],
            language="he",
        )

    segments = transcript.segments
    aligned = align_paragraphs(hebrew_paragraphs, segments)
    return [split_sentences(p) for p in aligned]

