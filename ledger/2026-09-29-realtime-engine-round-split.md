# The real-time path's engine is one long closure, and a round is one 455-line function over shared state

**Id:** 2026-09-29-realtime-engine-round-split
**Type:** cleanup
**Opened:** 2026-09-29 (tagging-edges #3 review, round 1, Non-blocking 10)
**Status:** OPEN
**Done:** —

**What was seen.** `src/pipeline/tagging-edges/realtime/index.js`: `makeEngine` is one closure of about 2,100 lines
(`:302`–`:2407` after review round 1's fixes), and `roundBody` (`:1519`–`:1974`) is 455 lines of nested closures
(`scanAddresses`, `scanElements`, `readChunk`, `readSection`, `readSingles`, `settle`) over round state they share by
closure: the budget, the relay's answered flag and group time-outs, the share, `events`, `capture`, `deferred`,
`failed`, `readOk`, `needs`, `elements`, the element sets, `timedOutGroups`, `markAlone` and `regroupAt`. It works
and is well covered (the engine, lineage, resilience and property suites drive it through the T20 seam), but a change
to one read rule means reading the whole round to see what else touches the state it changes. The review kept it out
of story 3's merge.

**Fix shape.** A refactor with no behaviour change (the Standard strictness table lets a refactor skip Test Design
when behaviour does not change; the existing suites are the net). Split `roundBody` into four steps over one explicit
round-state object: read (the graph read, then the relay and element reads by lane), decide (learning, de-duplication,
`decideAddress`, `gateAction`), write (`applyBatch` by kind), and settle (complete, re-queue or park; the re-looks; the
journal). Each step takes and returns the state object, so the stall-or-slow test and the park rules can be read, and
later tested, on their own. `makeEngine`'s other parts (the journal, the status, the catch-up, the first start) could
follow the same way, one at a time.

**Pointer:** `engineering-team/reviews/tagging-edges/3-real-time-path.md` § Non-blocking 10;
`src/pipeline/tagging-edges/realtime/index.js` (`roundBody`); ADR `tagging-edges/0003` T20 (the seam the suites use).
