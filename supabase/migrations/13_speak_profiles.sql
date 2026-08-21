-- Speak with AI: learner profile memory and daily session counter.
-- Safe to re-run (IF NOT EXISTS / OR REPLACE).

CREATE TABLE IF NOT EXISTS public.speak_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  voice_gender TEXT NOT NULL DEFAULT 'female' CHECK (voice_gender IN ('male', 'female')),
  level TEXT NOT NULL DEFAULT 'beginner' CHECK (level IN ('beginner', 'intermediate', 'advanced')),
  realtime_model TEXT NOT NULL DEFAULT 'gpt-realtime-2.1'
    CHECK (realtime_model IN ('gpt-realtime-2.1', 'gpt-realtime-2.1-mini')),
  speech_speed NUMERIC(3, 2) NOT NULL DEFAULT 1.0
    CHECK (speech_speed >= 0.25 AND speech_speed <= 1.5),
  learner_facts JSONB NOT NULL DEFAULT '{}'::jsonb,
  conversation_summary TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.speak_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own speak profile" ON public.speak_profiles;
DROP POLICY IF EXISTS "Users insert own speak profile" ON public.speak_profiles;
DROP POLICY IF EXISTS "Users update own speak profile" ON public.speak_profiles;
DROP POLICY IF EXISTS "Users delete own speak profile" ON public.speak_profiles;

CREATE POLICY "Users view own speak profile"
ON public.speak_profiles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users insert own speak profile"
ON public.speak_profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own speak profile"
ON public.speak_profiles FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own speak profile"
ON public.speak_profiles FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS speak_profiles_set_updated_at ON public.speak_profiles;
CREATE TRIGGER speak_profiles_set_updated_at
BEFORE UPDATE ON public.speak_profiles
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();


ALTER TABLE public.user_activity_daily
  ADD COLUMN IF NOT EXISTS speak_sessions_count INTEGER NOT NULL DEFAULT 0
  CHECK (speak_sessions_count >= 0);


CREATE OR REPLACE FUNCTION public.increment_speak_sessions_count(
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

  INSERT INTO public.user_activity_daily (user_id, activity_date, speak_sessions_count, last_seen_at)
  VALUES (p_user_id, p_date, 1, NOW())
  ON CONFLICT (user_id, activity_date)
  DO UPDATE SET
    speak_sessions_count = public.user_activity_daily.speak_sessions_count + 1,
    last_seen_at = GREATEST(public.user_activity_daily.last_seen_at, NOW());
END;
$$;

REVOKE ALL ON FUNCTION public.increment_speak_sessions_count(UUID, DATE) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_speak_sessions_count(UUID, DATE) FROM anon;
REVOKE ALL ON FUNCTION public.increment_speak_sessions_count(UUID, DATE) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.increment_speak_sessions_count(UUID, DATE) TO service_role;
