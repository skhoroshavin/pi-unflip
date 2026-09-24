# pi-unflip

Detects corrupted assistant text (stray CJK, Latin/Cyrillic homoglyph flips) at
message_end and rewrites the text blocks via a corrector model. Fail-open everywhere.

## Commands

- Typecheck: `npx tsc --noEmit`
- Test: `npm test` (live corrector tests need `NEURALWATT_API_KEY`, skipped without it)

## Rules

- Fail-open: any error keeps the original message
- Tool-call and thinking blocks are never touched (cache safety)
- Smallest correct code; no speculative config or abstractions
- No integrity gate on corrector output - rely on prompt and live tests
