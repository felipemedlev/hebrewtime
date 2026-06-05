# Task 01 — Supabase Schema

## New Tables

### `levels`

```sql
CREATE TABLE public.levels (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  cefr TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);
```

Seed: `beginner` (A1), `intermediate` (B1 legacy), `intermediate-2` (B1 generated), `advanced` (B2 generated).

### `episodes`

```sql
CREATE TABLE public.episodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level_slug TEXT NOT NULL REFERENCES public.levels(slug),
  episode_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL DEFAULT '',
  audio_url TEXT,
  hebrew_text TEXT NOT NULL DEFAULT '',
  hebrew_paragraphs JSONB NOT NULL DEFAULT '[]'::jsonb,
  english_paragraphs JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (level_slug, episode_number)
);
```

### RLS

- `levels`: public SELECT
- `episodes`: public SELECT where `is_published = true`
- Writes: service role only (pipeline scripts)

## `finished_episodes` Migration

Add `level_slug TEXT NOT NULL DEFAULT 'intermediate'`, change PK to `(user_id, level_slug, episode_number)`.

Backfill existing rows with `level_slug = 'intermediate'`.

## Paragraph JSON Shape

```json
{
  "text": "שלום. אני נועה.",
  "start": 0.0,
  "end": 3.5,
  "sentences": [
    { "text": "שלום.", "start": 0.0, "end": 1.2 },
    { "text": "אני נועה.", "start": 1.2, "end": 3.5 }
  ]
}
```

## Files

- [`supabase/beginner-track-migration.sql`](../../supabase/beginner-track-migration.sql)
