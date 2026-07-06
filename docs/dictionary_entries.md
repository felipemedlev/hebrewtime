# `dictionary_entries` — Hebrew Dictionary Reference

Canonical Hebrew dictionary data scraped and stored in Supabase. Use this table to look up words, meanings, audio, and inflected/conjugated forms when building flashcards, search, conjugation drills, or linking user vocabulary to a shared reference.

**Current scale (as of last scrape):** ~9,283 entries, ~177 distinct `part_of_speech` values, and tens of thousands of individual forms across verbs, nouns, adjectives, prepositions, and more.

---

## Quick start

### Apply the schema

Run the migration in [`supabase/dictionary-migration.sql`](../supabase/dictionary-migration.sql) in the Supabase SQL Editor.

### Read from a client app

Authenticated users can `SELECT` from this table (see [Access control](#access-control)). Example with `@supabase/supabase-js`:

```typescript
const { data, error } = await supabase
  .from("dictionary_entries")
  .select("pealim_id, word, word_with_nekudot, meaning, part_of_speech, forms")
  .eq("word", "אבא")
  .limit(5);
```

### Link user vocabulary to the dictionary

The migration adds an optional foreign key on `vocabulary.dictionary_pealim_id → dictionary_entries.pealim_id`. Store the canonical `pealim_id` when a user saves a word so you can hydrate full conjugation data later.

---

## Table schema

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `pealim_id` | `INTEGER` | NO | **Primary key.** Stable ID from pealim.com (also appears in the URL). |
| `slug` | `TEXT` | NO | URL slug (e.g. `aba` for אַבָּא). |
| `url` | `TEXT` | NO | Canonical source URL. **Unique.** |
| `word` | `TEXT` | NO | Hebrew surface form **without** niqqud (vowel points). |
| `word_with_nekudot` | `TEXT` | NO | Hebrew with full niqqud. |
| `transliteration` | `TEXT` | YES | Latin transliteration of the headword. |
| `audio_url` | `TEXT` | YES | MP3 URL for headword pronunciation (`audio.pealim.com`). |
| `root` | `TEXT` | YES | Shoresh in spaced form, e.g. `א - ב - ד`. |
| `part_of_speech` | `TEXT` | NO | POS label from pealim (often includes binyan or morphological pattern). |
| `pos_detail` | `TEXT` | YES | Sub-detail when parsed from POS, e.g. `pa'al` from `Verb – pa'al`. |
| `meaning` | `TEXT` | NO | Primary English gloss (comma-separated when multiple). |
| `meanings` | `TEXT[]` | NO | Same glosses split into an array. |
| `notes` | `TEXT[]` | NO | Grammar/usage notes from the detail page. |
| `conjugation_sections` | `JSONB` | NO | Section metadata grouping forms (see below). Default `[]`. |
| `forms` | `JSONB` | NO | Array of inflected/conjugated forms (see below). Default `[]`. |
| `see_also_ids` | `INTEGER[]` | NO | Related `pealim_id` values from “See also” links. |
| `scraped_at` | `TIMESTAMPTZ` | NO | Last upsert timestamp. Default `NOW()`. |

### Indexes

| Index | Columns | Purpose |
|-------|---------|---------|
| Primary key | `pealim_id` | Look up by canonical ID |
| `dictionary_entries_word_idx` | `word` | Search without niqqud |
| `dictionary_entries_word_nekudot_idx` | `word_with_nekudot` | Search with niqqud |
| `dictionary_entries_pos_idx` | `part_of_speech` | Filter by POS / binyan |
| `dictionary_entries_forms_gin_idx` | `forms` (GIN) | JSON containment queries on forms |

---

## Row lifecycle

Entries are populated in two stages by the scraper (`pealim/scraper.py`):

1. **List scrape** — Basic fields from dictionary index pages: `word`, `meaning`, `part_of_speech`, etc. `forms` and `conjugation_sections` are empty.
2. **Detail scrape** — Full conjugation/inflection tables parsed from each word’s detail page. The same row is upserted with populated `forms` and `conjugation_sections`.

Upserts use `pealim_id` as the conflict key. A row with empty `forms` is a list-only record awaiting (or missing) detail extraction.

---

## `part_of_speech` values

`part_of_speech` is stored exactly as pealim labels it. Common patterns:

| Pattern | Examples |
|---------|----------|
| Bare category | `Noun`, `Adjective`, `Adverb`, `Preposition`, `Pronoun`, `Conjunction`, `Interjection`, `Particle` |
| Verb + binyan | `Verb – PA'AL`, `Verb – PI'EL`, `Verb – HIF'IL`, `Verb – HITPA'EL`, `Verb – NIF'AL`, `Verb – HUF'AL`, `Verb – PU'AL` (also lowercase variants like `Verb – pa'al`) |
| Noun + gender/pattern | `Noun – masculine`, `Noun – feminine`, `Noun – kittul pattern , masculine`, … |
| Adjective + pattern | `Adjective – katul pattern`, `Adjective – masculine`, … |

`pos_detail` holds the substring after `–` when present (e.g. `pa'al` for `Verb – pa'al`). For bare labels like `Noun`, `pos_detail` is `null`.

There are **177** distinct POS strings in the current dataset. Filter with exact match or `ILIKE` prefix (e.g. `part_of_speech LIKE 'Verb%'`).

---

## `conjugation_sections` structure

Array of section objects that mirror the headings on the pealim detail page. Each section lists which `form_id` values belong to it.

```json
[
  {
    "title": "Active forms",
    "subtitle": "Binyan Hif'il",
    "form_ids": ["AP-ms", "AP-fs", "PERF-1s", "IMPF-1s", "INF-L"]
  },
  {
    "title": "Passive forms",
    "subtitle": "Binyan Huf'al",
    "form_ids": ["passive-AP-ms", "passive-PERF-1s"]
  }
]
```

| Field | Type | Description |
|-------|------|-------------|
| `title` | `string` | Section heading, e.g. `Active forms`, `Inflection`, `Forms with pronominal affixes`. |
| `subtitle` | `string \| null` | Secondary label, often binyan name or empty. |
| `form_ids` | `string[]` | Ordered list of `form_id` values; join to `forms[]` on `form_id`. |

**Common section titles**

| Title | Typical content |
|-------|-----------------|
| `Active forms` | Verb conjugation (active voice) |
| `Passive forms` | Verb conjugation (passive voice) |
| `Inflection` | Noun state/number, adjective gender/number |
| `Forms with pronominal affixes` | Preposition/adverb + suffix pronouns |
| `Forms without pronominal affixes` | Base forms before pronominal paradigms |
| `Form without pronominal affixes` | Singular variant of the above (legacy label) |
| `Personal pronouns` | Pronoun paradigms |

---

## `forms` structure

Each element is one cell from a pealim conjugation/inflection table.

```json
{
  "form_id": "PERF-2mp",
  "hebrew_with_nekudot": "הֶאֱבַדְתֶּם",
  "hebrew_plain": "האבדתם",
  "transliteration": "he'evadetem",
  "meaning": "you m. pl. destroyed",
  "audio_url": "https://audio.pealim.com/v0/1a/1ah5fss2bn3vs.mp3",
  "row_label": "Past tense / 2nd",
  "column_label": "Plural / Masculine",
  "section_title": "Active forms",
  "section_subtitle": "Binyan Hif'il",
  "person": 2,
  "gender": "masculine",
  "number": "plural",
  "tense": "past",
  "state": null,
  "voice": "active",
  "form_type": "verb",
  "aux_forms": []
}
```

### Form fields

| Field | Type | Description |
|-------|------|-------------|
| `form_id` | `string` | Stable ID from pealim HTML `div[id]`; encodes tense/person/gender (see [Form ID reference](#form-id-reference)). |
| `hebrew_with_nekudot` | `string` | Form with niqqud. |
| `hebrew_plain` | `string` | Form without niqqud (derived by stripping Unicode marks U+0591–U+05C7). |
| `transliteration` | `string \| null` | Latin transliteration. |
| `meaning` | `string \| null` | English gloss for this specific form. |
| `audio_url` | `string \| null` | MP3 pronunciation URL. |
| `row_label` | `string \| null` | Raw table row header from pealim (e.g. `Past tense / 2nd`). |
| `column_label` | `string \| null` | Raw table column header (e.g. `Plural / Masculine`). |
| `section_title` | `string \| null` | Parent section title (duplicated for convenience). |
| `section_subtitle` | `string \| null` | Parent section subtitle. |
| `person` | `integer \| null` | Grammatical person: `1`, `2`, or `3`. |
| `gender` | `string \| null` | `"masculine"` or `"feminine"`. |
| `number` | `string \| null` | `"singular"` or `"plural"`. |
| `tense` | `string \| null` | `"present"`, `"past"`, `"future"`, `"imperative"`, or `"infinitive"`. |
| `state` | `string \| null` | `"absolute"` or `"construct"` (nouns). |
| `voice` | `string \| null` | `"active"` or `"passive"` (verbs). |
| `form_type` | `string \| null` | High-level category (see below). |
| `aux_forms` | `array` | Alternate pronunciations/spellings (see below). |

### `form_type` values

| Value | Used for |
|-------|----------|
| `verb` | Finite verb forms and participles |
| `infinitive` | Infinitive forms (`INF-*`) |
| `noun` | Noun number/state (`s`, `p`, `sc`, `pc`) |
| `adjective` | Gender/number pairs (`ms-a`, `fs-a`, …) |
| `pronominal` | Preposition/adverb + pronominal suffixes |
| `numeral` | Cardinal numerals (`a-m`, `c-f`, …) |

### `aux_forms` (alternate realizations)

Some verb cells include a secondary pronunciation (often related to pause position or optional realization). Each aux entry:

```json
{
  "note": null,
  "hebrew_with_nekudot": "הֶאֱבַדְתֶּם",
  "hebrew_plain": "האבדתם",
  "transliteration": "he'evadetem",
  "audio_url": "https://audio.pealim.com/v0/1a/1ah5ft042ecas.mp3"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `note` | `string \| null` | Inline note text preceding the alternate form. |
| `hebrew_with_nekudot` | `string` | Alternate spelling with niqqud. |
| `hebrew_plain` | `string` | Alternate without niqqud. |
| `transliteration` | `string \| null` | Transliteration of the alternate. |
| `audio_url` | `string \| null` | Audio for the alternate. |

---

## Form ID reference

`form_id` values come directly from pealim.com and are parsed into structured metadata by `infer_form_metadata()` in `pealim/parsers.py`. Understanding the ID format helps when filtering forms without relying on `row_label` text.

### Verbs

Prefix indicates tense; suffix indicates person/gender/number.

| Prefix | Tense | Suffix examples |
|--------|-------|-----------------|
| `AP` | present (participle) | `ms`, `fs`, `mp`, `fp` |
| `PERF` | past | `1s`, `2ms`, `3p`, … |
| `IMPF` | future | `1s`, `2fp`, `3ms`, … |
| `IMP` | imperative | `2ms`, `2fs`, `2mp`, `2fp` (always 2nd person) |
| `INF` | infinitive | `L` (leading ל), `B` (bare) |

Passive verbs prefix the ID with `passive-` (e.g. `passive-PERF-3ms`). `voice` is set to `"passive"`.

**Examples:** `AP-ms`, `PERF-1p`, `IMPF-3fs`, `IMP-2mp`, `INF-L`, `passive-AP-fp`

### Nouns

| ID | Number | State |
|----|--------|-------|
| `s` | singular | absolute |
| `p` | plural | absolute |
| `sc` | singular | construct |
| `pc` | plural | construct |

### Adjectives

Pattern: `{gender_number}-a` where gender/number is `ms`, `fs`, `mp`, or `fp`.

**Examples:** `ms-a`, `fs-a`, `mp-a`, `fp-a`

### Pronominal suffixes (prepositions, adverbs, some nouns)

Pattern: `P-{person}{gender_number}` — e.g. `P-1s`, `P-2mp`, `P-3fp`.

Extended noun pattern with state: `{s|p|sc|pc}-P-{suffix}` — e.g. `s-P-1s`.

### Cardinal numerals

Pattern: `{a|c}-{m|f}` — absolute/construct + masculine/feminine.

**Examples:** `a-m`, `c-f`

---

## Example records by word type

### Noun (`pealim_id: 4845` — אַבָּא)

```json
{
  "pealim_id": 4845,
  "word": "אבא",
  "word_with_nekudot": "אַבָּא",
  "part_of_speech": "Noun",
  "meaning": "dad, father",
  "meanings": ["dad", "father"],
  "see_also_ids": [6009, 2664, 4844],
  "forms": [
    {
      "form_id": "s",
      "hebrew_plain": "אבא",
      "number": "singular",
      "state": "absolute",
      "form_type": "noun"
    }
  ]
}
```

### Verb (`pealim_id: 6074` — לְהַאֲבִיד, HIF'IL)

Includes ~51 forms across active (`Binyan Hif'il`) and passive (`Binyan Huf'al`) sections. Present, past, future, imperative, and infinitive are all represented.

### Adjective (`pealim_id: 9098` — אֲבִיבִי)

Four inflection forms: masculine/feminine × singular/plural (`ms-a`, `fs-a`, `mp-a`, `fp-a`).

### Preposition / adverb with pronominal suffixes

Ten forms `P-1s` … `P-3fp` under `Form without pronominal affixes` or `Forms with pronominal affixes`.

### List-only entry (detail not yet scraped)

```json
{
  "pealim_id": 56,
  "word": "לאבוד",
  "part_of_speech": "Verb – pa'al",
  "pos_detail": "pa'al",
  "meaning": "to be lost, to stray, to perish",
  "forms": [],
  "conjugation_sections": []
}
```

Treat `forms.length === 0` as “headword metadata only.”

---

## Query patterns

### Lookup by plain Hebrew

```sql
SELECT * FROM dictionary_entries
WHERE word = 'אבא';
```

### Prefix search (no niqqud)

```sql
SELECT pealim_id, word, meaning, part_of_speech
FROM dictionary_entries
WHERE word LIKE 'אב%'
ORDER BY word
LIMIT 20;
```

### All verbs in a binyan

```sql
SELECT pealim_id, word, meaning
FROM dictionary_entries
WHERE part_of_speech ILIKE 'Verb – HIF''IL%';
```

### Find entries containing a specific conjugated form

Uses the GIN index on `forms`:

```sql
SELECT pealim_id, word, meaning
FROM dictionary_entries
WHERE forms @> '[{"hebrew_plain": "האבדתם"}]';
```

### Get one form from an entry (application code)

```typescript
function getForm(entry: DictionaryEntry, formId: string) {
  return entry.forms.find((f) => f.form_id === formId);
}

function formsInSection(entry: DictionaryEntry, sectionTitle: string) {
  const section = entry.conjugation_sections.find((s) => s.title === sectionTitle);
  if (!section) return [];
  const ids = new Set(section.form_ids);
  return entry.forms.filter((f) => ids.has(f.form_id));
}
```

### Resolve “see also” links

```sql
SELECT e.*, related.word AS related_word, related.meaning AS related_meaning
FROM dictionary_entries e
CROSS JOIN LATERAL unnest(e.see_also_ids) AS rid
JOIN dictionary_entries related ON related.pealim_id = rid;
```

---

## Access control

Row Level Security is enabled. Current policy:

- **Role:** `authenticated`
- **Operation:** `SELECT` only
- **Rule:** all rows readable (`USING (true)`)

Writes are performed by the scraper using `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS). Client apps should not expose the service role key.

To allow anonymous read access (e.g. public dictionary widget), add a separate `SELECT` policy for the `anon` role.

---

## TypeScript types (suggested)

```typescript
export interface DictionaryEntry {
  pealim_id: number;
  slug: string;
  url: string;
  word: string;
  word_with_nekudot: string;
  transliteration: string | null;
  audio_url: string | null;
  root: string | null;
  part_of_speech: string;
  pos_detail: string | null;
  meaning: string;
  meanings: string[];
  notes: string[];
  conjugation_sections: ConjugationSection[];
  forms: DictionaryForm[];
  see_also_ids: number[];
  scraped_at: string;
}

export interface ConjugationSection {
  title: string;
  subtitle: string | null;
  form_ids: string[];
}

export interface DictionaryForm {
  form_id: string;
  hebrew_with_nekudot: string;
  hebrew_plain: string;
  transliteration: string | null;
  meaning: string | null;
  audio_url: string | null;
  row_label: string | null;
  column_label: string | null;
  section_title: string | null;
  section_subtitle: string | null;
  person: 1 | 2 | 3 | null;
  gender: "masculine" | "feminine" | null;
  number: "singular" | "plural" | null;
  tense: "present" | "past" | "future" | "imperative" | "infinitive" | null;
  state: "absolute" | "construct" | null;
  voice: "active" | "passive" | null;
  form_type: "verb" | "infinitive" | "noun" | "adjective" | "pronominal" | "numeral" | null;
  aux_forms: AuxForm[];
}

export interface AuxForm {
  note: string | null;
  hebrew_with_nekudot: string;
  hebrew_plain: string;
  transliteration: string | null;
  audio_url: string | null;
}
```

---

## Integration notes

### Niqqud handling

- `word` / `hebrew_plain` strip niqqud and cantillation (Unicode U+0591–U+05C7).
- Use plain forms for search, matching, and deduplication.
- Use `*_with_nekudot` fields for display and TTS alignment.

### Audio URLs

URLs point to `https://audio.pealim.com/...` and are hotlinked from pealim. They are stable per form but hosted externally; cache locally if you need offline or long term guarantees.

### Data provenance

- Canonical ID: always `pealim_id` (integer), not `slug` alone (slugs are unique in practice but `pealim_id` is the primary key).
- Upsert key: `pealim_id` (`ON CONFLICT (pealim_id)`).

### Relationship to `vocabulary`

| `vocabulary` column | Maps to |
|---------------------|---------|
| `dictionary_pealim_id` | `dictionary_entries.pealim_id` |
| `word` | Often matches `dictionary_entries.word` |
| `word_with_nekudot` | Often matches headword or a specific `forms[].hebrew_with_nekudot` |
| `verb_form_with_nekudot` | Typically a single conjugated form from `forms[]` |

When saving vocabulary from an episode, store `dictionary_pealim_id` plus the specific `form_id` (in app metadata) if the user saved a conjugated form rather than the lemma.
