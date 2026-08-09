-- Beginner Level Track migration
-- Run in Supabase SQL Editor after existing vocabulary/premium setup.

-- ---------------------------------------------------------------------------
-- Levels
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.levels (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  cefr TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

INSERT INTO public.levels (slug, name, cefr, sort_order) VALUES
  ('beginner', 'Beginner', 'A1', 0),
  ('intermediate', 'Intermediate', 'B1', 1),
  ('intermediate-2', 'Intermediate 2', 'B1', 2),
  ('advanced', 'Advanced', 'B2', 3)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  cefr = EXCLUDED.cefr,
  sort_order = EXCLUDED.sort_order;

ALTER TABLE public.levels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read levels" ON public.levels;
CREATE POLICY "Anyone can read levels"
  ON public.levels FOR SELECT
  USING (true);

-- ---------------------------------------------------------------------------
-- Episodes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.episodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level_slug TEXT NOT NULL REFERENCES public.levels(slug) ON DELETE RESTRICT,
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

CREATE INDEX IF NOT EXISTS episodes_level_slug_idx ON public.episodes (level_slug);
CREATE INDEX IF NOT EXISTS episodes_published_idx ON public.episodes (level_slug, episode_number)
  WHERE is_published = true;

ALTER TABLE public.episodes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read published episodes" ON public.episodes;
CREATE POLICY "Anyone can read published episodes"
  ON public.episodes FOR SELECT
  USING (is_published = true);

-- ---------------------------------------------------------------------------
-- finished_episodes: add level_slug
-- ---------------------------------------------------------------------------
ALTER TABLE public.finished_episodes
  ADD COLUMN IF NOT EXISTS level_slug TEXT NOT NULL DEFAULT 'intermediate';

UPDATE public.finished_episodes
SET level_slug = 'intermediate'
WHERE level_slug IS NULL OR level_slug = '';

-- Drop old PK if it exists (user_id, episode_number)
ALTER TABLE public.finished_episodes
  DROP CONSTRAINT IF EXISTS finished_episodes_pkey;

ALTER TABLE public.finished_episodes
  ADD CONSTRAINT finished_episodes_pkey
  PRIMARY KEY (user_id, level_slug, episode_number);

-- Optional FK to levels (skip if levels not seeded yet in older projects)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'finished_episodes_level_slug_fkey'
  ) THEN
    ALTER TABLE public.finished_episodes
      ADD CONSTRAINT finished_episodes_level_slug_fkey
      FOREIGN KEY (level_slug) REFERENCES public.levels(slug) ON DELETE RESTRICT;
  END IF;
EXCEPTION
  WHEN others THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Storage bucket (run via Dashboard if this fails — requires storage admin)
-- ---------------------------------------------------------------------------
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('episode-audio', 'episode-audio', true)
-- ON CONFLICT (id) DO UPDATE SET public = true;

-- Public read policy for episode audio
-- CREATE POLICY "Public read episode audio"
--   ON storage.objects FOR SELECT
--   USING (bucket_id = 'episode-audio');
