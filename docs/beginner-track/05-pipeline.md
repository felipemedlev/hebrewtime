# Task 05 — Content Generation Pipeline

## Script

[`scripts/generate_episodes.py`](../../scripts/generate_episodes.py)

### Usage

```bash
# Recommended two-phase workflow
python3 scripts/generate_episodes.py --level beginner --scripts-only
python3 scripts/generate_episodes.py --level beginner --audio-only

# Intermediate 2 generated track
python3 scripts/generate_episodes.py --level intermediate-2 --curriculum intermediate_2_curriculum.json --scripts-only
python3 scripts/generate_episodes.py --level intermediate-2 --curriculum intermediate_2_curriculum.json --audio-only

# Advanced generated track
python3 scripts/generate_episodes.py --level advanced --curriculum advanced_curriculum.json --scripts-only
python3 scripts/generate_episodes.py --level advanced --curriculum advanced_curriculum.json --audio-only

# Use a specific OpenAI script model without changing TTS
python3 scripts/generate_episodes.py --level beginner --scripts-only --script-model gpt-5.5
python3 scripts/generate_episodes.py --level intermediate-2 --curriculum intermediate_2_curriculum.json --scripts-only --script-model gpt-5.5
python3 scripts/generate_episodes.py --level advanced --curriculum advanced_curriculum.json --scripts-only --script-model gpt-5.5

# Single episode
python3 scripts/generate_episodes.py --level beginner --episode 3 --scripts-only
python3 scripts/generate_episodes.py --level beginner --episode 3 --audio-only

# From an episode onward
python3 scripts/generate_episodes.py --level beginner --from-episode 8 --scripts-only
python3 scripts/generate_episodes.py --level beginner --from-episode 8 --audio-only

# Regenerate scripts/audio from scratch
python3 scripts/generate_episodes.py --level beginner --scripts-only --force
python3 scripts/generate_episodes.py --level beginner --audio-only --force
```

### Steps (per episode)

1. Load curriculum entry from `beginner_curriculum.json` or a custom `--curriculum` path such as `intermediate_2_curriculum.json` or `advanced_curriculum.json`.
2. **Generate script bank** — OpenAI creates `{ title, hebrew_paragraphs[], english_paragraphs[] }` and stores it in `scripts/generated/{level}_scripts.json`.
3. **Use continuity context** — when generating episode N, the script prompt includes recent previous episodes from the script bank (opening scene, closing note, useful phrases, and vocabulary to reinforce).
4. **Review/edit script JSON** — scripts can be inspected or manually corrected before paying for TTS.
5. **Synthesize audio + timestamps** — Gemini TTS per sentence, concat with pydub, and record exact sentence start/end times as the MP3 is assembled.
6. **Fallback alignment only for external audio** — Whisper helpers remain in `scripts/lib/alignment.py`, but generated episodes should not use Whisper for primary sync.
7. **Upload audio** — Supabase Storage `episode-audio/{level}/{NN}.mp3`.
8. **Upsert DB** — `episodes` row via service role.

### Checkpoint

- `scripts/generated/{level}_scripts.json` — durable pre-generated script bank used as context for later episodes
- `scripts/.checkpoints/{level}-{N}.json` — script + directly timed sentence/paragraph metadata (`alignment_method: direct_sentence_tts`)
- `scripts/.checkpoints/{level}-{N}.mp3` — synthesized audio (reused on retry when metadata is present)

Skip episode if DB row exists and `--force` not set.
