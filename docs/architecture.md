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
         OpenAI (dictionary miss, gloss translation, example phrases, Realtime voice)
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
| `ReviewStatsView.tsx` | Practice stats dashboard with hero ring, modality cards, weak words, share |
| `StatRing.tsx` | SVG progress ring for stats hero and session recap |
| `SessionRecapScreen.tsx` | Fill-in / matching session complete screen with score ring and share |
| `FlashcardsView.tsx` | FSRS forward card sessions |
| `TranslationModal.tsx` | Compact word translation popup |
| `DictionaryDetailsModal.tsx` | Pealim conjugation tables |
| `ExamplePhrasesPanel.tsx` | Shared example phrase UI |
| `OnboardingOverlay.tsx` | First login landing page |
| `SpeakView.tsx` | Hebrew speaking practice via OpenAI Realtime (WebRTC) |
| `AdminDashboard.tsx` | `/admin` usage stats and premium management |

## Hooks

| Hook | Role |
|------|------|
| `useVocabulary.ts` | Vocabulary sync to Supabase |
| `useFlashcards.ts` | FSRS review scheduling; session queue picks newest due cards first and deprioritizes cards reviewed in the last 30 minutes |
| `useEntitlements.ts` | Auth/premium/admin status |
| `useFinishedEpisodes.ts` | Per level finished state (localStorage + Supabase) |
| `useOnboarding.ts` | First login overlay visibility |
| `useUsageTracking.ts` | Active site time for admin stats |
| `useReviewPracticeStats.ts` | Fill-in and matching attempt stats; feeds `reviewStatsSummary` |
| `useModalAccessibility.ts` | Focus trap, Escape, body scroll lock |
| `useSpeakProfile.ts` | Load/save `speak_profiles` (preferences, learner facts, summary) |
| `useSpeakSession.ts` | OpenAI Realtime WebRTC session (`@openai/agents/realtime`) |

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

### Practice stats summary

[`src/lib/reviewStatsSummary.ts`](../src/lib/reviewStatsSummary.ts) derives dashboard headline metrics client side from `FlashcardStats`, `ReviewPracticeStats`, and practice attempt timestamps (combined 7-day accuracy, practiced today, practice day streak). No extra database queries.

See [`dictionary_entries.md`](dictionary_entries.md) for schema details.

## Lemma rules (vocabulary saves)

- **Nouns** → singular indefinite (e.g. הַנּוֹשֵׂא → `נושא`)
- **Verbs** → infinitive (e.g. מְדַמְיֵן → `לדמיין`)
- Translations omit articles and infinitive markers

## Phrase saves

Users can add **phrases** manually from the vocabulary view (+ button → Phrase tab). They type Hebrew and translation themselves. No Pealim lookup and no OpenAI translation. Stored with `entry_kind = 'phrase'`; `dictionary_pealim_id` stays null.

## Server actions (`src/app/actions.ts`)

| Action | Auth | Notes |
|--------|------|-------|
| `translateWord` | Optional (rate limited) | Pealim first, OpenAI fallback |
| `getDictionaryEntryDetails` | None | Lazy conjugation payload |
| `generateExamplePhrases` | Required | Cached in `vocabulary.example_phrases` |
| `createSpeakSession` | Required | Mints OpenAI Realtime client secret; free tier daily cap |
| Admin/premium actions | Admin only | Grant/revoke premium, usage stats |

Rate limits and input bounds: `src/lib/actionGuards.ts`.

## Speak with AI (Realtime voice)

Fourth sidebar tab (`viewMode: "speak"`). Learners talk to a patient Hebrew teacher over **OpenAI Realtime** (`gpt-realtime-2.1` or cheaper `gpt-realtime-2.1-mini`) using **WebRTC** in the browser via `@openai/agents/realtime`.

**Setup (before Start):** teacher voice (female `marin` / male `cedar`), learner form of address (`אתה` / `את`), Hebrew level, model quality vs cost, speaking speed (0.25–1.5; defaults 0.6 / 0.8 / 1.0 by level until the learner moves the slider).

**Session flow:**

