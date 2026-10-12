# Intermediate episode audio repair

Completed on 12 October 2026, Asia/Jerusalem.

Intermediate episodes 14 to 19 now use the existing Supabase audio storage and application streaming endpoint.

## Files changed

1. `pipeline/data/episodes.json`: changed only the six audio URLs. This keeps later imports from restoring the old links.
2. `scripts/repair_intermediate_audio.mjs`: prepares the files, checks episode identity, uploads without overwriting existing objects, compares complete file hashes, updates only audio URLs, and saves a report with the previous URLs.
3. `scripts/verify_intermediate_audio.mjs`: checks episode metadata and compares application audio responses with original file bytes at three positions.
4. `.gitignore`: excludes the recovered episode 19 MP3 from Git.
5. `outputs/episode_audio_repair_1791752887680/report.json`: preparation report.
6. `outputs/episode_audio_repair_1791752900568/report.json`: completed repair report, including source files, byte counts, durations, hashes, and previous URLs.
7. `outputs/episode_audio_repair_1791752900568/verification_1791752976841.json`: application streaming verification.

The five supplied files in `missing_audios` are unchanged. The recovered file is `inputs/episode_audio_repair/HT_19_FULL.mp3`.

## Queries and updates

Source of truth: published records in the Supabase `episodes` table, the supplied MP3 files, and episode 19's original Google Drive link from its episode record.

Grain: one row and one audio file per level and episode number.

Read episode identity, audio URL, and publication status for level `intermediate`, episode numbers 14 to 19. Read the existing storage object list. Updated only `audio_url` in six existing records, with filters for record ID, level, episode number, publication status, and previous audio URL. Queried the six rows again after the updates. No SQL or schema changes were needed.

Row counts before and after: six. Duplicate episode numbers: zero. All six records are published. No matching storage objects existed before this repair. The new objects are `intermediate/14.mp3` through `intermediate/19.mp3` in the configured `episode-audio` bucket.

Snapshot: the report records the actual preparation and repair times in UTC. This repair covers episode numbers, so a content date range does not apply.

## Findings and validation

Episodes 14 to 18 had Dropbox page URLs with `dl=0`. The scraper had found those links, but the player used them directly instead of downloading MP3 bytes.

Episode 19 had a Google Drive URL. Its source still returned `audio/mpeg` and identified the file as `HT_19_FULL.mp3`. Recovered it and moved it into the same storage used for the other repaired episodes.

All six supplied or recovered files contain valid MP3 streams and decode completely without errors. Uploaded bytes total 155,566,423. Every stored file was downloaded and its SHA256 compared with the original file. All six matched.

The application episode API returned the new audio URLs for all six episodes. Eighteen audio range requests, covering the start, middle, and end of each file, returned HTTP 206, an audio content type, correct content ranges, and exact matching bytes. This checks streaming and seeking through the existing application route.

Seven existing tests for audio range validation and episode request parsing passed. Both maintenance scripts passed lint. The focused diff has no whitespace errors.

## Assumptions and caveats

Episode numbers were taken from the numeric text after the first underscore in each supplied filename. All five numbers were unique and matched existing published episodes. Episode 19 used the source already associated with that episode and its matching download filename.

Application endpoint checks ran against a local instance connected to the live Supabase project. A hosted browser session was not checked. No application code change or deployment is required for the live database audio links. Storage access policies and bucket visibility were preserved. The player uses its existing server route for these URLs.

Other existing working changes were preserved. No commit was made.

## Next steps

Refresh the application or reopen an affected episode to load its new audio URL.

To prepare the repair again, run:

```sh
node --env-file=.env scripts/repair_intermediate_audio.mjs
```

To apply the prepared repair, use the same command with `--apply`. The script refuses to replace an existing object with different bytes.

To verify against a running local application:

```sh
node scripts/verify_intermediate_audio.mjs outputs/episode_audio_repair_1791752900568/report.json
```

The completed repair report preserves the previous database and catalog URLs for rollback if needed.
