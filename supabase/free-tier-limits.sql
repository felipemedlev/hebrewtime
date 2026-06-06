-- Run in the Supabase SQL Editor to allow Free users access to vocabulary and flashcards,
-- and to track daily usage of translations and AI examples.

-- 1. Relax vocabulary RLS policies (allow all authenticated users, not just premium)
DROP POLICY IF EXISTS "Premium users view own vocabulary" ON public.vocabulary;
DROP POLICY IF EXISTS "Premium users insert own vocabulary" ON public.vocabulary;
DROP POLICY IF EXISTS "Premium users update own vocabulary" ON public.vocabulary;
DROP POLICY IF EXISTS "Premium users delete own vocabulary" ON public.vocabulary;

CREATE POLICY "Users view own vocabulary"
ON public.vocabulary FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users insert own vocabulary"
ON public.vocabulary FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own vocabulary"
ON public.vocabulary FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own vocabulary"
ON public.vocabulary FOR DELETE
TO authenticated
USING (auth.uid() = user_id);


-- 2. Relax flashcard_progress RLS policies (allow all authenticated users, not just premium)
DROP POLICY IF EXISTS "Premium users view own flashcard progress" ON public.flashcard_progress;
DROP POLICY IF EXISTS "Premium users insert own flashcard progress" ON public.flashcard_progress;
DROP POLICY IF EXISTS "Premium users update own flashcard progress" ON public.flashcard_progress;
DROP POLICY IF EXISTS "Premium users delete own flashcard progress" ON public.flashcard_progress;

CREATE POLICY "Users view own flashcard progress"
ON public.flashcard_progress FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users insert own flashcard progress"
ON public.flashcard_progress FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own flashcard progress"
ON public.flashcard_progress FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own flashcard progress"
ON public.flashcard_progress FOR DELETE
TO authenticated
USING (auth.uid() = user_id);


-- 3. Add columns to user_activity_daily to track daily free-tier usage
ALTER TABLE public.user_activity_daily
  ADD COLUMN IF NOT EXISTS translations_count INTEGER NOT NULL DEFAULT 0 CHECK (translations_count >= 0),
  ADD COLUMN IF NOT EXISTS ai_examples_count INTEGER NOT NULL DEFAULT 0 CHECK (ai_examples_count >= 0);


-- 4. Function to increment daily translation count
CREATE OR REPLACE FUNCTION public.increment_translations_count(
  p_user_id UUID,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.user_activity_daily (user_id, activity_date, translations_count, last_seen_at)
  VALUES (p_user_id, p_date, 1, NOW())
  ON CONFLICT (user_id, activity_date)
  DO UPDATE SET
    translations_count = public.user_activity_daily.translations_count + 1,
    last_seen_at = GREATEST(public.user_activity_daily.last_seen_at, NOW());
END;
$$;

REVOKE ALL ON FUNCTION public.increment_translations_count(UUID, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_translations_count(UUID, DATE) TO service_role;


-- 5. Function to increment daily AI examples count
CREATE OR REPLACE FUNCTION public.increment_examples_count(
  p_user_id UUID,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.user_activity_daily (user_id, activity_date, ai_examples_count, last_seen_at)
  VALUES (p_user_id, p_date, 1, NOW())
  ON CONFLICT (user_id, activity_date)
  DO UPDATE SET
    ai_examples_count = public.user_activity_daily.ai_examples_count + 1,
    last_seen_at = GREATEST(public.user_activity_daily.last_seen_at, NOW());
END;
$$;

REVOKE ALL ON FUNCTION public.increment_examples_count(UUID, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_examples_count(UUID, DATE) TO service_role;
