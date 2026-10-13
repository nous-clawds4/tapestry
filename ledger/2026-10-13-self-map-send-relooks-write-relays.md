# Turn on looks the Assistant's relay list up twice, and a failed second lookup leaves the write relays unsent

**Id:** 2026-10-13-self-map-send-relooks-write-relays
**Type:** bug
**Opened:** 2026-10-13 (book `assistant-self-map`, story 2's review round 2, R2-N4; left out by ADR
`assistant-self-map/0002` Amendment 2 item 6)
**Status:** OPEN
**Done:** —

**What happens.**
- The press's strict read looks up the Assistant's relay list (`strictOutsideRound` in `src/api/assistant/selfMap.js`,
  through `assistantWriteRelayLookup`).
- After signing, the press looks it up again for its send set: `assistantWriteRelays`, at
  `src/api/assistant/selfMapPublish.js:222`, through `orNone`.
- If that second lookup fails, the new version is sent to neither the write relays (W) nor anywhere W alone named,
  though the read found W moments before. The version stays on this instance's relay and the configured relays.
- The send is best-effort, and this predates review round 2.

**Fix shape.** Carry the strict read's W through to the send set. `gatherSelfMap` and `lookupSelfMap` would return it
with the lookup, so the press reads it once. Weigh this together with the fan-out row
`2026-10-12-self-map-press-duplicates-fanout`, which also reshapes the send.

**Pointer:** `engineering-team/reviews/assistant-self-map/2-turning-the-self-map-on-and-off.md`, Round 2, R2-N4.
