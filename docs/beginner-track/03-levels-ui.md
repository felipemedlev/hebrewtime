# Task 03 — Level-Aware UI

## Sidebar

Add a segmented control above the episode search when `viewMode === "episodes"`:

```
[ Beginner ] [ Intermediate ]
```

- Persist selection in `localStorage` key `hebrewtime-level`
- Filter episode list by selected level
- Episode numbers restart per level (01, 02, …)

## AppShell

- State: `currentLevel: string`
- `navigateToEpisode(level, num)` → fetch `/api/episode/${level}/${num}`
- Pass `levels`, `currentLevel`, `onChangeLevel` to Sidebar
- Finished episodes keyed by `${level}:${num}`

## useFinishedEpisodes

- Supabase reads/writes include `level_slug`
- Local storage stores `{ level, episode_number }[]` or composite keys

## CSS

Add `.level-selector` styles in [`src/app/styles/sidebar.css`](../../src/app/styles/sidebar.css).
