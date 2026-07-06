---
name: Pealim Dictionary Translation Integration
overview: "Replace the pure-OpenAI word lookup with a Pealim-first pipeline: search the new `dictionary_entries` table (with prefix-stripping, conjugated-forms matching, and trigram fuzzy fallback) for the clicked word, use OpenAI only to disambiguate between multiple candidates or as a last-resort full fallback, and add a \"View details\" conjugation-table panel accessible from the translation popup, Vocabulary tab, and Flashcards reveal."
todos:
  - id: migration
    content: Add supabase/dictionary-trgm-migration.sql (pg_trgm extension, trigram index, match_dictionary_word RPC) on top of the already-applied supabase/dictionary-migration.sql, and document both in README.md
    status: completed
  - id: lookup-lib
    content: Create src/lib/dictionaryLookup.ts with niqqud stripping, prefix-candidate generation, headword/forms/trigram matching
    status: completed
  - id: translate-action
    content: Rework translateWord in src/app/actions.ts to try dictionary lookup first, use OpenAI only for homonym disambiguation or as full fallback, and add getDictionaryEntryDetails action
    status: completed
  - id: types
    content: Add DictionaryEntry/DictionaryForm/ConjugationSection types and extend VocabWord in src/lib/types.ts
    status: completed
  - id: details-modal
    content: Build DictionaryDetailsModal.tsx + dictionary-details.css with pivoted conjugation tables, matching existing modal aesthetics
    status: completed
  - id: translation-modal-wiring
    content: Extend TranslationModal.tsx and EpisodeViewer.tsx (ModalState, handleWordClick, handleSave) to carry pronunciation/dictionaryPealimId and open details modal
    status: completed
  - id: vocabulary-wiring
    content: Update useVocabulary.ts to persist/load dictionary_pealim_id and add a details button in VocabularyView.tsx
    status: completed
  - id: flashcards-wiring
    content: Add a details button in FlashcardsView.tsx post-reveal actions, gated on dictionaryPealimId
    status: completed
  - id: i18n
    content: Add new i18n keys across all 6 languages in messages.ts
    status: completed
isProject: false
---

# Pealim Dictionary Translation Integration

## Decisions locked in
- Non-English UI languages: keep lemma/nekudot/transliteration from Pealim; use one small OpenAI call only to translate the trusted Pealim `meaning` gloss into the target language (never to re-derive the lemma).
- Matching order: exact headword → prefix-stripped headword/forms variants → conjugated-forms JSONB containment → Postgres `pg_trgm` similarity fallback → OpenAI (only if nothing found, or to disambiguate when multiple entries tie).
- Daily/anonymous quota logic is unchanged — dictionary-sourced lookups still count the same as today (no premium/business-model change).
- "View details" shows full conjugation tables grouped by `conjugation_sections`, mirroring pealim.com layout.

## 1. Database migration
[supabase/dictionary-migration.sql](supabase/dictionary-migration.sql) already exists (added by the user, applied to the live project) and covers: `dictionary_entries` table, its four base indexes, RLS with an `authenticated` SELECT-all policy, and `vocabulary.dictionary_pealim_id` (FK, `ON DELETE SET NULL`, with its own index). No changes needed there.

New file **`supabase/dictionary-trgm-migration.sql`** adds only the fuzzy-matching piece decided above:
- `CREATE EXTENSION IF NOT EXISTS pg_trgm;`
- `CREATE INDEX IF NOT EXISTS dictionary_entries_word_trgm_idx ON public.dictionary_entries USING gin (word gin_trgm_ops);`
- A small SQL function `match_dictionary_word(search_word text)` returning rows from `dictionary_entries` ordered by `similarity(word, search_word) DESC` where `similarity(word, search_word) > 0.4`, `LIMIT 5` — called via `supabase.rpc()` as the last pre-OpenAI step. `SECURITY DEFINER` not required since it only reads a publicly-readable-by-service-role table and is called from the server.
- Document this new file in `README.md`'s Supabase setup section (mirrors how `fsrs-migration.sql` etc. are documented), noting it's an incremental add-on to the already-applied `dictionary-migration.sql`.

## 2. Dictionary lookup module — new `src/lib/dictionaryLookup.ts`
Server-only helper (imported by `actions.ts`), using the existing `supabaseAdmin` client:

