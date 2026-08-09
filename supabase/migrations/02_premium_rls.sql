-- Run this in the Supabase SQL Editor to enforce premium access at the database layer.
-- Safe to re-run: drops and recreates policies/functions.

CREATE OR REPLACE FUNCTION public.user_has_premium_access()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.premium_users pu
    JOIN auth.users u ON lower(u.email) = lower(pu.email)
    WHERE u.id = auth.uid()
      AND pu.is_premium = true
  );
$$;

REVOKE ALL ON FUNCTION public.user_has_premium_access() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_has_premium_access() TO authenticated;

-- vocabulary: replace auth-only policies with premium-aware policies
DROP POLICY IF EXISTS "Users view own vocabulary" ON public.vocabulary;
DROP POLICY IF EXISTS "Users insert own vocabulary" ON public.vocabulary;
DROP POLICY IF EXISTS "Users update own vocabulary" ON public.vocabulary;
DROP POLICY IF EXISTS "Users delete own vocabulary" ON public.vocabulary;

CREATE POLICY "Premium users view own vocabulary"
ON public.vocabulary FOR SELECT
USING (auth.uid() = user_id AND public.user_has_premium_access());

CREATE POLICY "Premium users insert own vocabulary"
ON public.vocabulary FOR INSERT
WITH CHECK (auth.uid() = user_id AND public.user_has_premium_access());

CREATE POLICY "Premium users update own vocabulary"
ON public.vocabulary FOR UPDATE
USING (auth.uid() = user_id AND public.user_has_premium_access())
WITH CHECK (auth.uid() = user_id AND public.user_has_premium_access());

CREATE POLICY "Premium users delete own vocabulary"
ON public.vocabulary FOR DELETE
USING (auth.uid() = user_id AND public.user_has_premium_access());

-- flashcard_progress: replace auth-only policies with premium-aware policies
DROP POLICY IF EXISTS "Users view own flashcard progress" ON public.flashcard_progress;
DROP POLICY IF EXISTS "Users insert own flashcard progress" ON public.flashcard_progress;
DROP POLICY IF EXISTS "Users update own flashcard progress" ON public.flashcard_progress;
DROP POLICY IF EXISTS "Users delete own flashcard progress" ON public.flashcard_progress;

CREATE POLICY "Premium users view own flashcard progress"
ON public.flashcard_progress FOR SELECT
USING (auth.uid() = user_id AND public.user_has_premium_access());

CREATE POLICY "Premium users insert own flashcard progress"
ON public.flashcard_progress FOR INSERT
WITH CHECK (auth.uid() = user_id AND public.user_has_premium_access());

CREATE POLICY "Premium users update own flashcard progress"
ON public.flashcard_progress FOR UPDATE
USING (auth.uid() = user_id AND public.user_has_premium_access())
WITH CHECK (auth.uid() = user_id AND public.user_has_premium_access());

CREATE POLICY "Premium users delete own flashcard progress"
ON public.flashcard_progress FOR DELETE
USING (auth.uid() = user_id AND public.user_has_premium_access());

-- premium_users: restrict reads to the signed-in user's own row
DROP POLICY IF EXISTS "Authenticated users can read premium rows" ON public.premium_users;
DROP POLICY IF EXISTS "Users can read own premium status" ON public.premium_users;

CREATE POLICY "Users can read own premium status"
ON public.premium_users FOR SELECT
TO authenticated
USING (
  lower(email) = lower((
    SELECT u.email FROM auth.users u WHERE u.id = auth.uid()
  ))
);
