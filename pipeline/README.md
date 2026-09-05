# Content pipeline

Python scripts for scraping legacy podcast transcripts, generating AI episodes, and uploading to Supabase.

## Setup

```bash
pip install -r pipeline/requirements.txt
```

`.env` lives at the **repo root** (shared with Next.js). Required keys:

| Variable | Used by |
|----------|---------|
| `OPENAI_API_KEY` | Script generation, translations, Whisper alignment |
| `NEXT_PUBLIC_SUPABASE_URL` | DB and Storage upload |
| `SUPABASE_SERVICE_ROLE_KEY` | DB and Storage upload |
| `GOOGLE_APPLICATION_CREDENTIALS` | Gemini TTS (OAuth2 service account, not API key) |
| `SUPABASE_AUDIO_BUCKET` | Storage bucket name (default: `episode-audio`) |
| `SUPABASE_AUDIO_PUBLIC` | Use public Storage URLs instead of signed URLs (default: `false`) |
| `SUPABASE_AUDIO_URL_TTL_SECONDS` | Signed URL lifetime (default: 10 years) |

### GCP credentials checklist

1. Enable **Cloud Text-to-Speech API** and **Vertex AI API** on the GCP project
2. Grant the service account **Vertex AI User** (`roles/aiplatform.user`)
3. Place the JSON key in `secrets/gcp-service-account.json` (gitignored)
4. Set `GOOGLE_APPLICATION_CREDENTIALS` to the full path
5. Verify: `python3 pipeline/verify_gcp_tts.py`

## Directory layout

```
pipeline/
├── generate_episodes.py      Main AI episode pipeline
├── backfill_translations.py  Fill missing languages in Supabase
├── migrate_legacy_episodes.py  Push episodes.json → Supabase
├── align_legacy_episode.py   Whisper sync for legacy audio
├── verify_gcp_tts.py         Test GCP TTS access
├── curriculum/               Level configs ({slug}.json)
├── data/
│   ├── scripts/              Script banks ({slug}.json) — commit these
│   └── episodes.json         Legacy intermediate archive
├── legacy/                   Original podcast scraping tools
└── lib/
    ├── paths.py              Shared path constants
    ├── alignment.py          Whisper paragraph/sentence alignment
    └── translation_utils.py  OpenAI paragraph translation helpers
```

## Quick reference

```bash
# List available levels
python3 pipeline/generate_episodes.py --list-levels

# Script first workflow (recommended)
python3 pipeline/generate_episodes.py --level beginner --scripts-only
python3 pipeline/generate_episodes.py --level intermediate-2 --scripts-only
python3 pipeline/generate_episodes.py --level advanced --scripts-only

# Review pipeline/data/scripts/{level}.json, then:
python3 pipeline/generate_episodes.py --level beginner --audio-only

# Single episode
python3 pipeline/generate_episodes.py --level beginner --episode 3 --scripts-only
python3 pipeline/generate_episodes.py --level beginner --episode 3 --audio-only

# Regenerate from episode N onward
python3 pipeline/generate_episodes.py --level beginner --from-episode 8 --scripts-only --force
```

Curriculum and script bank paths resolve automatically from the level slug:

- Curriculum: `pipeline/curriculum/{level}.json`
- Script bank: `pipeline/data/scripts/{level}.json`

Override with `--curriculum PATH` or `--script-bank PATH` if needed.

## CLI flags (`generate_episodes.py`)

| Flag | Purpose |
|------|---------|
| `--list-levels` | Print curriculum slugs and exit |
| `--level SLUG` | Select level (default: `beginner`) |
| `--episode N` | Run one episode only |
| `--from-episode N` | Run from episode N onward |
| `--scripts-only` | Generate Hebrew scripts + English, Russian, Spanish, and French translations only |
| `--audio-only` | TTS + upload from existing script bank |
| `--script-model MODEL` | Override OpenAI model for script writing |
| `--force` | Regenerate even if checkpoint/DB row exists |
| `--curriculum PATH` | Override curriculum file |
| `--script-bank PATH` | Override script bank file |