- `stripNiqqud(s)` — strip `[\u0591-\u05C7]`.
- `generatePrefixCandidates(word)` — build candidates by removing 0–3 leading chars while every removed char is in `['ה','ו','ב','כ','ל','מ','ש']`, ordered least-to-most stripped (try the word as typed first).
- `findDictionaryCandidates(word): Promise<DictionaryEntry[]>`:
  1. For each candidate (in order), query `dictionary_entries` where `word = candidate` (`select("*")`, prefer rows with populated `forms`/higher `forms` length when several rows share a `word`).
  2. If still empty for that candidate, query via forms containment: `.filter("forms", "cs", JSON.stringify([{ hebrew_plain: candidate }]))`.
  3. Stop iterating candidates as soon as any query for a candidate returns ≥1 row — collect all rows from that step (could be >1 distinct `pealim_id` = homonyms).
  4. If nothing found after all candidates, run one `pg_trgm` fuzzy pass: `ILIKE`/`similarity()` ordering via an RPC (add a small `match_dictionary_word(word text)` SQL function in the migration that returns rows ordered by `similarity(word, $1) desc limit 5` where `similarity > 0.4`), used as the final pre-OpenAI step.
  5. Return the resolved list of unique-by-`pealim_id` entries (empty array if nothing matched at all).

## 3. Rework `translateWord` in `src/app/actions.ts` (lines 383–535)
Keep all existing guards (auth, rate limit, daily cap, input clamping) untouched. Replace the "always call OpenAI" body with:

1. Call `findDictionaryCandidates(safeWord)`.
2. **Zero candidates** → run the existing OpenAI prompt/flow exactly as today (unchanged fallback), return the same shape as now plus `source: "openai"`, `dictionaryPealimId: null`.
3. **One candidate** → build the result directly from the entry (no lemma-guessing OpenAI call):
   - `lemmaWord = entry.word`
   - `wordWithNekudot = entry.word_with_nekudot`
   - `verbFormWithNekudot = entry.part_of_speech.startsWith("Verb") ? entry.word_with_nekudot : null`
   - `pronunciation = entry.transliteration` (maps to the existing, currently-unused `VocabWord.pronunciation` field — no new column needed)
   - `translation`: if `lang === "en"`, use `entry.meaning` directly; otherwise call OpenAI with a tiny, tightly-scoped prompt ("translate this exact English gloss to {lang}, no extra words") — much lower error surface than full lemma+grammar generation.
   - `dictionaryPealimId = entry.pealim_id`, `partOfSpeech = entry.part_of_speech`, `source: "dictionary"`.
4. **Multiple candidates** (homonyms) → call OpenAI once with the clicked word, sentence context, and the compact candidate list (`pealim_id`, `meaning`, `part_of_speech` per candidate) asking it to return the best-matching `pealim_id`; then treat that as the "one candidate" case above. If OpenAI fails/returns an invalid id, default to the first candidate.
5. Increment the existing daily-cap RPC in all three branches (dictionary-hit, disambiguated, and OpenAI-fallback) exactly like today, per the "keep gating" decision.

Extend the return type (still returned as a plain object, matching current untyped style) with: `dictionaryPealimId: number | null`, `partOfSpeech: string | null`, `pronunciation: string | null`, `source: "dictionary" | "openai"`.

## 4. New server action — `getDictionaryEntryDetails(pealimId)` in `actions.ts`
Lazy-loaded (only fetched when the user opens "View details", same pattern as `generateExamplePhrases`). Returns the full row (`word_with_nekudot`, `transliteration`, `audio_url`, `root`, `part_of_speech`, `pos_detail`, `meanings`, `notes`, `conjugation_sections`, `forms`) via `supabaseAdmin`, with basic input validation (integer id) — no OpenAI, no rate limit needed since it's a cheap read-only DB call, but keep it behind `"use server"` + simple guard against non-numeric input.

