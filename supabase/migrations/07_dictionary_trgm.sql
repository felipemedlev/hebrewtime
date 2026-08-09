-- Fuzzy dictionary lookup (pg_trgm) — run after dictionary-migration.sql.
-- Enables trigram similarity search as a last step before OpenAI fallback.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS dictionary_entries_word_trgm_idx
  ON public.dictionary_entries USING gin (word gin_trgm_ops);

CREATE OR REPLACE FUNCTION public.match_dictionary_word(search_word text)
RETURNS SETOF public.dictionary_entries
LANGUAGE sql
STABLE
AS $$
  SELECT *
  FROM public.dictionary_entries
  WHERE similarity(word, search_word) > 0.4
  ORDER BY similarity(word, search_word) DESC
  LIMIT 5;
$$;

REVOKE ALL ON FUNCTION public.match_dictionary_word(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_dictionary_word(text) TO service_role;
