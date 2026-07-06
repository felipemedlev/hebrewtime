# HebrewTime

HebrewTime is a beautiful multilingual web-based reader for the Hebrew Time podcast. It provides an elegant Notion/Apple-like reading experience with side-by-side Hebrew and translated paragraphs. Supported UI and transcript languages: **English**, **Russian**, **Ukrainian**, **Portuguese**, **Spanish**, and **French** (all generated with OpenAI `gpt-5.4-mini`).

The platform supports multiple learning levels — **Beginner** (A1), **Intermediate** (B1 legacy), **Intermediate 2** (B1 generated), and **Advanced** (B2 generated) — each with its own episode series. Beginner, Intermediate 2, and Advanced episodes are AI-generated (~10 minutes each, narrated by a consistent persona) with sentence-level audio highlighting. Legacy Intermediate content comes from the original Hebrew Time podcast.

The application allows Hebrew learners to read podcast transcripts and click on any word to look it up in a **Pealim-backed dictionary** (lemma, Nekudot, transliteration, and meanings from Supabase `dictionary_entries`), with OpenAI used only when no dictionary match is found or to disambiguate homonyms / translate glosses into the user's UI language. Saved words can open full conjugation tables. Example-phrase generation still uses OpenAI. Translation, vocabulary, and flashcards have free-tier daily limits; unlimited access is part of the premium upsell shown in-app.

## Key Features

- **Multi-Level Learning Tracks**: Switch between **Beginner**, **Intermediate**, **Intermediate 2**, and **Advanced** via a dropdown (`LearningTrackSelector`) in the sidebar. Each level has its own numbered episode list with per-level finished counts, resume episode, and progress bar. Vocabulary and flashcards are shared across levels. The selected level persists in local storage (`hebrewtime-level`); last-opened episode per level is stored in `hebrewtime-last-episode-by-level`.
- **Multilingual Interface**: One language preference drives both the full UI (i18n) and the transcript translation shown beside Hebrew. Smooth side-by-side Hebrew + selected language paragraphs.
- **Audio-Synchronized Highlighting**: As the podcast audio plays, the current Hebrew sentence is automatically highlighted and smoothly scrolled into view. Generated tracks (Beginner, Intermediate 2, Advanced) use sentence-level timestamps from the Gemini TTS pipeline. Legacy Intermediate episodes use Whisper alignment via `scripts/lib/alignment.py`, which can produce paragraph-level and sentence-level timings.
- **Focus Mode for Hebrew Reading**: A top-bar toggle lets users blur all transcript translations on demand, so learners can practice Hebrew-first reading. The preference is saved in local storage.
- **Mark Episodes as Finished**: Users can mark episodes they've completed. Finished state is tracked **per level** (`level:episode` keys), synced to Supabase `finished_episodes` with `level_slug` for authenticated users, and stored in local storage. Checkmarks appear in the sidebar and an elegant button at the end of the episode text.
- **Scroll Position Persistence**: The application remembers your exact scroll position when switching between episodes, the vocabulary list, and flashcards, so you never lose your place.
- **Pealim-First Word Lookup**: Click any Hebrew word to translate it in context. Lookup order in `src/lib/dictionaryLookup.ts`:
  1. Exact headword match on `dictionary_entries.word`
  2. Same after stripping up to 3 Hebrew prefixes (ה, ו, ב, כ, ל, מ/מה, ש)
  3. Conjugated-form match via JSONB containment on `forms[].hebrew_plain`
  4. Fuzzy match via Postgres `pg_trgm` (`match_dictionary_word()` RPC)
  5. **OpenAI fallback** (`gpt-5.4-mini`) only when steps 1–4 find nothing, or to pick among homonyms
  - **Dictionary hit**: lemma, Nekudot, transliteration, and English meanings come directly from Pealim data. For non-English UI languages, a small OpenAI call translates the trusted English gloss only (lemma/nekudot are never AI-generated).
  - **Saved lemma rules**: nouns → singular indefinite; verbs → infinitive (e.g. מְדַמְיֵן → `לדמיין`). Translations omit articles ("topic" not "the topic") and infinitive markers ("imagine" not "to imagine").
  - **View conjugations**: when a dictionary match exists, users can open full Pealim conjugation/inflection tables (`DictionaryDetailsModal`) from the translation popup, Vocabulary tab (book icon), or Flashcards after revealing the answer.
  - Available to all users within daily translation limits (logged-out quota in `localStorage`; authenticated non-premium capped server-side). Saving to vocabulary requires login.
