# The self-Map press repeats the Duty Menu publish's local-first fan-out

**Id:** 2026-10-12-self-map-press-duplicates-fanout
**Type:** cleanup
**Opened:** 2026-10-12 (book `assistant-self-map`, story 2's Implementation; ADR `assistant-self-map/0002` §
Consequences, "Duplication")
**Status:** OPEN
**Done:** —

**What happens.** `applySelfMap` in `src/api/assistant/selfMapPublish.js` repeats about 40 lines of
`publishDutyMenuFor` in `src/api/assistant/dutyMenuPublish.js`:
- the local write, and its failure answer;
- the configured relays sent as such, then the event-named relays capped at `MAX_RELAYS`;
- the DNS guard under one `LOOKUP_BUDGET_MS`, the not-sent rows and the local-only rows;
- `summarizePublish`, and the "no other relay" sentence.

ADR 0002 chose this (its option S1) to keep shipped code still: the Duty Menu route is pinned by its own sentinels
(`test/assistant-duty-menu-publish.test.js` S2).

**Fix shape.** One helper, for example `fanOut({ signed, configured, named, subject, localOnly }, deps)`, beside
`profilePublish.js`'s `summarizePublish`. Both routes call it. Re-aim the two suites' seams, with no change in behaviour.
Do it once both routes are stable, after story 3 of this book.

**Pointer:** `engineering-team/decisions/assistant-self-map/0002-one-narrow-route-turns-the-self-map-on-and-off.md` §
Options considered, "Sharing the publish code".
