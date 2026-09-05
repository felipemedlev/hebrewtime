---
name: Import Intermediate PDFs
overview: Replace truncated Intermediate (legacy podcast) episodes 41–50 with full Hebrew from the PDFs, add episodes 51–115, generate English translations, update `pipeline/data/episodes.json`, and upsert only those rows to Supabase.
todos:
  - id: pdf-importer
    content: "Add pdfplumber and pipeline/legacy/import_pdf_transcripts.py: map PDFs, extract Hebrew paragraphs (Canva columns + ep 41), concat 50.1/50.2, skip vocab PDF"
    status: completed
  - id: en-translate-merge
    content: Translate Hebrew to English with checkpoint; merge into episodes.json keeping 1–40; preserve 41–50 audio URLs; scrape audio for 51–115 when possible
    status: in_progress
  - id: migrate-from-episode
    content: Add --from-episode to migrate_legacy_episodes.py and document the import command in pipeline/README.md
    status: completed
  - id: verify
    content: Dry-run QA on 41/42/50/51/115, then migrate 41–115 and verify in the Intermediate reader
    status: pending
isProject: false
---

# Import Intermediate transcripts from PDFs (41–115)

This is the **legacy Intermediate** podcast track (`level_slug: intermediate`), not AI Intermediate 2. Today [`pipeline/data/episodes.json`](pipeline/data/episodes.json) stops at episode 50, and 41–50 are Patreon teasers (`את המשך הטרנסקריפט אפשר לקרוא כאן`). The 77 PDFs in [`pipeline/data/Transcripts_Intermediate/`](pipeline/data/Transcripts_Intermediate/) cover every episode 41–115.

Leave episodes **1–40** unchanged (including Whisper timestamps).

## PDF quirks the importer must handle

- Almost every file is a **Canva** layout: Hebrew plus English/Russian on the same page, often two columns. Glyphs are drawn LTR so naive extraction comes out reversed and mixed with translations. Extract **Hebrew only** by clustering words on the page (typically the right column), grouping by Y into lines, reversing Hebrew runs, then grouping lines into paragraphs.
- Episode 41 (`[‎41]⁨פרק1⁩.pdf`) is a different export (literal `Tj`/`TJ` + ToUnicode, not Canva hex glyphs). Use a layout library, not a custom Canva parser.
- **Episode 50** has three files: `משבר חסר תקדים [1_50].pdf` (part 1), `משבר חסר תקדים[50.2[50.2].pdf` (part 2), and `מילים שימושיות לפרק 50[50].pdf` (vocab sheet). Concatenate part 1 then part 2 into episode **50**. Skip the vocab PDF.
- Titles come from filenames; normalize to `Episode NN: …` the same way [`pipeline/migrate_legacy_episodes.py`](pipeline/migrate_legacy_episodes.py) already does.

## Implementation

New script: [`pipeline/legacy/import_pdf_transcripts.py`](pipeline/legacy/import_pdf_transcripts.py)

```text
PDFs 41–115 → Hebrew paragraphs → English via existing translator
      → merge into episodes.json (keep 1–40)
      → optional audio scrape for 51–115
      → migrate --from-episode 41 to Supabase
```

1. Add `pdfplumber` to [`pipeline/requirements.txt`](pipeline/requirements.txt) (MIT; avoid AGPL PyMuPDF).
2. Reuse [`pipeline/lib/translation_utils.py`](pipeline/lib/translation_utils.py) `translate_paragraphs(..., "en")` only. Write `english_paragraphs` and `translations: { "en": [...] }`. Do **not** generate ru/es/fr (the reader already falls back to English). Checkpoint per episode under `pipeline/.checkpoints/` so a failed OpenAI call can resume.
3. Merge rules for each episode 41–115:
   - Replace `hebrew_paragraphs` (plain strings, untimed — same as current 41–50), `hebrew_text`, `english_paragraphs`, `translations`.
   - Keep existing `audio_url` / `url` for 41–50.
   - New 51–115: `url` = `https://hebrewtime.squarespace.com/episodes/{n:02d}`; `audio_url` from a best-effort scrape using the existing Drive/MP3 logic in [`pipeline/legacy/scraper.py`](pipeline/legacy/scraper.py) (`fetch_episode`). If the page 404s, leave audio empty (the player already hides when `audio_url` is missing).
   - Strip leftover Patreon/Ko-fi CTA lines if they still appear in a PDF.
4. Add `--from-episode` (and `--dry-run` already exists) to [`pipeline/migrate_legacy_episodes.py`](pipeline/migrate_legacy_episodes.py). **Must migrate 41–115 only.** A full-file upsert would overwrite Supabase `translations` for 1–40 with English-only, because `episodes.json` has no `translations` key today.
5. Document the command in [`pipeline/README.md`](pipeline/README.md) under Legacy podcast scraping.

CLI shape:

```bash
python3 pipeline/legacy/import_pdf_transcripts.py --dry-run
python3 pipeline/legacy/import_pdf_transcripts.py
python3 pipeline/migrate_legacy_episodes.py --from-episode 41
```

`--dry-run` prints file→episode mapping, paragraph counts, and the first/last Hebrew paragraph — no JSON write, no OpenAI, no Supabase.

## QA

- Episode **42**: extracted opening should match the existing teaser Hebrew in `episodes.json` (that prefix is already correct).
- Spot-check **41** (odd PDF), **50** (two parts, no vocab sheet), **51**, **104** (image-heavy Canva), **115**.
- Fail the import if an episode has almost no Hebrew, or if paragraph count looks like per-letter garbage.
- After migrate: open Intermediate in the browser, read 41 (full text, no Patreon stub), 50, 51, and 115; confirm English lines up 1:1 with Hebrew; confirm 1–40 still have audio sync and prior translations.

Not in this pass: Whisper alignment for 41–115, ru/es/fr backfill, or Intermediate 2.