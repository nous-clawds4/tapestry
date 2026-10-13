# An ADR widened a value another book's code consumes without reading that consumer's parser

**Id:** 2026-10-12-adr-widened-value-consumer-unread
**Type:** meta
**Opened:** 2026-10-12 (`assistant-duties-settings` book close, retro P2; review round 1 Blocking 1)
**Status:** OPEN
**Done:** —

**What happened.** ADR `assistant-duties-settings/0001` made the Duty Menu offer a list the Owner edits. The list could
hold every key readers keep: narrower keys (`30382:rank`), family keys (`3038x`), `*`, and Concept keys with a `d`.

The ADR named the cross-book consumer: Your Assistant's Treasure Map (`assistant-self-map` #1) reads the same offer.
It also fixed one consequence, a typed relay for Scores. But it never read how that consumer parses an offer row:
- `evaluateSelfMap` keeps only rows keyed `/^\d{5}$/` (`src/lib/self-map/index.js:451–454`);
- `readUpkeep` finds rows by exact key (`src/api/assistant/selfMap.js:161`).

So the two pages disagreed for any non-bare key, and a true claim could be flagged false. The tests did not catch it:
they too listed only bare kinds. The independent review did (round 1). The fix cost a full second round: an
amendment, tests, an implementation and a review (ADR 0001 Amendment 1, book Decision 8).

**Fix shape.** Add to `engineering-team/roles/architect.md` step 3, beside the existing "read the defaults that piece
inherits" rule:

> When the design widens the set of values a module produces, read every consumer's parser for that value and list in
> the ADR which values each consumer accepts.

Also have the Tester add at least one test feeding the widest new value through each named consumer.

**Pointer:** `engineering-team/reviews/assistant-duties-settings/1-the-assistant-duties-tab.md` (Blocking 1);
`engineering-team/audits/assistant-duties-settings/audit.md` §7 P2.
