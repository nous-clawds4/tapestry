# Three self-Map press nits left at story 2's close: two unpinned `source` cases, an unpinned lock, a 202-character line

**Id:** 2026-10-13-self-map-source-and-comment-nits
**Type:** cleanup
**Opened:** 2026-10-13 (book `assistant-self-map`, story 2's review round 6: R6-N1, R6-N2, and round 4's R4-N3)
**Status:** OPEN
**Done:** —

Three nits that story 2's reviews left non-blocking. None changes what a press does.

- **R6-N1, the comment line.** `src/api/assistant/selfMap.js:240`, in `lookupSelfMap`'s doc comment, is 202 characters
  wide. Round 6's own comment edit (for R5-N4) joined two lines; the next line, "It is unfinished with …", belongs on
  its own. No other comment line in the three self-Map modules is over 125 characters.
- **R6-N2, `published.source`.** It is `'copy'` only when the copy alone holds the newest version (ADR
  `assistant-self-map/0002` Amendment 4 item 1). The code is right in every case the reviewer and the second reader
  tried, but two ways of breaking `heldOutside` in `strictOutsideRound` pass every suite:
  - `heldOutside = events.length > 0`: a copy newer than an older version at a write relay reads `'relay'`;
  - `heldOutside` counted from the write relays only: a copy whose id only a hint relay returned reads `'copy'`.

  Nothing in `src/` or `ui/src` reads `source` today, and the press reads only `onThisRelay`.
- **R4-N3, the lock.** K9 (`test/assistant-self-map-publish.test.js`) doesn't pin that `writeSelfMapCopy` runs under
  `selfMapChoice.js`'s shared `choiceLock`. The store's work is synchronous inside one `.then`, so a copy write without
  the lock still passes K9. The lock is there; only the test is missing.

**Fix shape.** Rewrap the comment line. Add both `source` cases to V19–V21 in `test/assistant-self-map-check.test.js`
when something first reads `source` (story 3's upkeep is the likely first reader), or sooner, in any change that
touches that file. For K9, interleave a choice write and a copy write across an `await` (for example a slow
`writeAtomic` stub), so a copy write outside the lock loses one of the two.

**Pointer:** `engineering-team/reviews/assistant-self-map/2-turning-the-self-map-on-and-off.md`, Round 6 (R6-N1, R6-N2)
and Round 4 (R4-N3); the second readers' `i7-source-gaps.js` and `m2-lock-mutant.js`.
