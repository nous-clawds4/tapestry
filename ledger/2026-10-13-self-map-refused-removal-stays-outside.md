# An outside relay that refused a self-Map removal keeps serving the claim, and a second Turn off says "nothing claimed"

**Id:** 2026-10-13-self-map-refused-removal-stays-outside
**Type:** bug
**Opened:** 2026-10-13 (book `assistant-self-map`, story 2's review round 5, the reader's O1; it predates round 5)
**Status:** OPEN
**Done:** —

**What happens.**
1. Turn off publishes a version with no self-entries. This instance's relay and the Assistant's write relay accept
   it. A relay the found version's self-entries named (OLD1) refuses it, and the press reports that row as refused.
2. A second Turn off finds the new version on this instance's relay. It holds no self-entry, so the press answers
   "It claimed nothing, so nothing was published".
3. OLD1 still serves the older version, which claims the Assistant's duties there. A reader that asks only OLD1 still
   sees the claim.

This instance's relay is right, and the first press reported the refusal. What is missing is a way to retry the relays
that refused the removal.

**Fix shape.** The Architect's call, probably with story 3's upkeep, which re-publishes on a schedule. One option: when
the self-entries are already the target, still re-send the current version to the relays the previous version named,
best-effort, without re-signing. Weigh it with `2026-10-13-self-map-send-relooks-write-relays` and
`2026-10-12-self-map-press-duplicates-fanout`.

**Pointer:** `engineering-team/reviews/assistant-self-map/2-turning-the-self-map-on-and-off.md`, Round 5 (O1).
