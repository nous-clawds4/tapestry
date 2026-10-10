# Three small follow-ups from the Scores/Lists/Concepts review: an unhandled fallback, a loose sentinel, a doc line

**Id:** 2026-10-09-trusted-content-review-followups
**Type:** cleanup
**Opened:** 2026-10-09 (assistant-trusted-content-status #1, review; non-blocking under its PASS)
**Status:** OPEN
**Done:** —

- `src/api/assistant/attention.js` `trustedContentActions`: its `check-failed` fallback re-requires
  `./trustedContent`. If that module itself fails to load, the whole attention answer becomes a 500 instead of three
  `check-failed` actions (confirmed on a scratch copy). Only a code bug the tests would catch can trigger it; the
  realistic failure, the `.mjs` rule not loading, is handled. Fix: a frozen fallback constant in attention.js, as
  `OUTBOX_CHECK_FAILED` is.
- `test/assistant-trusted-content.test.js` D1: its "published by the viewer" regex is satisfied by the tagging rule's
  own `ev.pubkey` comparison, so a re-ask on anyone's 10040 would pass D1. Only the narrowed
  `treasure-map-needs-attention` S4 catches it today. Tighten D1 to the 10040 line itself.
- `src/api/assistant/attention.js` header: since the profile-checklist merge it still says "Three actions are checked"
  (now six actions from four checks), and the response-shape line (`an assistant → { … actions: { … } }`) doesn't list
  the newer keys.
- `src/api/openapi.yaml` `/api/assistant/attention`: the opening sentence lists `profile`, `outbox-relays` and
  `identification-tags` as if that were all; Scores, Lists and Concepts are described further down. Make the list
  complete, or drop it.

**Pointer:** `engineering-team/reviews/done/assistant-trusted-content-status/1-scores-lists-and-concepts-on-the-hub.md` § Non-blocking 2–4, and its merge addendum's non-blocking 2–3
