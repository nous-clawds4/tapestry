# A duties line nothing can claim says "Live, but your Assistant's self-Map doesn't say so yet."

**Id:** 2026-10-12-live-unclaimed-when-unclaimable
**Type:** bug
**Opened:** 2026-10-12 (book `assistant-self-map`, review of story 1, finding N7; ADR 0001 Amendment 2 item 9)
**Status:** OPEN
**Done:** —

**What happens.** `dutyLines` in `src/lib/self-map/index.js` gives a line the reason `live-unclaimed` whenever all of
its duty parts are live but not claimed right. That includes lines the should-say list can't claim at all, so the page
can say "Live, but…" beside "Your Assistant's self-Map is up to date."

- **Reproduced.** The Map gives the Assistant both `39998` and `39998:foo`. The `foo` header hasn't landed, other
  headers have, and no self-Map exists. A self-entry `39998` would also win `foo`, so nothing can be claimed: `shouldSay`
  is empty and `current` is true. Yet the `39998` line says "Live, but…".
- **A second case.** A self-entry at a relay other than the live one gets both "Live, but…" and "…claims this, but it
  isn't live."

Staging's Owner Map names no `39998:<d>` keys, so it doesn't hit this today.

**Fix shape.** Give `live-unclaimed` only when `shouldSay` claims the line's parts. Otherwise use a new reason, with
words the owner approves (for example "Can't be claimed until every Concept it covers has landed."). Also word the
false claim for a live part at another relay.

**Pointer:** `engineering-team/reviews/assistant-self-map/1-the-self-map-page-and-its-check.md`, N7.