1. Client calls `createSpeakSession` (auth + free-tier daily check).
2. Server picks a fresh conversation spark (not a roleplay), builds teacher instructions from `src/lib/speak/teacherPrompt.ts` + stored `speak_profiles` facts/summary/session notes + due vocabulary and current episode words.
3. Server mints ephemeral key via `POST /v1/realtime/client_secrets` (API key never sent to browser).
4. Client connects `RealtimeSession`; audio only (no transcription/captions). Greeting is triggered with `response.create` (no extra user turn). Mic permission and the Realtime SDK preload in parallel with minting the key.
5. Agent tools (`save_learner_facts`, `update_conversation_summary`, `save_session_recap`) write to `speak_profiles` via RLS without blocking the next audio turn; recap phrases can be saved to vocabulary.

**Teacher behavior:** free conversation (no café/directions/phone scenes). One short callback to known facts, then a new spark with a modeled sentence and an open question (מה / איך / ספר), not a this-or-that. Follows the learner. Light spoken-error correction (one recast per turn, then a yes/no reuse prompt), simpler Hebrew then brief English if learner is lost. Turn detection is `semantic_vad` (model decides when the learner finished speaking): eagerness `low` beginner (no barge-in), `medium` intermediate, `high` advanced. No full transcripts stored—only JSONB facts + ≤500 char English summary + short session notes (including recent spark ids so calls do not repeat).

**In-call help:** I don't understand, slower, shorter, starter sentence, skip topic, repeat after me, and an "I'm thinking" mic pause.

**Free tier:** 1 session/day, hard stop at ~3 minutes with a ~20 second recap/goodbye window. Premium/admin: unlimited. Episode player pauses while a speak session is active.

**Security:** `Permissions-Policy: microphone=(self)`; CSP `connect-src` includes `api.openai.com` and `*.openai.com`. `OpenAI-Safety-Identifier` header uses SHA-256 of `user_id`.

Key files: `src/lib/speak/`, `src/components/SpeakView.tsx`, `src/hooks/useSpeakProfile.ts`, `src/hooks/useSpeakSession.ts`, `src/app/styles/speak.css`.

## Audio synchronization

- **Generated tracks** (Beginner, Intermediate 2, Advanced): sentence level timestamps from Gemini TTS pipeline (`alignment_method: direct_sentence_tts`)
- **Legacy Intermediate**: Whisper alignment via `pipeline/lib/alignment.py` and `pipeline/align_legacy_episode.py`

Frontend highlights current sentence/paragraph in `EpisodeViewer.tsx` based on `hebrew_paragraphs` timing objects.

## Premium and free tier

| User type | Episodes | Translate | Vocabulary | Flashcards | Examples | Speak |
|-----------|----------|-----------|------------|------------|----------|-------|
| Logged out | Yes | Daily limit (localStorage) | No (auth required) | No | No | No (login CTA) |
| Free authenticated | Yes | Daily limit (server) | Yes (capped) | Yes (capped) | Yes (capped) | 1 session/day (~3 min) |
| Premium | Yes | Unlimited | Unlimited | Unlimited | Unlimited | Unlimited |
| Admin | Yes | Unlimited | Unlimited | Unlimited | Unlimited | Unlimited |

Blocked actions show a sticky subscription upsell panel ($10/month messaging).

## Security notes

- OpenAI actions enforce per requester rate limits in `src/lib/actionGuards.ts`
- Audio proxy `/api/audio` only accepts HTTPS Google Drive URLs
- Supabase Storage audio streamed via service role, not end user auth
- Dictionary reads use `supabaseAdmin` server side so anonymous translation works
- Realtime speak sessions mint ephemeral keys server-side; microphone allowed only for same-origin (`microphone=(self)`)

## Onboarding

First login shows `OnboardingOverlay` until user clicks "Start reading" or "Skip". Persisted in `user_metadata.onboarded` via `supabase.auth.updateUser`.

## Password recovery

"Forgot password" in `AuthModal` → Supabase email → `/update-password` sets new password after recovery session init.

## Styling

Vanilla CSS split under `src/app/styles/`, imported via `globals.css`. No CSS framework.
