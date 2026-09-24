# pi-unflip

Detects corrupted assistant text (stray CJK, Latin/Cyrillic homoglyph flips) at
message_end and rewrites the text blocks via a corrector model. Fail-open everywhere.

## Commands

- Test: `npm test` - typechecks first, then runs tests (live corrector tests need `NEURALWATT_API_KEY`, skipped without it)

## Rules

- Fail-open: any error keeps the original message
- Rewrite only final assistant messages (stopReason "stop", no toolCall blocks); the message-level skip is the cache-safety guarantee, not the text-only loop
- Smallest correct code; no speculative config or abstractions
- No integrity gate on corrector output - rely on prompt and live tests
