# Task 07 — Audio Alignment

## Primary Approach for Generated Beginner Episodes

Generated beginner episodes no longer rely on Whisper for synchronization.

Because the pipeline creates the audio itself, [`scripts/generate_episodes.py`](../../scripts/generate_episodes.py) synthesizes **each Hebrew sentence separately**, concatenates the sentence audio with short silences, and records exact `start` / `end` timestamps from the running MP3 duration.

This produces much tighter frontend highlighting than post-hoc Whisper alignment.

Checkpoint rows store:

```json
{
  "alignment_method": "direct_sentence_tts",
  "aligned_paragraphs": [
    {
      "text": "...",
      "start": 0.0,
      "end": 12.4,
      "sentences": [
        { "text": "...", "start": 0.0, "end": 3.2 }
      ]
    }
  ]
}
```

## Whisper Fallback Module

[`scripts/lib/alignment.py`](../../scripts/lib/alignment.py)

Whisper alignment remains useful for external/legacy audio, such as existing intermediate podcast files. It was extracted from [`scripts/sync_episode_1.py`](../../scripts/sync_episode_1.py) with extensions:

### `align_paragraphs(original_paras, whisper_segments) -> list[dict]`

Returns paragraph objects with `text`, `start`, `end`.

### `split_sentences(paragraph_timing, sentence_texts) -> list[dict]`

Given a paragraph timing and list of sentence strings, proportionally or via sub-alignment assign `start`/`end` per sentence.

### `align_episode(hebrew_paragraphs, audio_path, client) -> list[dict]`

Full pipeline: Whisper transcribe → paragraph align → sentence split.

## Whisper Sentence Splitting Heuristic

1. Split paragraph text on Hebrew sentence terminators (`。` `.` `!` `?` `…`)
2. Within paragraph time window, distribute Whisper segment boundaries to sentences sequentially
3. Ensure monotonic timestamps

## Whisper Config

```python
client.audio.transcriptions.create(
  model="whisper-1",
  response_format="verbose_json",
  timestamp_granularities=["segment"],
  language="he",
)
```
