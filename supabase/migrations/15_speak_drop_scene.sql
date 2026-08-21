-- Speak: drop conversation scenes. Session notes (including recent_topics) stay.
-- Safe to re-run.

ALTER TABLE public.speak_profiles
  DROP CONSTRAINT IF EXISTS speak_profiles_scene_check;

ALTER TABLE public.speak_profiles
  DROP COLUMN IF EXISTS scene;
