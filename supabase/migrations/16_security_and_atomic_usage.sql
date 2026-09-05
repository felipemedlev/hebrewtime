-- Atomic daily usage reservations and ownership hardening.
-- Apply after migrations 01 through 15.

CREATE OR REPLACE FUNCTION public.reserve_daily_usage(
  p_user_id UUID,
  p_counter TEXT,
  p_limit INTEGER,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_count INTEGER;
BEGIN
  IF p_user_id IS NULL OR p_limit IS NULL OR p_limit < 1 THEN RETURN FALSE; END IF;

  INSERT INTO public.user_activity_daily (user_id, activity_date)
  VALUES (p_user_id, p_date)
  ON CONFLICT (user_id, activity_date) DO NOTHING;

  SELECT CASE p_counter
    WHEN 'translations_count' THEN translations_count
    WHEN 'ai_examples_count' THEN ai_examples_count
    WHEN 'fill_in_count' THEN fill_in_count
    WHEN 'speak_sessions_count' THEN speak_sessions_count
    ELSE NULL
  END INTO current_count
  FROM public.user_activity_daily
  WHERE user_id = p_user_id AND activity_date = p_date
  FOR UPDATE;

  IF current_count IS NULL OR current_count >= p_limit THEN RETURN FALSE; END IF;

  UPDATE public.user_activity_daily
  SET translations_count = CASE WHEN p_counter = 'translations_count' THEN translations_count + 1 ELSE translations_count END,
      ai_examples_count = CASE WHEN p_counter = 'ai_examples_count' THEN ai_examples_count + 1 ELSE ai_examples_count END,
      fill_in_count = CASE WHEN p_counter = 'fill_in_count' THEN fill_in_count + 1 ELSE fill_in_count END,
      speak_sessions_count = CASE WHEN p_counter = 'speak_sessions_count' THEN speak_sessions_count + 1 ELSE speak_sessions_count END,
      last_seen_at = NOW()
  WHERE user_id = p_user_id AND activity_date = p_date;
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_daily_usage(
  p_user_id UUID,
  p_counter TEXT,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_activity_daily
  SET translations_count = CASE WHEN p_counter = 'translations_count' THEN GREATEST(0, translations_count - 1) ELSE translations_count END,
      ai_examples_count = CASE WHEN p_counter = 'ai_examples_count' THEN GREATEST(0, ai_examples_count - 1) ELSE ai_examples_count END,
      fill_in_count = CASE WHEN p_counter = 'fill_in_count' THEN GREATEST(0, fill_in_count - 1) ELSE fill_in_count END,
      speak_sessions_count = CASE WHEN p_counter = 'speak_sessions_count' THEN GREATEST(0, speak_sessions_count - 1) ELSE speak_sessions_count END,
      last_seen_at = NOW()
  WHERE user_id = p_user_id AND activity_date = p_date;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_daily_usage(UUID, TEXT, INTEGER, DATE) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_daily_usage(UUID, TEXT, DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_daily_usage(UUID, TEXT, INTEGER, DATE) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_daily_usage(UUID, TEXT, DATE) TO service_role;

DROP POLICY IF EXISTS "Users view own flashcard progress" ON public.flashcard_progress;
DROP POLICY IF EXISTS "Users insert own flashcard progress" ON public.flashcard_progress;
DROP POLICY IF EXISTS "Users update own flashcard progress" ON public.flashcard_progress;
DROP POLICY IF EXISTS "Users delete own flashcard progress" ON public.flashcard_progress;

CREATE POLICY "Users view own flashcard progress" ON public.flashcard_progress
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.vocabulary v WHERE v.id = vocab_id AND v.user_id = auth.uid()));
CREATE POLICY "Users insert own flashcard progress" ON public.flashcard_progress
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.vocabulary v WHERE v.id = vocab_id AND v.user_id = auth.uid()));
CREATE POLICY "Users update own flashcard progress" ON public.flashcard_progress
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.vocabulary v WHERE v.id = vocab_id AND v.user_id = auth.uid()))
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.vocabulary v WHERE v.id = vocab_id AND v.user_id = auth.uid()));
CREATE POLICY "Users delete own flashcard progress" ON public.flashcard_progress
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.vocabulary v WHERE v.id = vocab_id AND v.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users view own review practice attempts" ON public.review_practice_attempts;
DROP POLICY IF EXISTS "Users insert own review practice attempts" ON public.review_practice_attempts;
DROP POLICY IF EXISTS "Users delete own review practice attempts" ON public.review_practice_attempts;

CREATE POLICY "Users view own review practice attempts" ON public.review_practice_attempts
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.vocabulary v WHERE v.id = vocab_id AND v.user_id = auth.uid()));
CREATE POLICY "Users insert own review practice attempts" ON public.review_practice_attempts
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.vocabulary v WHERE v.id = vocab_id AND v.user_id = auth.uid()));
CREATE POLICY "Users delete own review practice attempts" ON public.review_practice_attempts
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.vocabulary v WHERE v.id = vocab_id AND v.user_id = auth.uid()));
