# Deleted vocabulary review fix

Date: 2026 October 11, Asia/Jerusalem.

The user confirmed that the failing card was vocabulary they had deleted previously. Active review sessions retained deleted entries. The server correctly rejected reviews when the referenced vocabulary was no longer owned by the signed in user. The problem applied to both words and phrases.

Forward and reverse sessions now remove entries missing from current vocabulary. Session positions count the remaining reviewed entries, so deletion before the current card does not skip the next card. Removing the current card hides the next answer. Sessions end when no unreviewed entries remain. Resumed sessions use the same logic. A failed ownership check refreshes vocabulary so deletion in another tab can be detected. Ordinary network failures remain retryable.

Changed code: FlashcardsView.tsx, ReverseCardsView.tsx, AppShell.tsx, useFlashcards.ts, useVocabulary.ts, and flashcardSession.ts. Regression coverage is in ReverseCardsView.test.ts, useFlashcards.test.ts, useVocabulary.test.ts, and flashcardSession.test.ts.

Source of truth: the Supabase project configured by the repository. Queries are saved in sql/flashcard_review_diagnostics_20261011.sql and sql/flashcard_review_logs_20261011.sql. No schema or security policy was changed.

The logs showed seven ownership rejections from 20:18:58 through 20:19:04 UTC on October 11. Aggregated checks found seven phrase entries, five with forward progress, and no progress owner mismatches. An authenticated phrase review returned one saved row in a transaction that was rolled back. This verified that phrase entries were allowed by existing database rules. No permanent learner writes were made. The browser session changed from 20 cards to 19 after the user's refresh.

Assumption: removed vocabulary should leave the session rather than create a new review record. No change to rating values or scheduling rules.

Validation: 101 tests passed across 21 files. Lint, TypeScript, and production build passed. The build completed with a Supabase fetch warning in the restricted network environment. The deployed website requires the updated code before this fix takes effect.
