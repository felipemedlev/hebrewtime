# Task 04 — Sentence-Level Highlighting

## Behavior

When `hebrew_paragraphs[i].sentences` exists:
- Render each sentence as a `<span class="sentence-span">`
- Highlight active sentence where `currentTime ∈ [start, end]`
- Auto-scroll active sentence into view

When `sentences` is absent (legacy intermediate):
- Fall back to paragraph-level highlight (existing behavior)

## Active Index Resolution

```typescript
function findActiveSentence(paragraph, currentTime): number | null
function findActiveParagraph(episode, currentTime): { paraIdx, sentenceIdx? }
```

## Word Clicks

Token splitting remains per-sentence; `handleWordClick(token, sentenceText, engSentence)`.

## CSS

Add `.sentence-span.active-sentence` in [`src/app/styles/vocabulary-interactive.css`](../../src/app/styles/vocabulary-interactive.css).
