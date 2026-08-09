# App architecture

## Overview

HebrewTime is a Next.js 16 App Router application. Episodes load from Supabase at runtime, with a local JSON fallback for legacy intermediate content when Supabase has no rows.

```
Browser → Next.js (Server Components + API routes)
              ↓
         Supabase PostgreSQL (episodes, vocabulary, flashcards)
              ↓
         Supabase Storage (episode audio)
              ↓
         OpenAI (dictionary miss, gloss translation, example phrases)
```

## Data layer

| File | Role |
|------|------|
| `src/lib/episodes.ts` | Primary episode loader (Supabase, `no-store`; falls back to `pipeline/data/episodes.json`) |
| `src/lib/levelTracks.ts` | Level metadata: finished counts, resume episode, progress |
| `src/lib/episodeAudio.ts` | Routes audio URLs to `/api/audio` (Google Drive) or `/api/episode-audio/[level]/[id]` |
| `src/lib/episodeTranslations.ts` | Resolves `translations` JSONB for active UI language |
| `src/lib/types.ts` | Shared TypeScript types |

### API routes

| Route | Purpose |
|-------|---------|
| `/api/levels` | Available learning tracks (1 hour cache) |
| `/api/episode/[level]/[id]` | Single episode JSON (dynamic, no store) |
| `/api/episode-audio/[level]/[id]` | Supabase Storage audio proxy |
| `/api/audio` | Google Drive audio proxy (host allowlist) |
| `/api/dictionary/suggest` | Dictionary autocomplete |

## Components

| Component | Role |
|-----------|------|
| `AppShell.tsx` | Main layout, view gating, subscription upsell, example phrase orchestration |
| `Sidebar.tsx` | Navigation, search, tab switching |
| `EpisodeViewer.tsx` | Hebrew + translation reading, word click, modals |
| `LearningTrackSelector.tsx` | Level dropdown with progress |
| `LanguageSelector.tsx` | UI language picker |
| `VocabularyView.tsx` | Saved words table/cards, inline edit, FAB to add words |
| `ReviewView.tsx` | Review hub: flashcards, fill in, matching, reverse cards, stats |
| `FlashcardsView.tsx` | FSRS forward card sessions |
| `TranslationModal.tsx` | Compact word translation popup |
| `DictionaryDetailsModal.tsx` | Pealim conjugation tables |
| `ExamplePhrasesPanel.tsx` | Shared example phrase UI |
| `OnboardingOverlay.tsx` | First login landing page |
| `AdminDashboard.tsx` | `/admin` usage stats and premium management |

## Hooks

| Hook | Role |
|------|------|
| `useVocabulary.ts` | Vocabulary sync to Supabase |
| `useFlashcards.ts` | FSRS review scheduling |
| `useEntitlements.ts` | Auth/premium/admin status |
| `useFinishedEpisodes.ts` | Per level finished state (localStorage + Supabase) |
| `useOnboarding.ts` | First login overlay visibility |
| `useUsageTracking.ts` | Active site time for admin stats |
| `useModalAccessibility.ts` | Focus trap, Escape, body scroll lock |

## Internationalization

Dependency free client side catalogs in `src/lib/i18n/`.

- `types.ts`: `LangCode` (`en`, `ru`, `uk`, `pt`, `es`, `fr`)
- `messages.ts`: all UI strings
- `LanguageProvider.tsx`: `lang`, `setLang`, `t()`, blur toggle

Preference stored in `localStorage` (`hebrewtime-language`) and synced to `user_metadata.preferred_language` when logged in.

Episode translations use `episodes.translations` JSONB (paragraph arrays per language). `english_paragraphs` kept for backward compatibility.

## Dictionary lookup

Order in `src/lib/dictionaryLookup.ts`:

1. Exact headword match on `dictionary_entries.word`
2. Strip up to 3 Hebrew prefixes (ה, ו, ב, כ, ל, מ/מה, ש)
3. Conjugated form match via `forms[].hebrew_plain`
4. Fuzzy match via `pg_trgm` (`match_dictionary_word()` RPC)
5. OpenAI fallback when steps 1–4 find nothing, or to disambiguate homonyms

Dictionary hits return Pealim lemma, Nekudot, transliteration, and meaning. Non English UI languages get gloss translation via a small OpenAI call.

Saved words store `dictionary_pealim_id` when available, enabling conjugation modals later.

See [`dictionary_entries.md`](dictionary_entries.md) for schema details.

## Lemma rules (vocabulary saves)

- **Nouns** → singular indefinite (e.g. הַנּוֹשֵׂא → `נושא`)
- **Verbs** → infinitive (e.g. מְדַמְיֵן → `לדמיין`)
- Translations omit articles and infinitive markers

## Server actions (`src/app/actions.ts`)

| Action | Auth | Notes |
|--------|------|-------|
| `translateWord` | Optional (rate limited) | Pealim first, OpenAI fallback |
| `getDictionaryEntryDetails` | None | Lazy conjugation payload |
| `generateExamplePhrases` | Required | Cached in `vocabulary.example_phrases` |
| Admin/premium actions | Admin only | Grant/revoke premium, usage stats |

Rate limits and input bounds: `src/lib/actionGuards.ts`.

## Audio synchronization

- **Generated tracks** (Beginner, Intermediate 2, Advanced): sentence level timestamps from Gemini TTS pipeline (`alignment_method: direct_sentence_tts`)
- **Legacy Intermediate**: Whisper alignment via `pipeline/lib/alignment.py` and `pipeline/align_legacy_episode.py`

Frontend highlights current sentence/paragraph in `EpisodeViewer.tsx` based on `hebrew_paragraphs` timing objects.

## Premium and free tier

| User type | Episodes | Translate | Vocabulary | Flashcards | Examples |
|-----------|----------|-----------|------------|------------|----------|
| Logged out | Yes | Daily limit (localStorage) | No (auth required) | No | No |
| Free authenticated | Yes | Daily limit (server) | Yes (capped) | Yes (capped) | Yes (capped) |
| Premium | Yes | Unlimited | Unlimited | Unlimited | Unlimited |
| Admin | Yes | Unlimited | Unlimited | Unlimited | Unlimited |

Blocked actions show a sticky subscription upsell panel ($10/month messaging).

## Security notes

- OpenAI actions enforce per requester rate limits in `src/lib/actionGuards.ts`
- Audio proxy `/api/audio` only accepts HTTPS Google Drive URLs
- Supabase Storage audio streamed via service role, not end user auth
- Dictionary reads use `supabaseAdmin` server side so anonymous translation works

## Onboarding

First login shows `OnboardingOverlay` until user clicks "Start reading" or "Skip". Persisted in `user_metadata.onboarded` via `supabase.auth.updateUser`.

## Password recovery

"Forgot password" in `AuthModal` → Supabase email → `/update-password` sets new password after recovery session init.

## Styling

Vanilla CSS split under `src/app/styles/`, imported via `globals.css`. No CSS framework.
