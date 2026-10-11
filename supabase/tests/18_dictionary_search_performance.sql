-- Run after migrations 17 and 18 in a disposable database.
BEGIN;

INSERT INTO public.dictionary_entries (
  pealim_id, slug, url, word, word_with_nekudot, transliteration,
  part_of_speech, meaning, forms
)
SELECT 2147100000 + n, 'search-speed-fixture-' || n,
  'https://example.invalid/search-speed-fixture-' || n,
  'סמןמהירות' || n, 'סמןמהירות' || n, 'speedfixture' || n,
  'Noun', 'speedfixture', '[]'::jsonb
FROM generate_series(1, 10) n;

DO $$
DECLARE
  direct_ids integer[];
  complete_ids integer[];
BEGIN
  SELECT array_agg(d.pealim_id) INTO direct_ids
  FROM public.search_dictionary_suggestions_direct('speedfixture', 8) d;
  SELECT array_agg(d.pealim_id) INTO complete_ids
  FROM public.search_dictionary_suggestions('speedfixture', 8) d;
  IF cardinality(direct_ids) <> 8 OR direct_ids IS DISTINCT FROM complete_ids THEN
    RAISE EXCEPTION 'Expected identical ordered direct and complete results when the list is full';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.search_dictionary_suggestions_direct('speedfixtuer', 8)
    WHERE match_type IN ('fuzzy', 'fuzzy_form')
  ) THEN
    RAISE EXCEPTION 'Direct search must never calculate spelling matches';
  END IF;
  IF public.dictionary_search_prefix_upper('שלום') IS DISTINCT FROM 'שלומ'
    OR public.dictionary_search_prefix_upper('test') IS DISTINCT FROM 'tesu' THEN
    RAISE EXCEPTION 'Invalid prefix bound';
  END IF;
  IF has_function_privilege('authenticated', 'public.search_dictionary_suggestions_direct(text,integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Direct dictionary RPC must not be public';
  END IF;
END;
$$;

-- Prove that the full list branch does not evaluate edit distance at all.
CREATE OR REPLACE FUNCTION public.dictionary_edit_distance(left_value text, right_value text)
RETURNS integer LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE AS $$
BEGIN
  RAISE EXCEPTION 'Unexpected spelling work';
END;
$$;

SELECT pealim_id FROM public.search_dictionary_suggestions('speedfixture', 8);
SELECT pealim_id FROM public.search_dictionary_suggestions_direct('speedfixtuer', 8);

ROLLBACK;
