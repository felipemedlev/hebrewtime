from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import sys

PIPELINE_DIR = Path(__file__).resolve().parent
if str(PIPELINE_DIR) not in sys.path:
    sys.path.insert(0, str(PIPELINE_DIR))

from legacy import import_pdf_transcripts as importer  # noqa: E402


class ImportPdfTranscriptTests(unittest.TestCase):
    def test_pdf_roles_cover_special_files(self) -> None:
        self.assertEqual(
            importer.parse_pdf_role(Path("[‎41]⁨פרק1⁩.pdf")),
            (41, "transcript"),
        )
        self.assertEqual(
            importer.parse_pdf_role(Path("משבר חסר תקדים [1_50].pdf")),
            (50, "part1"),
        )
        self.assertEqual(
            importer.parse_pdf_role(Path("משבר חסר תקדים[50.2[50.2].pdf")),
            (50, "part2"),
        )
        self.assertEqual(
            importer.parse_pdf_role(Path("מילים שימושיות לפרק 50[50].pdf")),
            (None, "skip"),
        )

    def test_episode_50_concatenates_parts_in_order(self) -> None:
        part1 = Path("part1.pdf")
        part2 = Path("part2.pdf")

        def extract(path: Path) -> list[str]:
            return ["part one"] if path == part1 else ["part two"]

        with patch.object(importer, "extract_hebrew_paragraphs", side_effect=extract):
            paragraphs, primary = importer.paragraphs_for_episode(
                50,
                {"part1": [part1], "part2": [part2]},
            )

        self.assertEqual(paragraphs, ["part one", "part two"])
        self.assertEqual(primary, part1)

    def test_promotional_and_header_lines_are_filtered(self) -> None:
        self.assertTrue(importer.is_cta_or_junk("המשך הטרנסקריפט אפשר לקרוא כאן"))
        self.assertTrue(importer.is_cta_or_junk("Patreon support"))
        self.assertTrue(importer.is_cta_or_junk("זמן עברית"))
        self.assertFalse(importer.is_cta_or_junk("שלום לכולם, ברוכים הבאים"))
        self.assertEqual(importer.strip_isolates("שלום\x00 לכולם"), "שלום לכולם")

    def test_tts_range_requires_both_flags_and_stays_in_41_50(self) -> None:
        self.assertEqual(
            importer.validate_tts_range(41, 50, 41, 115),
            (41, 50),
        )
        with self.assertRaises(SystemExit):
            importer.validate_tts_range(41, None, 41, 115)
        with self.assertRaises(SystemExit):
            importer.validate_tts_range(50, 51, 41, 115)
        with self.assertRaises(SystemExit):
            importer.validate_tts_range(41, 50, 42, 115)

    def test_tts_fingerprint_changes_when_source_changes(self) -> None:
        first = importer.tts_checkpoint_fingerprint(["שלום לכולם"])
        second = importer.tts_checkpoint_fingerprint(["שלום לכולן"])
        self.assertNotEqual(first, second)

    def test_timed_paragraph_validation_requires_matching_order(self) -> None:
        timed = [
            {
                "text": "שלום.",
                "start": 0.0,
                "end": 1.0,
                "sentences": [{"text": "שלום.", "start": 0.0, "end": 1.0}],
            }
        ]
        self.assertTrue(importer.timed_paragraphs_are_valid(timed, ["שלום."]))
        self.assertFalse(importer.timed_paragraphs_are_valid(timed, ["ערב טוב."]))
        self.assertFalse(
            importer.timed_paragraphs_are_valid(
                [{**timed[0], "sentences": []}],
                ["שלום."],
            )
        )

    def test_checkpoint_update_preserves_translation_and_audio_state(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            checkpoint_dir = Path(directory)
            with patch.object(importer, "CHECKPOINT_DIR", checkpoint_dir):
                importer.save_episode_checkpoint(
                    41,
                    {"hebrew_paragraphs": ["שלום"], "english_paragraphs": ["Hello"]},
                )
                importer.update_episode_checkpoint(
                    41,
                    {"audio_url": "https://example.test/41.mp3"},
                )
                checkpoint = importer.load_episode_checkpoint(41)

        self.assertEqual(checkpoint["english_paragraphs"], ["Hello"])
        self.assertEqual(checkpoint["audio_url"], "https://example.test/41.mp3")

    def test_merge_preserves_episodes_1_to_40_and_prefers_generated_audio(self) -> None:
        original = [
            {"episode": 1, "audio_url": "legacy-1", "extra": {"unchanged": True}},
            {"episode": 40, "audio_url": "legacy-40", "extra": {"unchanged": True}},
        ]
        imported = {
            41: {
                "title": "Episode 41: Test",
                "url": "https://example.test/41",
                "hebrew_paragraphs": ["שלום"],
                "hebrew_text": "שלום",
                "english_paragraphs": ["Hello"],
                "audio_url": "https://example.test/generated-41.mp3",
            }
        }

        merged = importer.merge_episodes(original, imported)

        self.assertEqual(merged[:2], original)
        self.assertEqual(merged[2]["audio_url"], "https://example.test/generated-41.mp3")


if __name__ == "__main__":
    unittest.main()
