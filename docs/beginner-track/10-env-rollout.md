# Task 10 — Environment & Rollout

## New Environment Variables

```env
# Existing (required)
OPENAI_API_KEY=sk-...
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# New
GOOGLE_APPLICATION_CREDENTIALS=/path/to/gcp-service-account.json  # OAuth2; API keys do NOT work for Gemini TTS
SUPABASE_AUDIO_BUCKET=episode-audio
```

## Python Dependencies

Add to `requirements.txt`:

```
openai>=1.0
python-dotenv
requests
beautifulsoup4
google-auth
pydub
```

System: `ffmpeg` (required by pydub)

Python 3.13+: `audioop` was removed from the stdlib; install `audioop-lts` (included in `requirements.txt` for 3.13+).

## Supabase Setup Checklist

1. Run `supabase/beginner-track-migration.sql` in SQL Editor
2. Create Storage bucket `episode-audio` (public)
3. Run `python scripts/migrate_episodes_to_supabase.py`
4. Run `python scripts/generate_episodes.py --level beginner`
5. Run `python scripts/generate_episodes.py --level intermediate-2 --curriculum intermediate_2_curriculum.json`
6. Run `python scripts/generate_episodes.py --level advanced --curriculum advanced_curriculum.json`

## Vercel Deployment

Add new env vars in Vercel project settings. No build-time dependency on `episodes.json`.

## Verification

- [ ] Level selector shows Beginner + Intermediate + Intermediate 2 + Advanced
- [ ] Intermediate episodes load from Supabase
- [ ] Beginner Episode 1 plays with sentence highlighting
- [ ] Intermediate 2 Episode 1 plays with sentence highlighting
- [ ] Advanced Episode 1 plays with sentence highlighting
- [ ] Finished state persists per level
- [ ] Vocabulary save works from generated episodes
