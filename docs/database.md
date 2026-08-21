# Database setup

Run migrations in [`supabase/migrations/`](../supabase/migrations/) **in numeric order** in the Supabase SQL Editor. Each file is idempotent where possible (`IF NOT EXISTS`, `DROP POLICY IF EXISTS`).

## Migration order

| # | File | Purpose |
|---|------|---------|
| 01 | `01_core_vocabulary_premium.sql` | `vocabulary`, `flashcard_progress`, `premium_users`, `finished_episodes`, `user_has_premium_access()` |
| 02 | `02_premium_rls.sql` | Premium aware RLS for vocabulary and flashcards (for upgrades from auth only policies) |
| 03 | `03_fsrs.sql` | FSRS columns on `flashcard_progress` |
| 04 | `04_levels_episodes.sql` | `levels`, `episodes` tables; upgrades `finished_episodes` for multi level |
| 05 | `05_multilingual_translations.sql` | `episodes.translations` JSONB column |
| 06 | `06_dictionary_entries.sql` | Pealim `dictionary_entries` + `vocabulary.dictionary_pealim_id` FK |
| 07 | `07_dictionary_trgm.sql` | `pg_trgm` fuzzy lookup via `match_dictionary_word()` |
| 08 | `08_admin_usage_stats.sql` | `user_activity_daily` + `increment_user_activity()` |
| 09 | `09_free_tier_limits.sql` | Relaxes premium RLS to auth only; adds daily usage counters |
| 10 | `10_review_practice_attempts.sql` | Fill in and matching practice stats |
| 11 | `11_flashcard_direction.sql` | `direction` column for forward/reverse FSRS schedules |
| 12 | `12_vocabulary_entry_kind.sql` | `vocabulary.entry_kind` (`word` or `phrase`) |
| 13 | `13_speak_profiles.sql` | `speak_profiles` + `user_activity_daily.speak_sessions_count` |
| 14 | `14_speak_scenes_notes.sql` | `speak_profiles.scene` + `session_notes` (scene later dropped in 15) |
| 15 | `15_speak_drop_scene.sql` | Drops `speak_profiles.scene` |

**Fresh install:** run 01 through 15 in order.

**Existing project:** skip migrations you have already applied. Migration 09 is important if your project still has premium only RLS on vocabulary/flashcards.

## Storage

Create a Supabase Storage bucket named `episode-audio` (or set `SUPABASE_AUDIO_BUCKET`). Generated episode audio is stored at `{level}/{NN}.mp3`.

## Core tables

### `vocabulary`

Per user saved words and phrases. Key columns: `word`, `word_with_nekudot`, `translation`, `pronunciation`, `dictionary_pealim_id`, `entry_kind` (`word` default, or `phrase` for user typed expressions), `example_phrases` (JSONB).

### `flashcard_progress`

FSRS scheduling per vocab card. Unique on `(user_id, vocab_id, direction)` after migration 11.

### `episodes`

Published episodes per level. Key columns: `level_slug`, `episode_number`, `hebrew_paragraphs`, `english_paragraphs`, `translations` (JSONB map of 6 languages), `audio_url`.

### `levels`

Learning track metadata: `slug`, `name`, `cefr`, `sort_order`.

### `dictionary_entries`

Shared Pealim reference data. See [`dictionary_entries.md`](dictionary_entries.md).

### `premium_users`

Email based premium flag. Server actions and admin dashboard write via service role.

### `finished_episodes`

Per user, per level episode completion. Primary key: `(user_id, level_slug, episode_number)`.

### `user_activity_daily`

Daily rollups: active time, translation count, AI example count, fill in count, speak session count.

### `speak_profiles`

Per-user Hebrew speaking teacher memory (not a chat log). One row per user.

| Column | Purpose |
|--------|---------|
| `voice_gender` | `male` or `female` (maps to Realtime voices `cedar` / `marin`) |
| `level` | `beginner`, `intermediate`, or `advanced` (vocabulary guidance) |
| `realtime_model` | `gpt-realtime-2.1` or `gpt-realtime-2.1-mini` |
| `speech_speed` | 0.25–1.5 (default 0.6 beginner; user-chosen before each session) |
| `learner_facts` | JSONB: `name`, `gender` (`male`/`female`), `city`, `country`, `occupation`, `interests` |
| `conversation_summary` | ≤500 char English summary of prior topics |
| `session_notes` | JSONB: `last_corrections`, `target_phrases` (max 5 short strings each), `recent_topics` (spark ids, max 8, so calls stay different) |

RLS: authenticated users CRUD own row only. Daily speak caps enforced in `createSpeakSession` via `increment_speak_sessions_count()` (service role only).

## RLS summary

After all migrations:

- **vocabulary / flashcard_progress**: authenticated users can CRUD their own rows (migration 09 relaxed premium only policies)
- **finished_episodes**: users manage their own rows
- **speak_profiles**: users manage their own rows
- **premium_users**: users can read only their own email row
- **dictionary_entries**: authenticated SELECT (server actions also use service role for anonymous translation)
- **episodes / levels**: public read for published content (via service role in app)

Premium enforcement for unlimited usage happens in server actions (`src/app/actions.ts`), not only in RLS.

## Admin accounts

`ADMIN_EMAILS` unlocks admin UI and server side premium checks. Admins also need a row in `premium_users` to pass RLS for vocabulary writes, or migration 09 must be applied so auth only policies apply.

## Useful snippets

### Reset onboarding for a test user

```sql
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data - 'onboarded'
WHERE email = 'your@email.com';
```

### Grant premium manually

```sql
INSERT INTO public.premium_users (email, is_premium)
VALUES ('user@example.com', true)
ON CONFLICT (email) DO UPDATE SET is_premium = true, updated_at = NOW();
```

### Add example phrases column (if missing on old vocabulary table)

```sql
ALTER TABLE public.vocabulary
  ADD COLUMN IF NOT EXISTS example_phrases JSONB NOT NULL DEFAULT '[]'::jsonb;
```
