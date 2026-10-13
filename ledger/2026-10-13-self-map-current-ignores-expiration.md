# While the self-Map is on, a stale expiration beside matching self-entries keeps Update now disabled

**Id:** 2026-10-13-self-map-current-ignores-expiration
**Type:** bug
**Opened:** 2026-10-13 (book `assistant-self-map`, story 2's review round 2, R2-N3; left out by ADR
`assistant-self-map/0002` Amendment 2 item 6)
**Status:** OPEN
**Done:** —

**What happens.**
- The self-Map check's `current` compares the self-entries only (`src/lib/self-map/index.js:527`,
  `sameSelfEntries(shouldSay, foundEntries)`).
- The page enables Update now only when `current !== true` (`ui/src/pages/assistant/assistantTreasureMapCopy.js`,
  `selfMapButtons`).
- So, while on, a version whose self-entries match but which also carries an `expiration` or another owned tag reads
  as up to date. Update now stays disabled and the hub shows done.
- The press itself would clean it up (ADR 0002 Amendment 1 item 2), but the page only reaches that through Turn off,
  then Turn on.

Only a version this instance's press did not build can carry either. An expired claim then reads as not published,
which re-enables the press, so it heals after the expiration passes.

**Fix shape.** Decide in story 3's design, since its upkeep reads `current` too. One option is for `current` to also
require no `expiration` and no stray owned tag beside a non-empty should-say, matching the press's "nothing stale"
rule. That changes story 1's done mark, so it needs the Architect.

**Pointer:** `engineering-team/reviews/assistant-self-map/2-turning-the-self-map-on-and-off.md`, Round 2, R2-N3.
