-- Search terms for fast dictionary suggestions, including inflections and typos.
CREATE OR REPLACE FUNCTION public.normalize_dictionary_search(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT trim(regexp_replace(
    regexp_replace(
      lower(regexp_replace(
        regexp_replace(normalize(coalesce(value, ''), NFKC), '[֑-ׇ]', '', 'g'),
        '[’‘ʼ＇‐‑‒–—―−﹘﹣⁃־״׳]', ' ', 'g'
      )),
      '[[:punct:]]+', ' ', 'g'
    ),
    '\s+', ' ', 'g'
  ));
$$;

CREATE OR REPLACE FUNCTION public.dictionary_edit_distance(left_value text, right_value text)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
AS $$
DECLARE
  left_len integer := char_length(left_value);
  right_len integer := char_length(right_value);
  matrix integer[][];
  i integer;
  j integer;
  substitution_cost integer;
BEGIN
  IF left_value = right_value THEN RETURN 0; END IF;
  IF left_len = 0 THEN RETURN right_len; END IF;
  IF right_len = 0 THEN RETURN left_len; END IF;

  matrix := array_fill(0, ARRAY[left_len + 1, right_len + 1]);
  FOR i IN 0..left_len LOOP matrix[i + 1][1] := i; END LOOP;
  FOR j IN 0..right_len LOOP matrix[1][j + 1] := j; END LOOP;
  FOR i IN 1..left_len LOOP
    FOR j IN 1..right_len LOOP
      substitution_cost := CASE WHEN substr(left_value, i, 1) = substr(right_value, j, 1) THEN 0 ELSE 1 END;
      matrix[i + 1][j + 1] := least(
        matrix[i][j + 1] + 1,
        matrix[i + 1][j] + 1,
        matrix[i][j] + substitution_cost
      );
      IF i > 1 AND j > 1
        AND substr(left_value, i, 1) = substr(right_value, j - 1, 1)
        AND substr(left_value, i - 1, 1) = substr(right_value, j, 1) THEN
        matrix[i + 1][j + 1] := least(matrix[i + 1][j + 1], matrix[i - 1][j - 1] + 1);
      END IF;
    END LOOP;
  END LOOP;
  RETURN matrix[left_len + 1][right_len + 1];
END;
$$;

CREATE OR REPLACE FUNCTION public.dictionary_search_deletes(value text)
RETURNS text[]
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
AS $$
DECLARE
  result text[];
  candidate text;
  i integer;
  j integer;
BEGIN
  IF value IS NULL OR value = '' OR value LIKE '% %' OR char_length(value) > 40 THEN
    RETURN ARRAY[]::text[];
  END IF;

  result := ARRAY[value];
  FOR i IN 1..char_length(value) LOOP
    candidate := substr(value, 1, i - 1) || substr(value, i + 1);
    result := array_append(result, candidate);
  END LOOP;

  IF char_length(value) > 1 THEN
    FOR i IN 1..char_length(value) LOOP
      FOR j IN i + 1..char_length(value) LOOP
        candidate := substr(value, 1, i - 1)
          || substr(value, i + 1, j - i - 1)
          || substr(value, j + 1);
        result := array_append(result, candidate);
      END LOOP;
    END LOOP;
  END IF;

  SELECT array_agg(DISTINCT item) INTO result FROM unnest(result) AS item;
  RETURN coalesce(result, ARRAY[]::text[]);
END;
$$;

REVOKE ALL ON FUNCTION public.normalize_dictionary_search(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dictionary_edit_distance(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dictionary_search_deletes(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.normalize_dictionary_search(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.dictionary_edit_distance(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.dictionary_search_deletes(text) TO service_role;

CREATE TABLE IF NOT EXISTS public.dictionary_search_terms (
  pealim_id INTEGER NOT NULL REFERENCES public.dictionary_entries(pealim_id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('headword', 'form', 'transliteration', 'gloss')),
  term TEXT NOT NULL,
  normalized_term TEXT NOT NULL,
  delete_keys TEXT[] NOT NULL DEFAULT '{}',
  PRIMARY KEY (pealim_id, kind, normalized_term)
);

CREATE INDEX IF NOT EXISTS dictionary_search_terms_prefix_idx
  ON public.dictionary_search_terms (normalized_term text_pattern_ops);
CREATE INDEX IF NOT EXISTS dictionary_search_terms_delete_keys_idx
  ON public.dictionary_search_terms USING GIN (delete_keys);
CREATE INDEX IF NOT EXISTS dictionary_search_terms_entry_idx
  ON public.dictionary_search_terms (pealim_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dictionary_search_terms TO service_role;

ALTER TABLE public.dictionary_search_terms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role can read dictionary search terms" ON public.dictionary_search_terms;
CREATE POLICY "Service role can read dictionary search terms"
  ON public.dictionary_search_terms FOR SELECT TO service_role USING (true);

CREATE OR REPLACE FUNCTION public.refresh_dictionary_search_terms(entry_id integer)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM public.dictionary_search_terms WHERE pealim_id = entry_id;

  INSERT INTO public.dictionary_search_terms (pealim_id, kind, term, normalized_term, delete_keys)
  WITH source_terms AS (
    SELECT e.pealim_id, 'headword'::text AS kind, e.word AS term
      FROM public.dictionary_entries e WHERE e.pealim_id = entry_id
    UNION ALL
    SELECT e.pealim_id, 'transliteration', e.transliteration
      FROM public.dictionary_entries e
      WHERE e.pealim_id = entry_id AND nullif(trim(e.transliteration), '') IS NOT NULL
    UNION ALL
    SELECT e.pealim_id, 'form', coalesce(f.value->>'hebrew_plain', f.value->>'hebrew', '')
      FROM public.dictionary_entries e
      CROSS JOIN LATERAL jsonb_array_elements(
        CASE WHEN jsonb_typeof(e.forms) = 'array' THEN e.forms ELSE '[]'::jsonb END
      ) f(value)
      WHERE e.pealim_id = entry_id
    UNION ALL
    SELECT e.pealim_id, 'form', coalesce(a.value->>'hebrew_plain', a.value->>'hebrew', '')
      FROM public.dictionary_entries e
      CROSS JOIN LATERAL jsonb_array_elements(
        CASE WHEN jsonb_typeof(e.forms) = 'array' THEN e.forms ELSE '[]'::jsonb END
      ) f(value)
      CROSS JOIN LATERAL jsonb_array_elements(
        CASE WHEN jsonb_typeof(f.value->'aux_forms') = 'array' THEN f.value->'aux_forms' ELSE '[]'::jsonb END
      ) a(value)
      WHERE e.pealim_id = entry_id
    UNION ALL
    SELECT e.pealim_id, 'gloss', gloss.value
      FROM public.dictionary_entries e
      CROSS JOIN LATERAL regexp_split_to_table(coalesce(e.meaning, ''), '[,;/|]+') AS gloss(value)
      WHERE e.pealim_id = entry_id
    UNION ALL
    SELECT e.pealim_id, 'gloss', token.value
      FROM public.dictionary_entries e
      CROSS JOIN LATERAL regexp_split_to_table(
        public.normalize_dictionary_search(coalesce(e.meaning, '')), ' '
      ) AS token(value)
      WHERE e.pealim_id = entry_id
    UNION ALL
    SELECT e.pealim_id, 'gloss', array_to_string(
        tokens.words[positions.pos:positions.pos + sizes.span - 1], ' '
      )
      FROM public.dictionary_entries e
      CROSS JOIN LATERAL (
        SELECT regexp_split_to_array(
          public.normalize_dictionary_search(coalesce(e.meaning, '')), ' '
        ) AS words
      ) tokens
      CROSS JOIN LATERAL generate_series(1, cardinality(tokens.words)) AS positions(pos)
      CROSS JOIN LATERAL generate_series(2, least(4, cardinality(tokens.words))) AS sizes(span)
      WHERE e.pealim_id = entry_id
        AND positions.pos + sizes.span - 1 <= cardinality(tokens.words)
    UNION ALL
    SELECT e.pealim_id, 'gloss', gloss.value
      FROM public.dictionary_entries e
      CROSS JOIN LATERAL unnest(coalesce(e.meanings, ARRAY[]::text[])) AS gloss(value)
      WHERE e.pealim_id = entry_id
    UNION ALL
    SELECT e.pealim_id, 'gloss', token.value
      FROM public.dictionary_entries e
      CROSS JOIN LATERAL unnest(coalesce(e.meanings, ARRAY[]::text[])) AS gloss(value)
      CROSS JOIN LATERAL regexp_split_to_table(
        public.normalize_dictionary_search(gloss.value), ' '
      ) AS token(value)
      WHERE e.pealim_id = entry_id
  ), normalized AS (
    SELECT pealim_id, kind, min(term) AS term, normalized_term
    FROM (
      SELECT pealim_id, kind, term, public.normalize_dictionary_search(term) AS normalized_term
      FROM source_terms
      WHERE nullif(trim(term), '') IS NOT NULL
    ) n
    GROUP BY pealim_id, kind, normalized_term
  )
  SELECT pealim_id, kind, term, normalized_term,
    CASE WHEN char_length(normalized_term) >= 2 AND char_length(normalized_term) <= 40
      THEN public.dictionary_search_deletes(normalized_term) ELSE ARRAY[]::text[] END
  FROM normalized
  WHERE normalized_term <> ''
  ON CONFLICT (pealim_id, kind, normalized_term)
  DO UPDATE SET term = EXCLUDED.term, delete_keys = EXCLUDED.delete_keys;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_dictionary_search_terms()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.dictionary_search_terms WHERE pealim_id = OLD.pealim_id;
    RETURN OLD;
  END IF;

  PERFORM public.refresh_dictionary_search_terms(NEW.pealim_id);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_dictionary_search_terms(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_dictionary_search_terms(integer) TO service_role;

DROP TRIGGER IF EXISTS dictionary_search_terms_sync ON public.dictionary_entries;
CREATE TRIGGER dictionary_search_terms_sync
AFTER INSERT OR UPDATE OF word, word_with_nekudot, transliteration, meaning, meanings, forms
ON public.dictionary_entries
FOR EACH ROW EXECUTE FUNCTION public.sync_dictionary_search_terms();

DO $$
DECLARE
  entry_id integer;
BEGIN
  FOR entry_id IN SELECT pealim_id FROM public.dictionary_entries LOOP
    PERFORM public.refresh_dictionary_search_terms(entry_id);
  END LOOP;
END;
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
  ), direct AS (
    SELECT t.pealim_id, t.kind, t.term, t.normalized_term, q.value AS query,
      CASE
        WHEN t.kind = 'headword' AND t.normalized_term = q.value THEN 0
        WHEN t.normalized_term = q.value THEN 1
        WHEN t.kind = 'headword' THEN 2
        WHEN t.kind IN ('form', 'transliteration') THEN 3
        ELSE 4
      END + qv.depth * 6 AS rank
    FROM query_variants qv
    CROSS JOIN query_value q
    JOIN public.dictionary_search_terms t
      ON t.normalized_term = qv.value OR t.normalized_term LIKE qv.value || '%'
    WHERE qv.value <> ''
  ), fuzzy AS (
    SELECT t.pealim_id, t.kind, t.term, t.normalized_term, q.value AS query, 30 AS rank
    FROM query_value q
    JOIN public.dictionary_search_terms t
      ON t.delete_keys && public.dictionary_search_deletes(q.value)
    WHERE q.value !~ ' ' AND char_length(q.value) >= 3
      AND char_length(t.normalized_term) BETWEEN char_length(q.value) -
        CASE WHEN char_length(q.value) <= 5 THEN 1 ELSE 2 END AND char_length(q.value) +
        CASE WHEN char_length(q.value) <= 5 THEN 1 ELSE 2 END
      AND t.normalized_term <> q.value
      AND public.dictionary_edit_distance(q.value, t.normalized_term) <=
        CASE WHEN char_length(q.value) <= 5 THEN 1 ELSE 2 END
  ), candidates AS (
    SELECT * FROM direct UNION ALL SELECT * FROM fuzzy
  ), best AS (
    SELECT DISTINCT ON (c.pealim_id) c.pealim_id, c.kind, c.term, c.normalized_term, c.rank
    FROM candidates c
    ORDER BY c.pealim_id, c.rank,
      CASE WHEN c.kind = 'headword' THEN 0 WHEN c.kind = 'form' THEN 1
        WHEN c.kind = 'transliteration' THEN 2 ELSE 3 END,
      char_length(c.normalized_term), c.normalized_term
  )
  SELECT e.pealim_id, e.word, e.word_with_nekudot, e.transliteration,
    e.part_of_speech, e.meaning,
    CASE
      WHEN b.rank >= 30 AND b.kind = 'form' THEN 'fuzzy_form'
      WHEN b.rank >= 30 THEN 'fuzzy'
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

REVOKE ALL ON FUNCTION public.search_dictionary_suggestions(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_dictionary_suggestions(text, integer) TO service_role;
