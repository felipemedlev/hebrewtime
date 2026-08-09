-- Multilingual episode translations
-- Run in Supabase SQL Editor after beginner-track-migration.sql

ALTER TABLE public.episodes
  ADD COLUMN IF NOT EXISTS translations JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Backfill English from legacy english_paragraphs column
UPDATE public.episodes
SET translations = jsonb_set(
  COALESCE(translations, '{}'::jsonb),
  '{en}',
  english_paragraphs,
  true
)
WHERE english_paragraphs IS NOT NULL
  AND jsonb_array_length(english_paragraphs) > 0
  AND (
    translations IS NULL
    OR translations = '{}'::jsonb
    OR NOT (translations ? 'en')
    OR jsonb_array_length(COALESCE(translations->'en', '[]'::jsonb)) = 0
  );
