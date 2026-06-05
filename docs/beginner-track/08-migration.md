# Task 08 — episodes.json Migration

## Script

[`scripts/migrate_episodes_to_supabase.py`](../../scripts/migrate_episodes_to_supabase.py)

### Usage

```bash
python scripts/migrate_episodes_to_supabase.py
python scripts/migrate_episodes_to_supabase.py --dry-run
```

### Behavior

1. Ensure `levels` seeded (`beginner`, `intermediate`)
2. Read `episodes.json`
3. For each episode, upsert into `episodes` with `level_slug = 'intermediate'`
4. Preserve existing paragraph timing objects (Episode 1 timestamps intact)
5. Map `episode` → `episode_number`, normalize titles

### Audio URLs

Intermediate episodes keep existing Google Drive / external URLs. No re-upload required.

### After Migration

- App reads from Supabase only
- Keep `episodes.json` as archive (do not delete from repo yet)
