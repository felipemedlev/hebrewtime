# HebrewTime

HebrewTime is a multilingual web reader for the Hebrew Time podcast and AI generated learning tracks. Learners read Hebrew with side by side translations in **English**, **Russian**, **Ukrainian**, **Portuguese**, **Spanish**, or **French**, click words for Pealim backed dictionary lookup, save vocabulary, and review with FSRS flashcards.

## Learning tracks

| Level | Source | CEFR |
|-------|--------|------|
| Beginner | AI generated | A1 |
| Intermediate | Original podcast (legacy) | B1 |
| Intermediate 2 | AI generated | B1 |
| Advanced | AI generated | B2 |

## Tech stack

- **App**: Next.js 16, React 19, vanilla CSS, Supabase (auth + Postgres + Storage)
- **Content pipeline**: Python (`pipeline/`) for scraping, AI script generation, Gemini TTS, and Supabase upload
- **Dictionary**: Pealim data in `dictionary_entries` (see [`docs/dictionary_entries.md`](docs/dictionary_entries.md))

## Quick start

### 1. Environment

Create `.env` at the repo root:

```env
OPENAI_API_KEY=sk-your-openai-api-key-here
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ADMIN_EMAILS=admin1@example.com
GOOGLE_APPLICATION_CREDENTIALS=/path/to/gcp-service-account.json
SUPABASE_AUDIO_BUCKET=episode-audio
```

### 2. Database

Run migrations in order from [`supabase/migrations/`](supabase/migrations/). See [`docs/database.md`](docs/database.md) for details.

### 3. Run the app

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 4. Generate content (optional)

```bash
pip install -r pipeline/requirements.txt
python3 pipeline/generate_episodes.py --list-levels
python3 pipeline/generate_episodes.py --level beginner --scripts-only
```

Full pipeline guide: [`pipeline/README.md`](pipeline/README.md).

## Repository layout

```
hebrewtime/
├── src/                    Next.js app (components, hooks, API routes)
├── public/                 Static assets
├── docs/
│   ├── architecture.md     App internals, i18n, dictionary, premium rules
│   ├── database.md         Schema and migration order
│   └── dictionary_entries.md
├── supabase/migrations/    Numbered SQL migrations (run in order)
└── pipeline/               Python content generation
    ├── generate_episodes.py
    ├── curriculum/         Level configs (beginner.json, intermediate-2.json, advanced.json)
    ├── data/
    │   ├── scripts/        Reviewed script banks (committed)
    │   └── episodes.json   Legacy intermediate archive + local dev fallback
    └── legacy/             Original podcast scraper and patch tools
```

## Documentation

| Doc | Contents |
|-----|----------|
| [`docs/architecture.md`](docs/architecture.md) | Components, hooks, data layer, i18n, dictionary lookup, premium/free tier |
| [`docs/database.md`](docs/database.md) | Migration order, RLS, schema reference |
| [`pipeline/README.md`](pipeline/README.md) | Content generation workflow, CLI flags, how to add a new level |
| [`docs/dictionary_entries.md`](docs/dictionary_entries.md) | Pealim dictionary schema and JSONB shapes |

## Artifact hygiene

| Path | Commit? | Role |
|------|---------|------|
| `pipeline/curriculum/*.json` | Yes | Pipeline source config |
| `pipeline/data/scripts/*.json` | Yes | Reviewed script banks for `--audio-only` |
| `pipeline/data/episodes.json` | Yes | Legacy intermediate archive + app fallback |
| `pipeline/.checkpoints/` | No | Local TTS/alignment cache |
| `secrets/` | No | GCP service account keys |

## Premium access (summary)

- **Logged out**: read episodes, translate up to daily free limit (client side quota)
- **Authenticated free**: vocabulary, flashcards, example phrases with per day caps
- **Premium**: unlimited translations, vocabulary, flashcards, and example phrases
- **Admin** (`ADMIN_EMAILS`): `/admin` dashboard + premium management

Details: [`docs/architecture.md`](docs/architecture.md#premium-and-free-tier).