`--scripts-only` and `--audio-only` cannot be combined.

## Script first workflow

1. **Generate scripts** with `--scripts-only`. Output goes to `pipeline/data/scripts/{level}.json`.
2. **Review/edit** the script bank JSON if needed.
3. **Generate audio** with `--audio-only`. This runs Gemini TTS per sentence, concatenates audio, records timestamps, uploads to Supabase Storage, and upserts the `episodes` row.

### Per episode steps (audio phase)

1. Load script from script bank
2. Synthesize each Hebrew sentence via Gemini 3.1 Flash TTS (`Achernar`, `he-IL`)
3. Concatenate with pydub, record exact `start`/`end` per sentence
4. Upload MP3 to `episode-audio/{level}/{NN}.mp3`
5. Upsert `episodes` row with `hebrew_paragraphs` (timed), `translations`, `audio_url`

### Continuity context

When generating episode N, the model receives context from the 3 most recent prior scripts (opening scene, closing note, useful phrases, vocabulary to reinforce). This keeps narrator voice and vocabulary progression consistent.

## How to add a new level

1. **Copy a curriculum file** as a template:
   ```bash
   cp pipeline/curriculum/beginner.json pipeline/curriculum/my-level.json
   ```
2. **Edit the curriculum**:
   - Set `"level": "my-level"` (this becomes the slug everywhere)
   - Set `"display": { "name": "...", "cefr": "...", "sort_order": N }`
   - Configure `narrator`, `tts`, `generation` (word counts, model, style rules)
   - Define `episodes[]` with `episode_number`, `title_en`, `topic`, `narrative_hook`, `new_vocab`, `review_vocab`, `useful_phrases`
3. **Generate scripts**:
   ```bash
   python3 pipeline/generate_episodes.py --level my-level --scripts-only
   ```
4. **Review** `pipeline/data/scripts/my-level.json`
5. **Generate audio and upload**:
   ```bash
   python3 pipeline/generate_episodes.py --level my-level --audio-only
   ```
6. The app picks up the new level automatically via `/api/levels` (the pipeline calls `ensure_level()` which upserts the `levels` row from the curriculum `display` block).

## Curriculum design principles

From the original beginner track spec (still applies to all generated levels):

### Narrator personas

| Level | Narrator | Voice |
|-------|----------|-------|
| Beginner | Noa (נועה) | Warm Israeli woman, late 20s, Tel Aviv |
| Intermediate 2 | Maya | Conversational B1, personal stories |
| Advanced | Eitan | Reflective B2, authentic spoken Hebrew |

### Episode structure

Each episode should feel like a **real personal story**, not a vocabulary list:

- **Narrative hook**: a small everyday scene or problem
- **Core vocab**: high frequency words reused across episodes
- **Useful chunks**: reusable phrases learners can say in daily life
- **Warm reflection** at the end

### Style rules (all levels)

- Open with a concrete scene, include one tiny problem or decision
- Use natural spoken Hebrew connectors sparingly
- Repeat useful words in different contexts without robotic repetition
- Avoid textbook dialogues, grammar lectures, or rare literary Hebrew
- Target ~10 minutes (`target_word_count_min` / `target_word_count_max`, `target_paragraph_count`)

### Vocabulary principles

- Prioritize pronouns, common verbs, question words, prepositions, time words
- Keep topic vocabulary small and useful
- Reinforce core words (`רוצה`, `צריך`, `יש`, `אין`, `איפה`, `מתי`, `אפשר`, `בסדר`) across many episodes
- Teach phrases as units: `אני לא יודעת`, `זה בסדר`, `אפשר...?`, `לאט לאט`

## Audio alignment

### Generated episodes (primary)

Direct sentence level TTS timing. No Whisper needed. Checkpoint stores:

