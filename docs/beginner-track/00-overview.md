# Beginner Level Track — Overview

## Goal

Add generated learning tracks (~20 AI-generated 10-minute episodes each) alongside the existing **Intermediate** podcast, using a Supabase-backed, level-aware architecture with sentence-level audio highlighting and an automated content pipeline.

## Architecture

```
levels (Supabase) ──► episodes (Supabase) ──► episode-audio (Storage)
                              ▲
                              │
         generate_episodes.py (OpenAI → sentence-timed Gemini TTS → upload)
                              │
         src/lib/episodes.ts ──► /api/episode/[level]/[id] ──► AppShell
```

## Design Decisions

| Decision | Choice |
|----------|--------|
| Content storage | Supabase `episodes` table (migrate all 50 intermediate from `episodes.json`) |
| Highlighting | Sentence-level (paragraph fallback for legacy intermediate) |
| Timestamps | Direct sentence-level TTS timings for generated audio; Whisper fallback for legacy external audio |
| Audio | Supabase Storage public bucket |
| Script generation | OpenAI `gpt-5.4` |
| Vocab/flashcards | Shared across levels |

## Task Documents

| Doc | Scope |
|-----|-------|
| [01-schema.md](./01-schema.md) | Supabase tables, RLS, migrations |
| [02-data-layer-api.md](./02-data-layer-api.md) | `episodes.ts`, API routes |
| [03-levels-ui.md](./03-levels-ui.md) | Sidebar level selector, AppShell state |
| [04-sentence-highlighting.md](./04-sentence-highlighting.md) | EpisodeViewer sentence sync |
| [05-pipeline.md](./05-pipeline.md) | End-to-end generation orchestration |
| [06-tts-storage.md](./06-tts-storage.md) | Gemini TTS + Supabase Storage upload |
| [07-alignment.md](./07-alignment.md) | Direct sentence timing + Whisper fallback |
| [08-migration.md](./08-migration.md) | `episodes.json` → Supabase migration |
| [09-curriculum-narrator.md](./09-curriculum-narrator.md) | 20-episode curriculum + persona |
| [10-env-rollout.md](./10-env-rollout.md) | Env vars, deps, rollout order |

## Rollout Order

1. Run SQL migrations (`supabase/beginner-track-migration.sql`)
2. Run `scripts/migrate_episodes_to_supabase.py`
3. Deploy Next.js changes (data layer, API, UI)
4. Create Supabase Storage bucket `episode-audio`
5. Run `scripts/generate_episodes.py --level beginner`, `scripts/generate_episodes.py --level intermediate-2 --curriculum intermediate_2_curriculum.json`, or `scripts/generate_episodes.py --level advanced --curriculum advanced_curriculum.json`
6. Verify in app
