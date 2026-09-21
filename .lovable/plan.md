# Games Library English–Hindi Language System

## Goal
Add one persistent English/Hindi preference across the existing Games Library while preserving all game IDs, scoring, timers, multiplayer, question batching, saved sessions, and daily-lock behavior.

## What will change
- Add a mobile-friendly English/Hindi selector to the Games Library and game setup screen, backed by the existing USTAD AI settings preference.
- Add centralized Games Library translations for all nine game names/descriptions, difficulty labels, player labels, gameplay messages, errors, results, and the complete review.
- Store `en` or `hi` on every newly created game session. Restored and completed sessions will continue using their stored language even if the global preference changes.
- Pass the stored session language through every batch and individual retry request to the server question generator.
- Instruct the AI to write questions, all option content, and explanations directly in natural English or Hindi while preserving game and difficulty rules.
- Add language-aware validation so wrong-language output is rejected per question and only missing/invalid questions are retried.
- Keep daily locks keyed exactly as they are today; language will not be sent to or included in daily-lock operations.

## Verification
- Add focused tests for language mapping, session locking/persistence, request propagation, and Hindi/English validation.
- Check English and Hindi setup, gameplay, result/review, multiplayer labels, and mobile layouts at Android widths.
- Confirm the current build, browser console, navigation, timer, scoring, and two-question daily-lock behavior remain healthy.

## Technical details
- Internal language values: `en | hi`; existing global values map as `hindi → hi`, all other valid values default to `en` for this two-language feature.
- Existing stable IDs (`riddle`, `hard`, `player1`, etc.) remain unchanged; only display text changes.
- Existing saved sessions without a language field remain compatible and default to English.
