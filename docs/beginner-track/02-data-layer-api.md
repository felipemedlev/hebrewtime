# Task 02 — Data Layer & API

## `src/lib/episodes.ts`

Server-only Supabase REST client using `SUPABASE_SERVICE_ROLE_KEY`.

### Functions

| Function | Returns |
|----------|---------|
| `getLevels()` | `Level[]` sorted by `sort_order` |
| `getEpisodesList(level)` | `EpisodeListItem[]` |
| `getEpisode(level, num)` | `Episode \| null` |
| `getFirstEpisodeNum(level)` | `number \| null` |
| `getDefaultLevel()` | first level slug |

### Mapping

DB row → `Episode`:
- `id`, `level` ← `level_slug`, `episode` ← `episode_number`
- `hebrew_paragraphs`, `english_paragraphs` parsed from JSONB

## API Routes

### `GET /api/episode/[level]/[id]`

- ISR via `generateStaticParams` querying published episodes
- `revalidate = 3600`

### `GET /api/levels`

- Returns all levels for client hydration if needed

## Page

[`src/app/page.tsx`](../../src/app/page.tsx) becomes async, loads levels + default episode server-side.

## Deprecation

- Remove reads from `episodes.json`
- Delete old `/api/episode/[id]/route.ts`