## 5. Types — `src/lib/types.ts`
Add (per docs' suggested TypeScript types):
```ts
export type DictionaryForm = { form_id: string; hebrew_with_nekudot: string; hebrew_plain: string; transliteration: string | null; meaning: string | null; audio_url: string | null; row_label: string | null; column_label: string | null; section_title: string | null; section_subtitle: string | null; /* ...person/gender/number/tense/state/voice/form_type/aux_forms */ };
export type ConjugationSection = { title: string; subtitle: string | null; form_ids: string[] };
export type DictionaryEntry = { pealim_id: number; word: string; word_with_nekudot: string; transliteration: string | null; audio_url: string | null; root: string | null; part_of_speech: string; pos_detail: string | null; meaning: string; meanings: string[]; notes: string[]; conjugation_sections: ConjugationSection[]; forms: DictionaryForm[] };
```
Extend `VocabWord` with `dictionaryPealimId?: number | null` and `partOfSpeech?: string | null`.

## 6. New shared UI — `src/components/DictionaryDetailsModal.tsx`
A second modal (opened on top of / instead of the translation modal), following `modal-overlay`/`modal-content` classes from `modals.css` for consistent aesthetics, sized larger (e.g. `max-width: 640px`, scrollable body):
- Header: `word_with_nekudot` (font-serif, RTL, `--accent`), `transliteration` under it, small pill for `part_of_speech`/`root`, speaker icon button that plays `audio_url` (native `<audio>`).
- Body: all `meanings` as a list, then for each `conjugation_sections` entry, render a titled section (`title` + `subtitle`) containing a pivoted table: rows = distinct `row_label` values (in first-seen order) among that section's forms, columns = distinct `column_label` values; each cell shows `hebrew_with_nekudot` (serif, RTL) with `transliteration` as small muted text underneath, and a tiny inline play icon using that form's `audio_url` if present.
- Loading state while `getDictionaryEntryDetails` resolves (spinner, matches `translating-state` styling); lazy-fetched only when opened, cached in local state per pealim_id so reopening doesn't refetch.
- New stylesheet `src/app/styles/dictionary-details.css`, imported from `globals.css` after `example-phrases.css`, reusing existing CSS custom properties (`--surface`, `--radius-*`, `--border`, `--accent`, `--text-muted`, `--space-*`) — no new design tokens.

## 7. Wire into `TranslationModal.tsx` + `EpisodeViewer.tsx`
- `ModalState` (EpisodeViewer, lines 37–47) gains `dictionaryPealimId`, `partOfSpeech`, `pronunciation` (populated from the new `translateWord` return fields in `handleWordClick`, lines 282–289).
- `TranslationModal` props gain `pronunciation`, `dictionaryPealimId`, and `onOpenDetails`. Show transliteration under the translation text; show a "View conjugations" button (only when `dictionaryPealimId` is set) that opens `DictionaryDetailsModal`.
- `handleSave` (lines 299–316) passes `dictionaryPealimId` and the resolved `pronunciation` through to `onWordSaved`, so it reaches `useVocabulary.addWord`.

## 8. `useVocabulary.ts` updates
- Map `dictionary_pealim_id` in the `select("*")` load (line ~34) to `dictionaryPealimId`.
- Include `dictionary_pealim_id: word.dictionaryPealimId ?? null` in the `insert` (around line 87–98).
- `updateWord`'s snake_case mapping doesn't need to change (dictionary link isn't user-editable).

## 9. `VocabularyView.tsx` — details entry point
Add a new icon button (e.g. `Info`/`BookOpen` from `lucide-react`) beside the existing `examples` action button (both desktop row `vtd-actions` and mobile `vocab-card-actions`), rendered only when `vw.dictionaryPealimId` is truthy, opening `DictionaryDetailsModal` for that word (local `detailsWordId` state, similar to `expandedId`).

## 10. `FlashcardsView.tsx` — details after reveal
In the post-reveal actions block (after `isFlipped` becomes true, lines 401–426), add a details button next to the examples toggle (only when `currentWord.dictionaryPealimId` is set), opening the same `DictionaryDetailsModal` for `reviewQueue[currentIndex].vocabWord`.

## 11. i18n — `src/lib/i18n/messages.ts`
Add keys for all 6 languages: `viewConjugations`, `wordDetails`, `transliteration`, `meanings`, `playAudio`, `close` (already exists), loading label reuse (`translating` or new `loadingDetails`). Pealim's own section/POS labels (`Active forms`, `Verb – pa'al`, etc.) stay in English as sourced dictionary content, consistent with how `meaning`/`part_of_speech` are already English-only technical data.

## Todos