- **Premium Vocabulary Manager & Auth**: Users can create an account via Supabase Email Auth (including “Forgot password” recovery). Premium users can save synced vocabulary in Supabase PostgreSQL across devices.
  - Rendered in an elegant, minimal Apple/Notion-style data table on desktop and card layout on mobile. Desktop column order: **Source** (leftmost) → Pronunc. → Translation → Verb form → **Hebrew** (rightmost, for natural RTL reading) → Actions.
  - Supports inline editing of saved words directly on the vocabulary page (Hebrew with Nekudot, verb form, translation, and pronunciation). Pressing **Enter** in any edit field saves the row (same as clicking the ✓ button).
  - On mobile, the Hebrew word is right-aligned and actions sit on the left, preserving the RTL-natural reading flow in a card layout.
  - **Dynamic Search & Filtering**: A responsive search bar instantly filters your vocabulary list as you type. It works seamlessly for saved word meanings (any language), Hebrew words (even without typing specific Nekudot), and pronunciation.
  - Smart deduplication logic allows saving the exact same Hebrew word multiple times if its contextual meaning (translation) or pronunciation (Nekudot) differs.
  - **Dictionary link**: saves from a dictionary hit store `dictionary_pealim_id` (FK to `dictionary_entries`) and Pealim transliteration in `pronunciation`, enabling the conjugation-details modal later.
  - **AI Example Phrases**: Each saved word can reveal 3 AI-generated example sentences (Hebrew with Nekudot + meaning in the user's active UI language) showing everyday usage. Phrases are **not** generated at save-time — the user expands an “Examples” panel (Vocabulary tab) or taps “Show examples” (Flashcards) to trigger generation on first use. Results are cached in `vocabulary.example_phrases` (JSONB) per user per word and load instantly on subsequent views. Any single phrase can be regenerated unlimited times via a per-phrase refresh button. Shared UI lives in `ExamplePhrasesPanel.tsx`; orchestration in `AppShell.tsx` calls `generateExamplePhrases` then persists via `useVocabulary.updateWord`.
- **Top-of-Screen Subscription Upsell (Apple/Notion Style)**: If a non-premium user clicks the Vocabulary tab, Flashcards tab, or tries to translate a word, the app shows a large sticky promo panel with $10/month messaging and a CTA that opens auth/signup.
- **Spaced Repetition Flashcard System (FSRS)**: An elegant, built-in flashcard system designed to help users master their saved vocabulary.
  - **FSRS Scheduling** ([ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs)): Uses the Free Spaced Repetition Scheduler with 90% target retention, predicting memory stability and difficulty per card. Due cards load dynamically (up to 20 per session).
  - **Compact Review Stats Strip**: Shows Due, New, Learning, Learned, Reviewed Today, Avg Recall (FSRS retrievability), Next Review ETA (when caught up), and Mastery progress in a low-height summary strip. On mobile, the stats become a horizontal scroll strip so the main flashcard/review area stays high on the screen.
  - **Clean Review Navigation**: The Review tab no longer shows an overlaid due-count badge; due counts remain available in the sidebar context text and the compact stats strip.
  - **Snappy Anki-Style Card Transitions**: Utilizes React's key diffing pattern (`key={currentIndex}`) to unmount the rated card and mount the new card instantly on its front face. This completely prevents visual flip-back anomalies or mid-flip text replacement lag.
  - **Optimistic background syncs**: Rating actions are handled in the background asynchronously, making card swaps instantaneous and non-blocking.
  - **Example Phrases During Review**: Before or after flipping a card, users can tap “Show examples” to reveal a panel below the card (outside the 3D flip area). On first use, phrases are AI-generated and cached; later sessions read them from the database with zero extra fetch. Each phrase has an unlimited per-slot regenerate button. The examples panel resets when advancing to the next card.
  - **Conjugation Details During Review**: After revealing a card, users with a linked `dictionary_pealim_id` can open full Pealim conjugation tables via “View conjugations”.
- **Admin Dashboard & Premium Controls**: Admin users (`ADMIN_EMAILS`) can open a dedicated `/admin` dashboard in a new tab from the sidebar. The dashboard shows platform-wide stats (total users, premium users, active site time, episodes completed, words saved) and a searchable user table with per-user active time, last seen, episodes completed, words saved, flashcard reviews, and premium status. Admins can still grant/revoke premium access by email; granting premium automatically sends a Supabase invite email.
- **First-Time Onboarding Landing Page**: After a user's first successful login, a full-screen onboarding overlay introduces the platform's core value proposition and main features (multilingual reading, click-to-translate, vocabulary/flashcards, audio-synced highlighting). All copy is i18n-aware via `useT()`. Users can complete it via "Start reading" or dismiss it with "Skip for now". Once completed or skipped, onboarding never reappears on any device. Non-authenticated visitors never see it. Completion is persisted in Supabase user metadata (`user_metadata.onboarded`) — no database migration required.

- **Precision Audio Player**: Persistent bottom audio player with a fully custom UI built on top of HTML5 `<audio>` for reliable cross-platform playback (supports Google Drive audio and Supabase Storage episode audio via server-side proxy routes). Key improvements for mobile:
  - **Large-touch-target seek bar**: The scrub thumb is 28 px on mobile (vs the browser default of ~6 px), making it easy to tap and drag on iPhone without misses.
  - **Custom play/pause and mute controls** with animated press feedback, eliminating the cramped native browser chrome.
  - **Live time display** (elapsed / total) that updates in real-time while scrubbing.
  - **Responsive layout integration**: The player seamlessly aligns with the main content area, automatically syncing its width and animations with the sidebar to avoid overlap on desktop.
- **Responsive Workspace**: Features a highly performant, draggable sidebar that lets users seamlessly expand or contract their reading workspace. The custom width bridges native DOM events to CSS variables for 60fps adjustments without heavy React re-renders, smoothly syncing with the bottom media player layout and persisting width preferences via local storage. It also includes an elegant slide-out sidebar for mobile devices, incorporating robust scroll-bleed prevention by utilizing `overscroll-behavior: none` alongside dynamic `pointer-events: none` isolation to mathematically guarantee iOS Safari cannot chain-scroll the background.
- **Automated Scraping**: Python script to scrape episode transcripts from Squarespace and auto-translate to all six supported languages via OpenAI (`gpt-5.4-mini`).

## Architecture & Tech Stack

This project is built with **Next.js 16** (App Router) and **React 19**, focusing on performance and clean component design.

### Tech Stack
- **Framework**: Next.js 16
- **Styling**: Vanilla CSS split under `src/app/styles/` (imported via `globals.css`) for a clean, dependency-free aesthetic.
- **Icons**: `lucide-react`
- **Database & Auth**: Supabase (PostgreSQL) and `@supabase/supabase-js`.
- **Data Fetching/AI**: Supabase `dictionary_entries` (Pealim) for word lookup, lemma, Nekudot, and conjugations; OpenAI (`gpt-5.4-mini`) for dictionary miss fallback, homonym disambiguation, non-English gloss translation, and lazy-generated example phrases.
- **Scraper**: Python 3 (`requests`, `beautifulsoup4`, `openai`) for legacy Squarespace intermediate transcripts.
- **Content Pipeline**: Python scripts for AI-generated beginner, Intermediate 2, and Advanced episodes (OpenAI script → sentence-level Gemini 3.1 Flash TTS timing → Supabase Storage + DB).
- **Episode Storage**: Supabase PostgreSQL (`levels`, `episodes` with `translations` JSONB map) + Supabase Storage (`episode-audio` bucket).
- **i18n**: Lightweight client-side catalogs in `src/lib/i18n/` with `LanguageProvider` / `useT()`. Preference stored in `localStorage` (`hebrewtime-language`) and mirrored to Supabase `user_metadata.preferred_language` when logged in.

### Core Architecture
Following a recent refactor, the app utilizes Next.js Server Components and dynamic API routes for optimal performance:

- **Server-Side Data Layer (`src/lib/episodes.ts`)**: Primary source is Supabase PostgreSQL (`levels`, `episodes` — published rows only), level-aware, using `no-store` reads so regenerated episodes appear immediately. Falls back to `episodes.json` for legacy intermediate content when Supabase has no rows for a level (useful for local dev without env vars). Only levels with published episodes are shown. Default level is **beginner** when available.
- **Level & Audio Helpers (`src/lib/levelTracks.ts`, `src/lib/episodeAudio.ts`)**: `levelTracks.ts` builds level metadata (finished counts, resume episode, progress). `episodeAudio.ts` routes Google Drive URLs through `/api/audio` and Supabase Storage URLs through `/api/episode-audio/[level]/[id]`.
- **Dynamic API Routes (`/api/episode/[level]/[id]/route.ts`)**: Fresh JSON endpoints per level and episode number. `/api/levels` returns available learning tracks (cached for 1 hour).
- **Component Breakdown (`src/components/`)**:
  - `AppShell.tsx`: The main responsive client wrapper managing state/layout, view gating, sticky $10/month subscription prompts for blocked premium actions, translation blur toggle, language-aware example-phrase orchestration (`generateExamples` / `regenerateExample`), and first-time onboarding overlay rendering.
  - `LanguageSelector.tsx`: Top-bar language picker (`en` / `ru` / `uk` / `pt` / `es` / `fr`); drives UI i18n and transcript column.
  - `LearningTrackSelector.tsx`: Dropdown to switch learning levels with finished count, resume episode, and progress bar.
  - `Sidebar.tsx`: Navigation, search, and tab switching (all labels via `useT()`).
  - `EpisodeViewer.tsx`: Hebrew + selected-language reading, word-click handling (`translateWord` with `targetLang`), translation modal, and conjugation-details modal.
  - `VocabularyView.tsx`: Saved words in a desktop table / mobile card layout with search, filtering, inline editing, expandable example-phrase panels, and dictionary conjugation details (book icon when `dictionary_pealim_id` is set).
  - `FlashcardsView.tsx`: Core spaced-repetition card review view featuring a compact Review stats strip, 3D flip animations, snappy Anki-style deck swaps, example phrases below the card, and conjugation details after reveal.
  - `ExamplePhrasesPanel.tsx`: Shared UI for listing, generating, and regenerating example phrases (used by Vocabulary and Flashcards).
  - `TranslationModal.tsx`: Word translation popup (meaning, transliteration, verb form, save, link to conjugations).
  - `DictionaryDetailsModal.tsx`: Lazy-loaded Pealim conjugation/inflection tables grouped by `conjugation_sections`, with audio playback.
  - `AuthModal.tsx`: The Supabase authentication UI for login, sign up, and password recovery.
  - `OnboardingOverlay.tsx`: Full-screen first-login landing page with hero, feature cards, and CSS mockups of core app capabilities.
  - `AdminDashboard.tsx`: Admin-only `/admin` dashboard with usage stats, searchable user list, and premium grant/revoke controls.
- **Custom Hooks (`src/hooks/`)**:
  - `useVocabulary.ts`: Manages syncing vocabulary (including `example_phrases` and `dictionary_pealim_id`) to Supabase based on the user's login state.
  - `useFlashcards.ts`: Tracks reviews and schedules next card review times via FSRS (`src/lib/fsrs.ts`), syncing flashcard progress state with Supabase.
  - `useEntitlements.ts`: Resolves auth/premium/admin status via server actions for gating translations, vocabulary, flashcards, and example phrases.
  - `useUser.ts`: Subscribes to Supabase auth events to track logged-in users.
  - `useOnboarding.ts`: Derives whether to show the first-login onboarding overlay from `user.user_metadata.onboarded` and persists dismissal via `supabase.auth.updateUser({ data: { onboarded: true } })`.
  - `useFinishedEpisodes.ts`: Manages per-level finished state in local storage and syncs to Supabase `finished_episodes` (with `level_slug`) for authenticated users. Migrates legacy numeric-only localStorage entries to `intermediate:{episode}` keys.
  - `useUsageTracking.ts`: Tracks authenticated active site time (visible tab + recent interaction) and syncs daily rollups to Supabase for the admin dashboard.

### Multilingual Platform (i18n + Transcripts)

> **Prompt context for AI assistants:** This section documents how multilingual support works end-to-end. Read it before changing UI copy, episode data, translation pipelines, click-to-translate behavior, or Pealim dictionary integration.

#### Design decisions (do not regress without explicit intent)

| Decision | Rationale |
|----------|-----------|
| **One language preference** drives both UI chrome and transcript column | Simpler UX; learner reads Hebrew + their native language |
| **Hebrew is always shown** | It is the learning target; only the adjacent translation column changes |
| **Six languages**: `en`, `ru`, `uk`, `pt`, `es`, `fr` | All LTR; Hebrew stays per-element `dir="rtl"` — no document-level RTL flip |
| **`episodes.translations` JSONB map** | Matches existing JSONB paragraph storage; one fetch per episode |
| **`english_paragraphs` kept** | Backward compatibility; `translations.en` is backfilled from it |
| **Vocabulary `translation` column unchanged** | Single text field; meaning follows active language at save time (mixed-language lists accepted) |
| **`ExamplePhrase.english` field name unchanged** | JSONB shape stays `{ hebrew, english }`; `english` holds meaning in active language |
| **Admin dashboard stays English** | Internal tool; out of i18n scope |
| **All new transcript/AI translations use `gpt-5.4-mini`** | Consistent cost/quality across scraper, pipeline, backfill, and server actions |
| **Pealim `dictionary_entries` is the source of truth for lemma/Nekudot** | OpenAI is fallback only; do not regenerate vocalization via AI when a dictionary row exists |
| **`vocabulary.dictionary_pealim_id` links saves to Pealim** | Enables conjugation modal on Vocabulary/Flashcards without re-lookup |
| **`vocabulary.pronunciation` stores Pealim transliteration** | Populated on save from dictionary hit; user-editable inline |

#### Supported language codes

Defined in `src/lib/i18n/types.ts`:

| Code | UI label | AI prompt name |
|------|----------|----------------|
| `en` | English | English |
| `ru` | Русский | Russian |
| `uk` | Українська | Ukrainian |
| `pt` | Português | Portuguese |
| `es` | Español | Spanish |
| `fr` | Français | French |

Default: `en`. Invalid codes fall back to `en`.

#### UI i18n (client-side)

Dependency-free catalogs — no `next-intl` or similar.

| File | Purpose |
|------|---------|
| `src/lib/i18n/types.ts` | `LangCode`, `LANG_CODES`, `LANGUAGE_NAMES_FOR_AI`, helpers |
| `src/lib/i18n/messages.ts` | All UI strings for all 6 languages (`MessageKey` union) |
| `src/lib/i18n/LanguageProvider.tsx` | Context: `lang`, `setLang`, `t()`, blur toggle, `langOptions` |
| `src/lib/i18n/index.ts` | Re-exports |
| `src/components/LanguageSelector.tsx` | Top-bar `<select>` for language |

**Provider wiring:** `LanguageProvider` wraps `AppShell` in `src/app/page.tsx`. Standalone routes (`/update-password`) wrap themselves.

**Persistence:**
- `localStorage` key `hebrewtime-language` — primary store for all users
- `localStorage` key `blur-translations` — translation blur/focus mode (legacy key `blur-english-translations` migrated on read)
- Logged-in users: `user_metadata.preferred_language` synced via `supabase.auth.updateUser` on change

**Usage in components:**
```tsx
import { useT, useLanguage } from "@/lib/i18n/LanguageProvider";

const t = useT();
const { lang, isTranslationBlurred, toggleTranslationBlurred } = useLanguage();

// Simple string
t("logIn")

// Interpolation
t("resumeEpisode", { num: "05" })
```

**Adding a new UI string:**
1. Add key + English text to the `en` object in `messages.ts`
2. Add the same key to `ru`, `uk`, `pt`, `es`, `fr` objects (TypeScript enforces completeness via `Messages` type)
3. Replace hardcoded copy with `t("yourKey")` in the component

**Level display names** (`levels.name` from Supabase) are data, not catalog strings.

#### Episode transcript translations (database)

**Schema** (after `supabase/multilingual-translations.sql`):

```sql
ALTER TABLE public.episodes
  ADD COLUMN translations JSONB NOT NULL DEFAULT '{}'::jsonb;
```

**Shape** — paragraph arrays aligned 1:1 with `hebrew_paragraphs`:

```json
{
  "en": ["Hello...", "..."],
  "ru": ["Привет...", "..."],
  "uk": ["Привіт...", "..."],
  "pt": ["Olá...", "..."],
  "es": ["Hola...", "..."],
  "fr": ["Bonjour...", "..."]
}
```

`english_paragraphs` remains populated for compatibility. Migration backfills `translations.en` from it.

**TypeScript:** `Episode.translations: EpisodeTranslations` (`Partial<Record<LangCode, string[]>>`) in `src/lib/types.ts`.

**Loading:** `src/lib/episodes.ts → mapEpisodeRow()` reads `translations`, defaulting `en` from `english_paragraphs` when absent. Legacy `episodes.json` fallback uses the same mapping.

**Rendering:** `src/lib/episodeTranslations.ts → getTranslationParagraphs(episode, lang)` resolves the active language, falls back to `english_paragraphs` for `en` or empty maps, returns `[]` for missing non-English languages. `EpisodeViewer.tsx` shows `t("noTranslation")` when a paragraph is empty.

**CSS:** Translation column uses `.text-translation` (`.text-english` kept as alias). Blur toggle uses `.translation-toggle-btn`.

#### Click-to-translate, dictionary lookup & example phrases (server actions)

Both word lookup and example phrases respect the active `LangCode` passed from the client.

> **Prompt context for AI assistants:** Read [`docs/dictionary_entries.md`](docs/dictionary_entries.md) before changing dictionary lookup, conjugation UI, or `dictionary_entries` schema. Dictionary reads use `supabaseAdmin` (service role) in server actions so anonymous users are not blocked by RLS.

**`translateWord(accessToken, word, hebrewContext, translationContext, targetLang?)`**

Lookup pipeline (`src/lib/dictionaryLookup.ts` → `findDictionaryCandidates`):

1. Strip niqqud; generate prefix-stripped candidates (0–3 leading prefix chars).
2. For each candidate: `dictionary_entries` headword match, then `forms @> [{"hebrew_plain": …}]`.
3. If still empty: `match_dictionary_word()` RPC (`pg_trgm`, similarity > 0.4).
4. **0 candidates** → full OpenAI lemma+translation fallback (legacy prompt).
5. **1 candidate** → return Pealim lemma, Nekudot, transliteration, meaning; translate gloss via OpenAI when `targetLang !== "en"`.
6. **Multiple candidates** → one OpenAI call to pick `pealim_id` using sentence context; default to first on failure.

**Success response fields:**

| Field | Source | Notes |
|-------|--------|-------|
| `lemmaWord` | Pealim `word` or OpenAI | Stored in `vocabulary.word` |
| `translation` | Pealim `meaning` (or gloss translation) | User's `targetLang` |
| `wordWithNekudot` | Pealim `word_with_nekudot` | |
| `verbFormWithNekudot` | Pealim infinitive if verb | `null` for non-verbs |
| `pronunciation` | Pealim `transliteration` | Stored in `vocabulary.pronunciation` |
| `dictionaryPealimId` | Pealim `pealim_id` | Stored in `vocabulary.dictionary_pealim_id`; `null` on OpenAI fallback |
| `partOfSpeech` | Pealim `part_of_speech` | Display only |
| `source` | `"dictionary"` \| `"openai"` | |

Rate limits and daily caps unchanged. Dictionary hits still count toward translation quotas.

**`getDictionaryEntryDetails(pealimId)`**

Lazy-loaded when opening `DictionaryDetailsModal`. Returns full conjugation payload (`meanings`, `notes`, `conjugation_sections`, `forms`, audio URLs). Client caches by `pealim_id`. Table layout in `src/lib/dictionaryTableLayout.ts` handles merged colspan cells (`gender: null`) by spanning masculine+feminine columns.

**`generateExamplePhrases(accessToken, word, translation, count, existingPhrases?, targetLang?)`**
- Unchanged: Hebrew sentences with full Nekudot; meaning in `targetLang` stored in `ExamplePhrase.english`.
- Model: `gpt-5.4-mini`, `temperature: 0.7`. Requires authentication.

Callers: `EpisodeViewer.tsx` passes `lang` to `translateWord`; `AppShell.tsx` passes `lang` to `generateExamplePhrases`.

#### Translation pipelines (Python)

Shared utilities: `scripts/lib/translation_utils.py`
- `TRANSLATION_MODEL = "gpt-5.4-mini"`
- `TARGET_LANGS = ("ru", "uk", "pt", "es", "fr")`
- `translate_paragraphs()`, `build_translations_map()`, `normalize_paragraph_texts()`

| Script | When translations are produced |
|--------|-------------------------------|
| `scraper.py` → `translate_episode()` | On scrape: English + 5 languages → `translations` map + `english_paragraphs` |
| `scripts/generate_episodes.py` → `enrich_script_translations()` | After script generation (and when loading script bank if missing langs) |
| `scripts/migrate_episodes_to_supabase.py` | Passes `translations` through on upsert |
| `scripts/backfill_translations.py` | One-time fill for existing Supabase episodes |

**Backfill flags:** `--dry-run`, `--level`, `--episode`, `--lang`, `--force`. Checkpoint: `scripts/.checkpoints/translation_backfill.json`.

**Cost note:** All episodes × 5 languages × ~40 paragraphs is a large OpenAI run. Use `--dry-run` first, then `--level` / `--lang` to batch.

#### Key files checklist (multilingual changes)

| Area | Files |
|------|-------|
| i18n core | `src/lib/i18n/*`, `src/components/LanguageSelector.tsx` |
| Reader | `src/components/EpisodeViewer.tsx`, `src/lib/episodeTranslations.ts` |
| Dictionary lookup | `src/lib/dictionaryLookup.ts`, `src/lib/dictionaryTableLayout.ts`, `docs/dictionary_entries.md` |
| Dictionary UI | `src/components/DictionaryDetailsModal.tsx`, `src/components/TranslationModal.tsx`, `src/app/styles/dictionary-details.css` |
| Server actions | `src/app/actions.ts` (`translateWord`, `getDictionaryEntryDetails`, `generateExamplePhrases`) |
| Data layer | `src/lib/types.ts`, `src/lib/episodes.ts` |
| Styles | `src/app/styles/layout.css` (`.text-translation`, `.language-selector`) |
| DB migrations | `supabase/dictionary-migration.sql`, `supabase/dictionary-trgm-migration.sql`, `supabase/multilingual-translations.sql` |
| Pipelines | `scraper.py`, `scripts/generate_episodes.py`, `scripts/lib/translation_utils.py`, `scripts/backfill_translations.py` |

## Setup & Local Development

### 1. Environment Variables

Create a `.env` file in the root directory. You need Supabase keys for auth, vocabulary, and the Pealim dictionary. An OpenAI API key is still required for dictionary miss fallback, non-English gloss translation, and example phrases.

```env
OPENAI_API_KEY=sk-your-openai-api-key-here
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ADMIN_EMAILS=admin1@example.com,admin2@example.com
GOOGLE_APPLICATION_CREDENTIALS=/path/to/gcp-service-account.json
GOOGLE_SERVICE_ACCOUNT_FILE=/path/to/gcp-service-account.json
SUPABASE_AUDIO_BUCKET=episode-audio
```

Notes:
- `SUPABASE_SERVICE_ROLE_KEY` is required for secure server-side premium checks, admin premium management, and server-side episode loading.
- `GOOGLE_APPLICATION_CREDENTIALS` (or `GOOGLE_SERVICE_ACCOUNT_FILE`) must point to a GCP service account JSON key. Gemini TTS does **not** accept API keys — OAuth2 only. A common local path is `secrets/gcp-service-account.json` (the `secrets/` directory is gitignored; see setup checklist below).
- Enable **Cloud Text-to-Speech API** and **Vertex AI API** on the GCP project; grant the service account **`roles/aiplatform.user`** (includes `aiplatform.endpoints.predict` required by Gemini TTS).
- `SUPABASE_AUDIO_BUCKET` defaults to `episode-audio` if unset.
- `ADMIN_EMAILS` is a comma-separated list of emails allowed to open the `/admin` dashboard and manage premium users.

### 2. Supabase Database Setup

For vocabulary saving + premium management to work, navigate to your Supabase SQL Editor and execute the following snippet:

```sql
CREATE TABLE IF NOT EXISTS public.vocabulary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  word TEXT NOT NULL,
  word_with_nekudot TEXT,
  verb_form_with_nekudot TEXT,
  translation TEXT NOT NULL,
  pronunciation TEXT,
  episode_title TEXT,
  episode_url TEXT,
  saved_at BIGINT,
  example_phrases JSONB NOT NULL DEFAULT '[]'::jsonb
);
ALTER TABLE public.vocabulary ENABLE ROW LEVEL SECURITY;

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

CREATE POLICY "Premium users view own vocabulary" ON public.vocabulary FOR SELECT USING (auth.uid() = user_id AND public.user_has_premium_access());
CREATE POLICY "Premium users insert own vocabulary" ON public.vocabulary FOR INSERT WITH CHECK (auth.uid() = user_id AND public.user_has_premium_access());
CREATE POLICY "Premium users update own vocabulary" ON public.vocabulary FOR UPDATE USING (auth.uid() = user_id AND public.user_has_premium_access()) WITH CHECK (auth.uid() = user_id AND public.user_has_premium_access());
CREATE POLICY "Premium users delete own vocabulary" ON public.vocabulary FOR DELETE USING (auth.uid() = user_id AND public.user_has_premium_access());

CREATE TABLE IF NOT EXISTS public.flashcard_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  vocab_id UUID REFERENCES public.vocabulary(id) ON DELETE CASCADE NOT NULL,
  ease_factor DOUBLE PRECISION DEFAULT 2.5 NOT NULL,
  interval_days INTEGER DEFAULT 0 NOT NULL,
  repetitions INTEGER DEFAULT 0 NOT NULL,
  next_review_at TIMESTAMPTZ NOT NULL,
  is_learned BOOLEAN DEFAULT FALSE NOT NULL,
  last_reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  stability DOUBLE PRECISION,
  difficulty DOUBLE PRECISION,
  state INTEGER NOT NULL DEFAULT 0,
  lapses INTEGER NOT NULL DEFAULT 0,
  UNIQUE (user_id, vocab_id)
);
ALTER TABLE public.flashcard_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Premium users view own flashcard progress" ON public.flashcard_progress FOR SELECT USING (auth.uid() = user_id AND public.user_has_premium_access());
CREATE POLICY "Premium users insert own flashcard progress" ON public.flashcard_progress FOR INSERT WITH CHECK (auth.uid() = user_id AND public.user_has_premium_access());
CREATE POLICY "Premium users update own flashcard progress" ON public.flashcard_progress FOR UPDATE USING (auth.uid() = user_id AND public.user_has_premium_access()) WITH CHECK (auth.uid() = user_id AND public.user_has_premium_access());
CREATE POLICY "Premium users delete own flashcard progress" ON public.flashcard_progress FOR DELETE USING (auth.uid() = user_id AND public.user_has_premium_access());

CREATE TABLE IF NOT EXISTS public.premium_users (
  email TEXT PRIMARY KEY,
  is_premium BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.premium_users ENABLE ROW LEVEL SECURITY;

-- Only service-role writes are used by the app for this table.
CREATE POLICY "Users can read own premium status"
ON public.premium_users
FOR SELECT
TO authenticated
USING (
  lower(email) = lower((
    SELECT u.email FROM auth.users u WHERE u.id = auth.uid()
  ))
);

CREATE TABLE IF NOT EXISTS public.finished_episodes (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  level_slug TEXT NOT NULL DEFAULT 'intermediate',
  episode_number INTEGER NOT NULL,
  finished_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, level_slug, episode_number)
);
ALTER TABLE public.finished_episodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own finished episodes" ON public.finished_episodes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own finished episodes" ON public.finished_episodes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own finished episodes" ON public.finished_episodes FOR DELETE USING (auth.uid() = user_id);
```

**Fresh installs:** After the vocabulary/premium tables above, run [`supabase/beginner-track-migration.sql`](supabase/beginner-track-migration.sql) to add `levels`, `episodes`, and upgrade `finished_episodes` for multi-level support. Existing projects that created `finished_episodes` with the old `(user_id, episode_number)` primary key should run that migration instead of recreating the table.

If you already created the `vocabulary` table without example phrases or without an UPDATE policy, run this migration in the Supabase SQL Editor:

```sql
ALTER TABLE public.vocabulary
  ADD COLUMN IF NOT EXISTS example_phrases JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Skip this line if "Premium users update own vocabulary" already exists from a fresh install.
CREATE POLICY "Premium users update own vocabulary" ON public.vocabulary
  FOR UPDATE USING (auth.uid() = user_id AND public.user_has_premium_access())
  WITH CHECK (auth.uid() = user_id AND public.user_has_premium_access());
```

If you created the database before premium-aware RLS was added, run the full migration in [`supabase/premium-rls-migration.sql`](supabase/premium-rls-migration.sql). It replaces the older auth-only vocabulary/flashcard policies, adds `user_has_premium_access()`, and restricts `premium_users` reads to each user's own row.

If you created `flashcard_progress` before FSRS columns were added, run [`supabase/fsrs-migration.sql`](supabase/fsrs-migration.sql) in the Supabase SQL Editor. Existing SM-2 rows are migrated automatically on the next review in the app.

**Pealim dictionary (word lookup):** Run [`supabase/dictionary-migration.sql`](supabase/dictionary-migration.sql) to create the shared `dictionary_entries` reference table (~9k+ Pealim verbs/words with conjugations) and add `vocabulary.dictionary_pealim_id` (FK, `ON DELETE SET NULL`). Populate rows with your Pealim scraper (schema and JSONB shapes documented in [`docs/dictionary_entries.md`](docs/dictionary_entries.md)). Then run [`supabase/dictionary-trgm-migration.sql`](supabase/dictionary-trgm-migration.sql) for `pg_trgm` fuzzy matching via `match_dictionary_word()` when exact headword/forms lookup fails. RLS allows `authenticated` SELECT on `dictionary_entries`; server actions read via `supabaseAdmin` so logged-out translation still works.

**Admin usage tracking:** To enable active site-time stats in the admin dashboard, run [`supabase/admin-usage-stats-migration.sql`](supabase/admin-usage-stats-migration.sql). This creates `user_activity_daily` and the `increment_user_activity()` RPC used by server actions. Active time is recorded only for authenticated users while the tab is visible and the user has interacted recently; stats appear in `/admin` after users browse the app post-migration.

**Multilingual episode translations:** After the beginner-track migration, run [`supabase/multilingual-translations.sql`](supabase/multilingual-translations.sql) to add the `translations` JSONB column and backfill English from `english_paragraphs`. To generate Russian, Ukrainian, Portuguese, Spanish, and French for existing episodes:

```bash
# Preview work (no OpenAI calls)
python3 scripts/backfill_translations.py --dry-run

# Fill missing languages for all published episodes
python3 scripts/backfill_translations.py

# One level or language at a time
python3 scripts/backfill_translations.py --level beginner --lang ru
```

New episodes from `scraper.py` and `scripts/generate_episodes.py` generate all six languages at creation time using `gpt-5.4-mini`.

**Multi-level episodes:** If you have not already run it, apply [`supabase/beginner-track-migration.sql`](supabase/beginner-track-migration.sql). Then migrate legacy intermediate content:

```bash
pip install -r requirements.txt
python scripts/migrate_episodes_to_supabase.py
```

Create a Supabase Storage bucket named `episode-audio` (Dashboard → Storage). The app can read public bucket URLs directly, but generated Supabase audio is also supported through the authenticated server route `/api/episode-audio/[level]/[id]`, so the bucket does not have to be exposed directly to the browser.

**Admin note:** `ADMIN_EMAILS` unlocks premium features in server actions and the UI, but vocabulary/flashcard writes are enforced in Postgres via `premium_users`. Grant admin accounts a row in `premium_users` (via the admin panel or a one-time `INSERT`) so they can save vocabulary.

Optional helper trigger (keeps `updated_at` current on updates):

```sql
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS premium_users_set_updated_at ON public.premium_users;
CREATE TRIGGER premium_users_set_updated_at
BEFORE UPDATE ON public.premium_users
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();
```

### 3. Premium Access Rules

- **Non-authenticated (logged-out) users**: can read episodes and translate words up to the daily free limit. The logged-out daily translation limit is tracked client-side in `localStorage` (`hebrewtime-anon-usage`, see `src/lib/anonUsage.ts`), since there is no user id to track server-side. **Saving a word to vocabulary requires login** (`useVocabulary.addWord` returns `auth_required`, which opens the auth modal). Example phrases and flashcards remain login-gated.
- **Authenticated non-premium users**: can read episodes, translate, save vocabulary, use flashcards, and generate example phrases up to per-day free limits (enforced server-side via `user_activity_daily`).
- **Blocked action UX**: when a user hits a daily limit (or a vocabulary cap), they see a sticky top-of-screen subscription panel comparing Free vs Premium and can open auth/signup from the CTA. Logged-out users additionally see a "Log in" affordance.
- **Premium users**: unlimited translations (dictionary + OpenAI fallback), example phrases, vocabulary, and flashcards.
- **Admin users** (`ADMIN_EMAILS`): automatically get premium access in server actions and the UI, and they can open the `/admin` dashboard (new tab from the sidebar) to view user stats and grant/revoke premium access for other users by email. Granting premium access automatically triggers a Supabase invite email to the recipient. Admin accounts also need a row in `premium_users` to pass database RLS for vocabulary/flashcard writes.

**Security notes:**
- OpenAI server actions enforce per-requester rate limits and input length bounds in `src/lib/actionGuards.ts`. `translateWord` allows logged-out callers (rate-limited by request IP as an abuse guard; daily quota enforced client-side), enforces a server-side daily cap for authenticated non-premium users, and is unlimited for premium/admin. Dictionary lookups run server-side via `supabaseAdmin` (not exposed to the browser). `generateExamplePhrases` requires authentication.
- The audio proxy at `/api/audio` only accepts HTTPS Google Drive URLs (`src/lib/allowedAudioHosts.ts`); all other hosts are rejected.
- Supabase Storage episode audio is streamed through `/api/episode-audio/[level]/[id]` using the server-side service role key (not end-user auth).

### 4. Updating Episodes (Python Scraper)

To fetch the latest podcast transcripts and auto-translate them to all six supported languages:

```bash
# Ensure you have your .env setup with OPENAI_API_KEY
pip install -r requirements.txt
python scraper.py
```
This generates/updates `episodes.json`, the **legacy intermediate archive** and migration source for the original Hebrew Time podcast. The Next.js app reads episodes from **Supabase** at runtime; `episodes.json` is used only as a local fallback when Supabase has no rows for a level. After scraping, re-run `scripts/migrate_episodes_to_supabase.py` to push changes to Supabase. `episodes_checkpoint.json` is optional and is used only by the scraper/maintenance scripts for resume support.

#### Important: Missing transcript paragraphs (leading text outside `<p>` tags)
Squarespace sometimes renders parts of the transcript (especially the opening paragraph, or text immediately following an image block) as leading text nodes before the first `<p>` tag inside its containing layout block. Older runs of the scraper missed these paragraphs (and downstream UI would appear to skip them).

- `scraper.py` was updated to iterate over all layout blocks, correctly extracting these leading text nodes and inserting them into the paragraph sequence in the proper order.
- If you already have an older `episodes.json` missing these paragraphs, you can patch it efficiently by discovering and translating only the missing paragraph(s) using difflib:

```bash
python3 apply_scraping_patch.py
```

The script:
- compares the re-scraped Hebrew text with the old JSON data to find exact insertions.
- translates only the missing middle/prefix paragraphs via OpenAI (`gpt-5.4-mini`).
- updates `hebrew_paragraphs`, `english_paragraphs`, `translations` (if present), and `hebrew_text`.
- creates a backup at `episodes.json.bak.<timestamp>`.

(Note: `patch_missing_transcripts.py` was an older script built only for initial-paragraph prefixes, while `apply_scraping_patch.py` handles missing paragraphs anywhere in the text).

#### Fixing audio URLs (`patch_audio.py`)

If episodes are missing `audio_url` values or still use old Google Drive `/file/d/.../view` links that fail in the browser, run:

```bash
python patch_audio.py
```

The script normalizes Google Drive URLs to direct-download form and can re-fetch missing audio links from Squarespace. It writes `episodes.json` (or `episodes_checkpoint.json` if present).

### 5. Transcript Audio Synchronization (Whisper)

A dedicated script allows generating precise `start` and `end` timestamps for each Hebrew paragraph, enabling the real-time UI highlighting feature:

```bash
python scripts/sync_episode_1.py
```

The script:
- Downloads the original audio file.
- Transcribes the audio using OpenAI's `whisper-1` model with segment-level timestamp granularities.
- Uses sequence matching to align the Whisper segments back to the exact, original `hebrew_paragraphs` (without altering the original text).
- Replaces string paragraphs in `episodes.json` with timestamp objects: `{ text: "...", start: 0.0, end: 5.5 }`. When `scripts/lib/alignment.py` splits paragraphs into sentences, each paragraph object may also include a `sentences[]` array with per-sentence timings.

*Legacy note: `sync_episode_1.py` defaults to intermediate Episode 1 and writes to `episodes.json`. Re-run migration after syncing if using Supabase.*

### 5.1 Generated Episode Pipeline

Generate AI episodes with [`scripts/generate_episodes.py`](scripts/generate_episodes.py). The recommended workflow is script-first: generate and review the Hebrew scripts (plus all six language translations via `enrich_script_translations`), then run TTS/upload from those stored scripts.

#### One-time setup

```bash
pip install -r requirements.txt
python3 scripts/verify_gcp_tts.py
```

Make sure `.env` has `OPENAI_API_KEY`, Supabase keys, `SUPABASE_AUDIO_BUCKET`, and `GOOGLE_APPLICATION_CREDENTIALS` (or `GOOGLE_SERVICE_ACCOUNT_FILE`) pointing to a GCP service account JSON file.

**GCP credentials checklist** (place the JSON in `secrets/gcp-service-account.json` locally — the `secrets/` directory is gitignored):
1. Enable **Cloud Text-to-Speech API** and **Vertex AI API** on the GCP project.
2. Grant the service account **Vertex AI User** (`roles/aiplatform.user`).
3. Ensure billing is enabled on the project.
4. Set `GOOGLE_APPLICATION_CREDENTIALS` to the full path of the JSON file.
5. Verify access: `python3 scripts/verify_gcp_tts.py`

#### Recommended workflow

```bash
# 1. Generate scripts only.
# Output: scripts/generated/beginner_scripts.json
python3 scripts/generate_episodes.py --level beginner --scripts-only

# Intermediate 2 output: scripts/generated/intermediate-2_scripts.json
python3 scripts/generate_episodes.py --level intermediate-2 --curriculum intermediate_2_curriculum.json --scripts-only

# Advanced output: scripts/generated/advanced_scripts.json
python3 scripts/generate_episodes.py --level advanced --curriculum advanced_curriculum.json --scripts-only

# 2. Review/edit scripts/generated/beginner_scripts.json if needed.
#    For Intermediate 2, review/edit scripts/generated/intermediate-2_scripts.json.
#    For Advanced, review/edit scripts/generated/advanced_scripts.json.

# 3. Generate audio, direct sentence timestamps, upload to Supabase, and upsert DB rows.
python3 scripts/generate_episodes.py --level beginner --audio-only
python3 scripts/generate_episodes.py --level intermediate-2 --curriculum intermediate_2_curriculum.json --audio-only
python3 scripts/generate_episodes.py --level advanced --curriculum advanced_curriculum.json --audio-only
```

#### Useful recipes

```bash
# Generate scripts with a specific OpenAI model for script writing only.
python3 scripts/generate_episodes.py --level beginner --scripts-only --script-model gpt-5.5

# Generate scripts from episode 8 onward, preserving earlier scripts as context.
python3 scripts/generate_episodes.py --level beginner --from-episode 8 --scripts-only

# Generate audio/upload from episode 8 onward using existing stored scripts.
python3 scripts/generate_episodes.py --level beginner --from-episode 8 --audio-only

# Regenerate one script from scratch.
python3 scripts/generate_episodes.py --level beginner --episode 3 --scripts-only --force --script-model gpt-5.5

# Regenerate audio/upload for one episode from the stored script.
python3 scripts/generate_episodes.py --level beginner --episode 3 --audio-only --force

# Legacy all-in-one mode: script + audio + upload in one run.
python3 scripts/generate_episodes.py --level beginner --episode 3 --force
```

#### CLI flags

| Flag | Purpose |
|------|---------|
| `--level beginner` | Selects the level/curriculum. |
| `--episode 3` | Runs only one episode. Cannot be combined with `--from-episode`. |
| `--from-episode 8` | Runs every matching episode from 8 onward. |
| `--scripts-only` | Generates/stores Hebrew scripts + six-language `translations` map only; skips TTS, upload, and DB upsert. |
| `--audio-only` | Uses pre-generated scripts from the script bank; skips OpenAI script generation. |
| `--script-model MODEL` | Overrides the OpenAI model for script generation only. Does not affect Gemini TTS. |
| `--script-bank PATH` | Uses a custom script-bank JSON path instead of `scripts/generated/{level}_scripts.json`. |
| `--force` | Regenerates even if a script/checkpoint/DB row already exists. |
| `--curriculum PATH` | Uses a custom curriculum file instead of `beginner_curriculum.json`. Required for `intermediate-2` and `advanced`. |

Curriculum configs:
- [`beginner_curriculum.json`](beginner_curriculum.json) (~20 A1 episodes, narrator persona Noa, gradual vocab).
- [`intermediate_2_curriculum.json`](intermediate_2_curriculum.json) (~20 B1 episodes, narrator persona Maya, richer spoken Hebrew).
- [`advanced_curriculum.json`](advanced_curriculum.json) (~20 B2 episodes, narrator persona Eitan, authentic advanced Hebrew).

**Current generation stack:**
- Script model: configured per curriculum under `generation.openai_model` (defaults: `gpt-5.5` for beginner/advanced, `gpt-5.4` for intermediate-2).
- Override script model per run with `--script-model MODEL_NAME`; this only affects OpenAI script generation, not Gemini TTS.
- Audio model: `gemini-3.1-flash-tts-preview`.
- Voice: `Achernar`, `he-IL`.
- Timing: direct sentence-level TTS timing. The script splits each Hebrew paragraph into sentences, synthesizes each sentence separately, concatenates the audio, and stores exact `start` / `end` timestamps while building the MP3. Generated episodes do **not** use Whisper for primary synchronization.

**Content quality controls:**
- Episodes target ~10 minutes with `target_word_count_min` / `target_word_count_max` and `target_paragraph_count`.
- The curriculum defines level-specific `core_vocab`, reusable `useful_chunks`, and per-episode `narrative_hook` / `useful_phrases` so episodes feel like natural personal stories rather than vocabulary lists.
- Scripts are persisted in `scripts/generated/{level}_scripts.json`. When generating a later script, the model receives continuity context from the most recent prior scripts (opening scene, closing note, useful phrases, and vocabulary to reinforce).
- Existing generated episodes must be regenerated with `--force` after changing curriculum or prompt rules.

**Script-first workflow:**
```bash
# Generate or refresh all scripts with previous-episode context
python3 scripts/generate_episodes.py --level beginner --scripts-only --force

# Generate/refresh episode 5 onward with a stronger script model
python3 scripts/generate_episodes.py --level beginner --from-episode 5 --scripts-only --force --script-model gpt-5.5

# Review/edit scripts/generated/beginner_scripts.json if needed

# Create audio/timestamps/upload using the stored scripts only
python3 scripts/generate_episodes.py --level beginner --audio-only --force
```

**Intermediate 2 script-first workflow:**
```bash
# Generate or refresh all Intermediate 2 scripts
python3 scripts/generate_episodes.py --level intermediate-2 --curriculum intermediate_2_curriculum.json --scripts-only --force

# Generate/refresh episode 5 onward with a stronger script model
python3 scripts/generate_episodes.py --level intermediate-2 --curriculum intermediate_2_curriculum.json --from-episode 5 --scripts-only --force --script-model gpt-5.5

# Review/edit scripts/generated/intermediate-2_scripts.json if needed

# Create audio/timestamps/upload using the stored scripts only
python3 scripts/generate_episodes.py --level intermediate-2 --curriculum intermediate_2_curriculum.json --audio-only --force
```

**Advanced script-first workflow:**
```bash
# Generate or refresh all Advanced scripts
python3 scripts/generate_episodes.py --level advanced --curriculum advanced_curriculum.json --scripts-only --force

# Generate/refresh episode 5 onward with a stronger script model
python3 scripts/generate_episodes.py --level advanced --curriculum advanced_curriculum.json --from-episode 5 --scripts-only --force --script-model gpt-5.5

# Review/edit scripts/generated/advanced_scripts.json if needed

# Create audio/timestamps/upload using the stored scripts only
python3 scripts/generate_episodes.py --level advanced --curriculum advanced_curriculum.json --audio-only --force
```

**Checkpoint behavior:**
- `scripts/generated/{level}_scripts.json` is the durable script bank and should be reviewed before audio generation. **Commit these files** — they are the source of truth for `--audio-only` runs.
- `scripts/.checkpoints/{level}-01.json` stores the script, `alignment_method`, sentence timings, and audio duration.
- `scripts/.checkpoints/{level}-01.mp3` stores synthesized audio. When both audio and timings exist, reruns reuse them unless `--force` is passed.
- New direct-timed episodes should have `"alignment_method": "direct_sentence_tts"` in the checkpoint JSON.
- Checkpoints are **local-only** (gitignored). Canonical runtime data lives in Supabase Storage (`episode-audio/{level}/{NN}.mp3`) and the `episodes` table. Safe to delete `scripts/.checkpoints/` locally after verifying uploads, but regeneration will re-run TTS.

**Regeneration examples:**
```bash
# Regenerate one episode from scratch after prompt/curriculum changes
python3 scripts/generate_episodes.py --level beginner --episode 1 --force

# Generate missing episodes, skipping rows already in Supabase
python3 scripts/generate_episodes.py --level beginner

# Regenerate all beginner episodes
python3 scripts/generate_episodes.py --level beginner --force
```

**TTS troubleshooting:**
- Gemini TTS does not accept API keys. Use `GOOGLE_APPLICATION_CREDENTIALS` pointing to a GCP service account JSON file.
- The same GCP project must have **Cloud Text-to-Speech API** and **Vertex AI API** enabled, and the service account needs `roles/aiplatform.user`.
- If Vertex reports a usage-guidelines false positive for a sentence, `generate_episodes.py` retries with a neutral prompt, no prompt, and sanitized punctuation before failing with the exact sentence.
- Python 3.13 removed `audioop`; `requirements.txt` includes `audioop-lts` for pydub compatibility.

Detailed task docs: [`docs/beginner-track/`](docs/beginner-track/).

### 6. Password Recovery (Forgot Password)
Password reset is implemented using Supabase Email Auth:

- The “Forgot password?” button in `AuthModal` calls `supabase.auth.resetPasswordForEmail(...)`.
- The reset email redirects the user to `/update-password`.
- `/src/app/update-password/page.tsx` sets the new password via `supabase.auth.updateUser(...)` after Supabase initializes a recovery session from the URL (checked via `supabase.auth.getSession()`).

Make sure your Supabase Auth settings allow redirects back to your site, especially `http://localhost:3000/update-password` for local development and your production domain for deployment.

Note: in this repo’s current `@supabase/supabase-js`/`@supabase/auth-js` version, the typed `verifyOtp({ type: 'recovery' ... })` flow requires an `email`, so we rely on the recovery redirect session initialization instead.

### 7. Vocabulary Word Saving — Lemma Rules

When a user saves a Hebrew word, the app stores the **base dictionary form (lemma)** from Pealim when available, not the clicked surface form. OpenAI fallback applies the same lemma rules when no dictionary row matches.

**Prefix stripping** (lookup tries the clicked word, then variants with up to 3 leading prefixes removed):

| Prefix | Meaning |
|--------|---------|
| ה | the (definite article) |
| ל | to (preposition) |
| ב | in (preposition) |
| מ / מה | from (preposition) |
| ו | and (conjunction) |
| כ | as / like (preposition) |
| ש | that / which (conjunction) |

**Lemma rules:**
- **Nouns** → singular indefinite form. Example: הַנּוֹשֵׂא → `נושא`
- **Verbs** → infinitive form. Example: מְדַמְיֵן or מְדַמְיְנִים → `לדמיין`
- No conjugations, no gendered/plural forms, no pronoun-based translations.

**Translation rules (English examples; same lemma rules apply in all languages):**
- No "the" for nouns: `נושא` = "topic" not "the topic"
- No "to" for verbs: `לדמיין` = "imagine" not "to imagine"
- In other languages, return the base dictionary meaning without articles or infinitive markers

**`translateWord` success response** (stored via `EpisodeViewer` → `useVocabulary.addWord`):

| Response field | `vocabulary` column | Notes |
|----------------|---------------------|-------|
| `lemmaWord` | `word` | Plain Hebrew lemma |
| `wordWithNekudot` | `word_with_nekudot` | From Pealim or OpenAI fallback |
| `verbFormWithNekudot` | `verb_form_with_nekudot` | Infinitive with Nekudot if verb |
| `translation` | `translation` | Meaning in active UI language |
| `pronunciation` | `pronunciation` | Pealim transliteration when from dictionary |
| `dictionaryPealimId` | `dictionary_pealim_id` | Enables conjugation modal later |

In `EpisodeViewer.tsx`, `modal.lemmaWord` is used as `word` when calling `addWord`, so the raw prefixed surface form is **never** persisted.

**Conjugation details UI** (`DictionaryDetailsModal`):
- Opened from translation popup (“View conjugations”), Vocabulary row book icon, or Flashcards post-reveal button.
- Renders `conjugation_sections` + `forms` as pivoted tables; merged Pealim colspan cells (`gender: null`) span masculine+feminine columns via `dictionaryTableLayout.ts`.
- Pealim section/POS labels remain English (sourced data).

Words saved before dictionary integration lack `dictionary_pealim_id` until re-saved from a dictionary-backed translation.

### 8. AI Example Phrases

Premium users can generate contextual example sentences for any saved vocabulary word. Phrases help learners see how a word is used in everyday Hebrew beyond the original episode context.

**Storage model:**
- Stored as a JSONB array on the `vocabulary` row: `example_phrases` (default `[]`).
- App type: `ExamplePhrase = { hebrew: string; english: string }` on `VocabWord.examplePhrases`.
- Loaded in the same `select("*")` query as the rest of vocabulary — no separate table or extra round-trip.
- Scoped per-user automatically because vocabulary rows are user-owned via RLS.

**Generation flow (lazy, then cached):**
1. User opens examples (Vocabulary: MessageSquare toggle on a row; Flashcards: “Show examples” button).
2. If `examplePhrases` is empty, `AppShell.generateExamples` calls the server action, then `useVocabulary.updateWord` persists the result optimistically.
3. If phrases already exist, they render immediately from in-memory `vocabWords` state (shared by Vocabulary and Flashcards via `useFlashcards(vocabWords)`).
4. Regenerating one phrase: `AppShell.regenerateExample` calls the action with `count: 1` and passes existing phrases so the model avoids duplicates, then splices the new phrase at that index and saves.

**Server action** (`src/app/actions.ts → generateExamplePhrases`):
- Signature: `generateExamplePhrases(accessToken, word, translation, count, existingPhrases?, targetLang?)`
- Requires authentication; premium/free limits enforced via `getUserEntitlements` and `user_activity_daily`.
- Model: `gpt-5.4-mini`, `response_format: { type: "json_object" }`, `temperature: 0.7`.
- Returns `{ phrases: ExamplePhrase[], type: "success" | "auth_required" | "limit_reached" | "error" }`.
- Prompt asks for natural intermediate-level Hebrew sentences with full Nekudot; meaning in `targetLang` stored in the `english` JSON field.

**UI components:**
- `ExamplePhrasesPanel.tsx` — shared list/generate/regenerate UI.
- `VocabularyView.tsx` — expandable panel under desktop table rows / inside mobile cards.
- `FlashcardsView.tsx` — panel below the flip card (not inside it, to preserve 3D flip); resets on card advance.

**Cost/latency notes:**
- One OpenAI call to generate all 3 phrases; one call per single-phrase regeneration (unlimited).
- Phrases are never auto-generated on word save (avoids credits on words the user never reviews).

### 9. Running the Next.js App

Install dependencies and start the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### 10. First-Time Onboarding Landing Page

Authenticated users see a one-time onboarding overlay on their first login. It introduces the platform before they begin reading.

**When it shows:**
- User is authenticated (`useUser` returns a session).
- `user.user_metadata.onboarded` is not `true`.
- Non-authenticated visitors never see onboarding.

**When it hides (permanently, cross-device):**
- User clicks **Start reading** (hero or footer CTA) or **Skip for now** (header).
- Both actions call `supabase.auth.updateUser({ data: { onboarded: true } })`.
- `useOnboarding` also sets local `dismissed` state optimistically to prevent re-show flicker while the metadata write completes.

**Flow:**
1. `AppShell` mounts the main app normally (sidebar, episode viewer, media player, etc.).
2. `OnboardingOverlay` renders as a fixed full-screen layer above the app (`z-index: 600`, above the media player's `500`).
3. Dismissing the overlay reveals the app instantly — no route change.

**UI structure (`OnboardingOverlay.tsx`):**
- Sticky frosted header with `BookOpen` + "Hebrew Time" branding and a skip button.
- Hero with value proposition, accent headline, and primary CTA.
- 2×2 feature card grid (1 column on mobile) covering:
  - Multilingual side-by-side reading (with CSS mockup of Hebrew + translation rows; copy via `useT()`).
  - Click-to-translate with Pealim-backed Nekudot and meanings (highlighted word + translation popup mockup).
  - Vocabulary & FSRS flashcards (mini table with Due/Learned/New badges).
  - Audio-synced paragraph highlighting (active paragraph + mini player mockup).
- Footer CTA with pricing note ("Free to read · Premium from $10/month").

**Accessibility:** Reuses `useModalAccessibility` for focus trap and Escape-to-dismiss (`role="dialog"`, `aria-modal`).

**Styling:** `src/app/styles/onboarding.css` — imported via `globals.css`. Uses existing design tokens (`--text-main`, `--accent`, etc.), Inter for UI text, and `.font-serif` (Noto Serif Hebrew) for Hebrew mockup snippets.

**Testing / reset:** To re-trigger onboarding for a test account, clear the flag in Supabase (SQL Editor or Auth dashboard):

```sql
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data - 'onboarded'
WHERE email = 'your@email.com';
```

## File Structure Highlights

### Content pipeline

- `/scraper.py` - Core scraping and paragraph translation logic for legacy intermediate episodes.
- `/apply_scraping_patch.py` - Patches missing transcript paragraphs in `episodes.json`.
- `/patch_audio.py` - Normalizes/fixes episode `audio_url` values in `episodes.json`.
- `/scripts/sync_episode_1.py` - Whisper alignment (uses `scripts/lib/alignment.py`).
- `/scripts/generate_episodes.py` - AI generated-level episode pipeline (OpenAI → sentence-level Gemini TTS timing → Supabase).
- `/scripts/verify_gcp_tts.py` - Verifies GCP credentials, Vertex AI permissions, and Gemini 3.1 Flash TTS access.
- `/scripts/migrate_episodes_to_supabase.py` - One-time `episodes.json` → Supabase migration.
- `/scripts/lib/alignment.py` - Whisper paragraph/sentence alignment helpers.
- `/scripts/generated/` - Durable script banks (`beginner_scripts.json`, `intermediate-2_scripts.json`, `advanced_scripts.json`). Commit these; used by `--audio-only` runs.
- `/scripts/.checkpoints/` - Local pipeline cache (gitignored). Disposable after Supabase verification.
- `/beginner_curriculum.json` - 20-episode beginner curriculum and TTS/narrator config.
- `/intermediate_2_curriculum.json` - 20-episode generated Intermediate 2 curriculum (`--level intermediate-2`).
- `/advanced_curriculum.json` - 20-episode generated Advanced curriculum and TTS/narrator config.
- `/episodes.json` - Legacy intermediate archive and migration source; local fallback when Supabase is empty.
- `/requirements.txt` - Python dependencies for scraper and content pipeline.
- `/docs/beginner-track/` - Implementation task specs for the multi-level content pipeline.

### App source

- `/src/app/page.tsx` - The main server-rendered entrypoint.
- `/src/app/admin/page.tsx` - Admin dashboard route (`/admin`) for usage stats and premium management.
- `/src/app/actions.ts` - Server actions: premium checks, admin stats, `translateWord` (Pealim-first + OpenAI fallback), `getDictionaryEntryDetails`, `generateExamplePhrases`.
- `/src/app/update-password/page.tsx` - Password reset callback (recovery redirect session via `getSession()`, then `updateUser()`).
- `/src/app/api/episode/[level]/[id]/route.ts` - Level-aware episode JSON API (dynamic/no-store so regenerated episodes appear immediately).
- `/src/app/api/episode-audio/[level]/[id]/route.ts` - Supabase Storage audio proxy using server-side service role auth.
- `/src/app/api/levels/route.ts` - Available learning levels API (1-hour cache).
- `/src/app/api/audio/route.ts` - Google Drive-only audio proxy with host allowlist (bypasses Drive streaming restrictions).
- `/src/lib/episodes.ts` - Server-side episode loader (Supabase primary, `episodes.json` fallback).
- `/src/lib/levelTracks.ts` - Level metadata builder (finished counts, resume episode, progress).
- `/src/lib/episodeAudio.ts` - Routes audio URLs to the correct proxy endpoint.
- `/src/lib/actionGuards.ts` - Input bounds and in-memory rate limiting for OpenAI server actions.
- `/src/lib/allowedAudioHosts.ts` - HTTPS allowlist used by the audio proxy.
- `/src/lib/fsrs.ts` - FSRS scheduler wrapper (ts-fsrs) for review intervals and retrievability stats.
- `/src/lib/dictionaryLookup.ts` - Pealim dictionary candidate search (headword, forms JSONB, trigram fuzzy).
- `/src/lib/dictionaryTableLayout.ts` - Conjugation table pivot layout (handles merged colspan cells).
- `/src/lib/types.ts` - Shared types: `VocabWord`, `DictionaryEntry`, `DictionaryForm`, `ExamplePhrase`, flashcard types.
- `/src/components/LearningTrackSelector.tsx` - Level-switching dropdown with progress and resume.
- `/src/components/MediaPlayer.tsx` - Custom bottom audio player with large-touch-target seek bar for mobile.
- `/src/components/AdminDashboard.tsx` - Admin-only dashboard UI for usage stats and premium grant/revoke.
- `/src/components/OnboardingOverlay.tsx` - Full-screen first-login onboarding landing page with feature cards and CSS mockups.
- `/src/components/ExamplePhrasesPanel.tsx` - Shared UI for AI-generated example phrase lists (Vocabulary + Flashcards).
- `/src/components/DictionaryDetailsModal.tsx` - Pealim conjugation/inflection tables with audio.
- `/src/components/TranslationModal.tsx` - Click-to-translate popup with save and link to conjugations.
- `/src/hooks/useOnboarding.ts` - First-login onboarding visibility and Supabase user-metadata persistence.
- `/src/hooks/useUsageTracking.ts` - Active site-time tracking for authenticated users.
- `/src/app/globals.css` - Entry point that imports modular stylesheets from `/src/app/styles/`.
- `/src/app/styles/` - Split design system: `base.css`, `sidebar.css`, `layout.css`, `vocabulary.css`, `vocabulary-interactive.css`, `responsive.css`, `modals.css`, `media-player.css`, `flashcards.css`, `example-phrases.css`, `dictionary-details.css`, `onboarding.css`, `admin.css`, and related partials.
- `/docs/dictionary_entries.md` - Canonical reference for `dictionary_entries` schema, `forms`/`conjugation_sections` JSONB shapes, and query patterns.

### Database migrations

- `/supabase/beginner-track-migration.sql` - Levels, episodes tables, finished_episodes level migration.
- `/supabase/premium-rls-migration.sql` - Premium-aware RLS migration for existing Supabase projects.
- `/supabase/fsrs-migration.sql` - Adds FSRS columns to `flashcard_progress` for existing Supabase projects.
- `/supabase/dictionary-migration.sql` - Pealim `dictionary_entries` table and `vocabulary.dictionary_pealim_id` FK.
- `/supabase/dictionary-trgm-migration.sql` - `pg_trgm` extension and fuzzy `match_dictionary_word()` RPC for dictionary lookup.
- `/supabase/multilingual-translations.sql` - `episodes.translations` JSONB column for six-language paragraph maps.
- `/supabase/admin-usage-stats-migration.sql` - Adds `user_activity_daily` and `increment_user_activity()` for admin usage stats.

## Artifact Hygiene

| Path | Commit to git? | Role |
|------|----------------|------|
| `*_curriculum.json` | Yes | Pipeline source config (narrator, TTS, episode outlines). |
| `scripts/generated/*_scripts.json` | Yes | Reviewed script bank; input for `--audio-only` runs. |
| `episodes.json` | Yes | Legacy intermediate archive and migration source. |
| `scripts/.checkpoints/` | No (gitignored) | Local pipeline cache (MP3 + alignment JSON). Safe to delete after Supabase verification; regeneration re-runs TTS. |
| `secrets/` | No (gitignored) | GCP service account JSON keys. |
| `__pycache__/`, `*.pyc` | No (gitignored) | Python bytecode. |
| `episodes.json.bak.*`, `episodes_checkpoint.json` | No (gitignored) | Scraper resume/backup artifacts. |
