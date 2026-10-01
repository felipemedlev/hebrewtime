# Marketing production notes

## Deliverables

* Invitation copy: [invitation.md](../../final/marketing/invitation.md).
* Separate poster: `final/marketing/poster.png`.
* Poster generation prompt: [poster_prompt.md](poster_prompt.md).

## Basis and assumptions

The source of truth for public feature availability is the user's clarification, supported by the repository implementation and documentation for the remaining features. The user confirmed that AI speaking practice is available only to admins, so all public marketing claims about that feature were removed. The public brand name is HebrewTales. Live deployment, service availability, and lesson coverage were not tested.

English was selected because the request was in English. The poster uses the application's white background, dark typography, and blue accent from `src/app/styles/base.css`.

The public joining URL was not present in the reviewed project files. The initial materials use a direct invitation to create an account. A website link can be included in the message accompanying the poster. No URL or QR code was invented.

No subscription price, learner count, testimonial, or guaranteed learning outcome is advertised. Dictionary details and audio depend on the available entry or episode. A missing episode translation may fall back to English.

## Feature evidence

* `README.md`: overall platform, learning tracks, supported translation languages, and account tiers.
* `src/components/EpisodeViewer.tsx`: bilingual reading, word lookup, and lesson completion.
* `src/components/MediaPlayer.tsx`: episode playback, seeking, and restored listening position.
* `src/components/VocabularyView.tsx` and `src/components/AddVocabWordModal.tsx`: saved vocabulary, search, words, and phrases.
* `src/components/ReviewHub.tsx`: flashcards, reverse cards, matching, sentence completion, and practice statistics.
* `src/components/FlashcardsView.tsx` and `src/lib/flashcardSession.ts`: session continuation.
* `src/lib/i18n/messages.ts` and `src/app/actions.ts`: advertised free limits for the remaining public features.

## Validation

Copy was checked against the files above. Only marketing artifacts and their production notes were added. No application behavior was changed and no database queries were run. Poster generation uses the built in image generation tool.

The poster includes a decorative book mark beside the name; it is campaign artwork, not a change to the application's logo. The revised poster uses HebrewTales and promotes reading, listening, vocabulary, and review.

The revised PNG is 1024 by 1536 pixels. Visual inspection confirmed the HebrewTales name, the revised tagline, readable feature text, and removal of the AI teacher feature and speech imagery. The invitation was checked for the former brand name and speaking claims; none remain.
