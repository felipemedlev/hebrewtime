-- Grain: one best search term per dictionary entry in each returned list.
-- Run after migration 17. Keep historical migrations unchanged.
BEGIN;

-- Explicit prefix bounds let parameterized queries use a B tree index.
CREATE INDEX IF NOT EXISTS dictionary_search_terms_prefix_c_idx
  ON public.dictionary_search_terms (normalized_term COLLATE "C");

CREATE OR REPLACE FUNCTION public.dictionary_search_prefix_upper(value text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
STRICT
PARALLEL SAFE
AS $$
DECLARE
  position integer := char_length(value);
  codepoint integer;
BEGIN
  WHILE position > 0 LOOP
    codepoint := ascii(substr(value, position, 1));
    IF codepoint < 1114111 THEN
      RETURN substr(value, 1, position - 1) || chr(codepoint + 1);
    END IF;
    position := position - 1;
  END LOOP;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.dictionary_search_prefix_upper(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dictionary_search_prefix_upper(text) TO service_role;

CREATE OR REPLACE FUNCTION public.search_dictionary_suggestions_direct(search_query text, result_limit integer DEFAULT 8)
RETURNS TABLE (
  pealim_id integer,
  word text,
  word_with_nekudot text,
  transliteration text,
  part_of_speech text,
  meaning text,
  match_type text,
  matched_text text
)
LANGUAGE sql
STABLE
AS $$
  WITH RECURSIVE query_value AS (
    SELECT public.normalize_dictionary_search(search_query) AS value
  ), query_variants(value, depth) AS (
    SELECT value, 0 FROM query_value
    UNION ALL
    SELECT CASE
      WHEN left(value, 2) = 'מה' AND char_length(value) > 3 THEN substr(value, 3)
      WHEN left(value, 1) IN ('ה', 'ו', 'ב', 'כ', 'ל', 'מ', 'ש') AND char_length(value) > 2 THEN substr(value, 2)
      ELSE ''
    END, depth + 1
    FROM query_variants
    WHERE depth < 3 AND value ~ '^[א-ת]'
      AND (left(value, 1) IN ('ה', 'ו', 'ב', 'כ', 'ל', 'מ', 'ש'))
  ), query_bounds AS MATERIALIZED (
    SELECT qv.value, qv.depth, public.dictionary_search_prefix_upper(qv.value) AS upper_bound
    FROM query_variants qv WHERE qv.value <> ''
  ), term_matches AS (
    SELECT t.pealim_id, t.kind, t.term, t.normalized_term, qv.depth
    FROM query_bounds qv
    JOIN public.dictionary_search_terms t
      ON t.normalized_term COLLATE "C" >= qv.value COLLATE "C"
      AND t.normalized_term COLLATE "C" < qv.upper_bound COLLATE "C"
    UNION ALL
    -- Only the maximum Unicode codepoint has no finite upper bound.
    SELECT t.pealim_id, t.kind, t.term, t.normalized_term, qv.depth
    FROM query_bounds qv
    JOIN public.dictionary_search_terms t
      ON t.normalized_term COLLATE "C" >= qv.value COLLATE "C"
    WHERE qv.upper_bound IS NULL
  ), direct AS (
    SELECT t.pealim_id, t.kind, t.term, t.normalized_term, q.value AS query,
      CASE
        WHEN t.kind = 'headword' AND t.normalized_term = q.value THEN 0
        WHEN t.normalized_term = q.value THEN 1
        WHEN t.kind = 'headword' THEN 2
        WHEN t.kind IN ('form', 'transliteration') THEN 3
        ELSE 4
      END + t.depth * 6 AS rank
    FROM term_matches t
    CROSS JOIN query_value q
  ), best AS (
    SELECT DISTINCT ON (c.pealim_id) c.pealim_id, c.kind, c.term, c.normalized_term, c.rank
    FROM direct c
    ORDER BY c.pealim_id, c.rank,
      CASE WHEN c.kind = 'headword' THEN 0 WHEN c.kind = 'form' THEN 1
        WHEN c.kind = 'transliteration' THEN 2 ELSE 3 END,
      char_length(c.normalized_term), c.normalized_term
  )
  SELECT e.pealim_id, e.word, e.word_with_nekudot, e.transliteration,
    e.part_of_speech, e.meaning,
    CASE
      WHEN b.kind = 'form' THEN 'form'
      WHEN b.kind = 'transliteration' THEN 'transliteration'
      WHEN b.kind = 'gloss' THEN 'gloss'
      ELSE 'headword'
    END AS match_type,
    b.term AS matched_text
  FROM best b
  JOIN public.dictionary_entries e USING (pealim_id)
  ORDER BY b.rank,
    CASE WHEN b.kind = 'headword' THEN 0 WHEN b.kind = 'form' THEN 1
      WHEN b.kind = 'transliteration' THEN 2 ELSE 3 END,
    char_length(e.word), e.word, e.pealim_id
  LIMIT greatest(1, least(result_limit, 20));
$$;


CREATE OR REPLACE FUNCTION public.search_dictionary_suggestions(search_query text, result_limit integer DEFAULT 8)
RETURNS TABLE (
  pealim_id integer,
  word text,
  word_with_nekudot text,
  transliteration text,
  part_of_speech text,
  meaning text,
  match_type text,
  matched_text text
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  normalized_query text := public.normalize_dictionary_search(search_query);
  bounded_limit integer := greatest(1, least(result_limit, 20));
  direct_rows jsonb;
  direct_ids integer[];
  max_distance integer := CASE WHEN char_length(normalized_query) <= 5 THEN 1 ELSE 2 END;
BEGIN
  SELECT coalesce(jsonb_agg(to_jsonb(d)), '[]'::jsonb), coalesce(array_agg(d.pealim_id), '{}'::integer[])
  INTO direct_rows, direct_ids
  FROM public.search_dictionary_suggestions_direct(search_query, bounded_limit) d;

  RETURN QUERY
  SELECT d.pealim_id, d.word, d.word_with_nekudot, d.transliteration,
    d.part_of_speech, d.meaning, d.match_type, d.matched_text
  FROM jsonb_to_recordset(direct_rows) AS d(
    pealim_id integer, word text, word_with_nekudot text, transliteration text,
    part_of_speech text, meaning text, match_type text, matched_text text
  );

  -- No spelling work when direct matches already fill the list.
  IF cardinality(direct_ids) >= bounded_limit
    OR char_length(normalized_query) < 3 OR char_length(normalized_query) > 40
    OR normalized_query LIKE '% %' THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH query_deletes AS MATERIALIZED (
    SELECT unnest(public.dictionary_search_deletes(normalized_query)) AS value
  ), candidates AS MATERIALIZED (
    -- One GIN lookup per key avoids poor overlap estimates for long key arrays.
    SELECT DISTINCT t.pealim_id, t.kind, t.term, t.normalized_term
    FROM query_deletes q
    JOIN LATERAL (
      SELECT indexed.pealim_id, indexed.kind, indexed.term, indexed.normalized_term
      FROM public.dictionary_search_terms indexed
      WHERE indexed.delete_keys @> ARRAY[q.value]
      -- Keep the indexed candidate lookup ahead of length and entry filters.
      OFFSET 0
    ) t ON true
    WHERE char_length(t.normalized_term) BETWEEN char_length(normalized_query) - max_distance
        AND char_length(normalized_query) + max_distance
      AND t.normalized_term <> normalized_query
      AND NOT (t.pealim_id = ANY(direct_ids))
  ), distinct_terms AS MATERIALIZED (
    SELECT DISTINCT c.normalized_term FROM candidates c
  ), verified_terms AS MATERIALIZED (
    -- Shared glosses and forms need only one distance calculation per term.
    SELECT d.normalized_term FROM distinct_terms d
    WHERE public.dictionary_edit_distance(normalized_query, d.normalized_term) <= max_distance
  ), best AS (
    SELECT DISTINCT ON (c.pealim_id) c.pealim_id, c.kind, c.term
    FROM candidates c
    JOIN verified_terms v ON v.normalized_term = c.normalized_term
    ORDER BY c.pealim_id,
      CASE WHEN c.kind = 'headword' THEN 0 WHEN c.kind = 'form' THEN 1
        WHEN c.kind = 'transliteration' THEN 2 ELSE 3 END,
      char_length(c.normalized_term), c.normalized_term
  )
  SELECT e.pealim_id, e.word, e.word_with_nekudot, e.transliteration,
    e.part_of_speech, e.meaning,
    CASE WHEN b.kind = 'form' THEN 'fuzzy_form' ELSE 'fuzzy' END AS match_type,
    b.term AS matched_text
  FROM best b
  JOIN public.dictionary_entries e ON e.pealim_id = b.pealim_id
  ORDER BY
    CASE WHEN b.kind = 'headword' THEN 0 WHEN b.kind = 'form' THEN 1
      WHEN b.kind = 'transliteration' THEN 2 ELSE 3 END,
    char_length(e.word), e.word, e.pealim_id
  LIMIT bounded_limit - cardinality(direct_ids);
END;
$$;

REVOKE ALL ON FUNCTION public.search_dictionary_suggestions_direct(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_dictionary_suggestions_direct(text, integer) TO service_role;
REVOKE ALL ON FUNCTION public.search_dictionary_suggestions(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_dictionary_suggestions(text, integer) TO service_role;

ANALYZE public.dictionary_search_terms;

COMMIT;