```json
{
  "alignment_method": "direct_sentence_tts",
  "aligned_paragraphs": [
    {
      "text": "...",
      "start": 0.0,
      "end": 12.4,
      "sentences": [{ "text": "...", "start": 0.0, "end": 3.2 }]
    }
  ]
}
```

### Legacy intermediate (Whisper fallback)

For external podcast audio:

```bash
python3 pipeline/align_legacy_episode.py --episode 1
```

Uses `pipeline/lib/alignment.py`: Whisper transcribe → paragraph align → sentence split.

## Legacy podcast scraping

For the original Hebrew Time Squarespace podcast (intermediate level):

```bash
# Scrape + translate → pipeline/data/episodes.json
python3 pipeline/legacy/scraper.py

# Verify Google TTS credentials before generating the new 41–43 recordings
python3 pipeline/verify_gcp_tts.py

# Import full transcripts for episodes 41–115 from PDFs and generate
# synchronized Google TTS recordings for episodes 41–43 in this pass
python3 pipeline/legacy/import_pdf_transcripts.py --dry-run
python3 pipeline/legacy/import_pdf_transcripts.py \
  --from-episode 41 \
  --to-episode 115 \
  --tts-from-episode 41 \
  --tts-to-episode 43

# Push only the imported episodes; episodes 1–40 are intentionally outside
# this migration and must not be overwritten by this JSON file.
python3 pipeline/migrate_legacy_episodes.py \
  --from-episode 41 \
  --to-episode 115

# Patch missing paragraphs (if scraper missed leading text nodes)
python3 pipeline/legacy/apply_scraping_patch.py

# Fix audio URLs
python3 pipeline/legacy/patch_audio.py
```

To generate the remaining legacy recordings later, resume the same importer
with `--tts-from-episode 44 --tts-to-episode 50`; existing checkpoints make
episodes 41–43 reuse their completed audio.

## Translation backfill

Fill missing non English languages for existing Supabase episodes:

```bash
python3 pipeline/backfill_translations.py --dry-run
python3 pipeline/backfill_translations.py
python3 pipeline/backfill_translations.py --level beginner --lang ru
```

Checkpoint: `pipeline/.checkpoints/translation_backfill.json`

## Checkpoints and artifacts

| Path | Commit? | Role |
|------|---------|------|
| `pipeline/curriculum/*.json` | Yes | Level config |
| `pipeline/data/scripts/*.json` | Yes | Reviewed script banks |
| `pipeline/data/episodes.json` | Yes | Legacy archive + app fallback |
| `pipeline/.checkpoints/` | No | Local TTS cache (MP3 + alignment JSON) |
| `pipeline/data/episodes.json.bak.*` | No | Scraper backups |
| `pipeline/data/episodes_checkpoint.json` | No | Scraper resume file |

Safe to delete `pipeline/.checkpoints/` after verifying Supabase uploads. Regeneration re runs TTS.

## TTS troubleshooting

- Gemini TTS requires OAuth2 service account, not API keys
- Enable Cloud Text-to-Speech API **and** Vertex AI API
- Service account needs `roles/aiplatform.user`
- Python 3.13: `requirements.txt` includes `audioop-lts` for pydub
- If Vertex reports a usage guidelines false positive, the pipeline retries with neutral prompt, no prompt, and sanitized punctuation before failing with the exact sentence
- Episode audio uses long-lived signed Supabase Storage URLs by default, so the `episode-audio` bucket can remain private.

## Generation stack (current)

| Setting | Value |
|---------|-------|
| Script model | Per curriculum `generation.openai_model` (default: `gpt-5.5` beginner/advanced, `gpt-5.4` intermediate-2) |
| Translation model | `gpt-5.4-mini` (English, Russian, Spanish, and French) |
| TTS model | `gemini-3.1-flash-tts-preview` |
| Voice | `Achernar`, `he-IL` |
| Timing | Direct sentence level TTS (not Whisper) |
