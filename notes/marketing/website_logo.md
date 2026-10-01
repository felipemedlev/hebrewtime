# Website logo update

The website now uses HebrewTales with the blue book symbol from the revised marketing poster. The symbol was recreated as an SVG so it stays sharp at small and large sizes. The wordmark uses the application's Inter font with a bold weight.

## Files

* `public/brand/hebrewtales-mark.svg`: reusable book symbol.
* `src/components/BrandLogo.tsx`: accessible logo with a decorative image and readable brand text.
* `src/app/styles/brand.css`: shared logo styling.
* Sidebar and onboarding components: shared logo placement.
* App metadata, translations, sharing text, and admin labels: HebrewTales name.
* `src/app/favicon.ico`: matching browser icon at 32, 64, and 256 pixels.
* `scripts/generate-brand-icons.mjs`: regenerate the favicon with `node scripts/generate-brand-icons.mjs`, using Sharp from the installed Next.js dependencies.

The original podcast identity and internal storage keys were not renamed. This change concerns the website brand.

## Validation

ESLint passed for all changed JavaScript and TypeScript files. The diff whitespace check passed. The SVG was rendered and visually inspected. The generated ICO contains three PNG sizes.

The full TypeScript check could not pass because the installed dependencies are missing Vitest and `@openai/agents/realtime`, with related errors in existing test and speaking files. No browser was available through the UI tools, so desktop and mobile page rendering could not be visually verified. The temporary preview server was stopped after checking tool availability.

No database queries were run. No deployment or commit was made.
