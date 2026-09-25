# pi-unflip

Detects corrupted assistant text (stray CJK, Latin/Cyrillic homoglyph flips) at
message_end and rewrites the text blocks via a corrector model. Fail-open everywhere.

## Commands

- Test: `npm test` - typechecks first, then runs tests (live corrector tests need `NEURALWATT_API_KEY`, skipped without it)

## Rules

- Fail-open: any error keeps the original message
- Rewrite only final assistant messages (stopReason "stop", no toolCall blocks); the message-level skip is the cache-safety guarantee, not the text-only loop
- Smallest correct code; no speculative config or abstractions
- Corrector output must keep every uncorrupted paragraph of its input verbatim; on violation keep the original text (data-loss backstop, fail-open)
