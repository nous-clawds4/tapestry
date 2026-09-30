# Any publisher can make every gap-filling pass fail by pushing its one relay read past the shared 256 MiB cap

**Id:** 2026-09-28-pass-relay-read-byte-cap
**Type:** bug
**Opened:** 2026-09-28 (tagging-edges #3, ADR `tagging-edges/0003` § Consequences, "New debt")
**Status:** OPEN
**Done:** —

**What was seen.** The gap-filling pass (ADR `tagging-edges/0002`) reads the relay in one strict `strfry scan`: the
taggings and tag elements carrying any of its four `z` stamps. It calls `scanStrict` with no `maxBytes`, so the scan
takes the default, 256 MiB (`DEFAULT_MAX_BYTES` in `src/lib/strfryScanStrict.js`), shared by every event the read
returns. Past it the read fails `too-large`, and the run ends `failed` with `failure.read: 'relay'`, changing no
relationship or person, as a read that is not complete must.

Publishing is permissionless, and a stamp is only a tag. About 2,000 stamped taggings of websocket size (at most
131,072 bytes each, the relay's `maxWebsocketPayloadSize`) reach the cap, and from then on every pass fails the same
way until they leave the relay. Organic growth reaches it at roughly 300k events: the local backfill read 10,405
events in 8,227,479 bytes (story 2 § Evidence).

It matters more with story 3: the pass is the real-time path's backstop for taggings that leave the relay with no
event, for the corners owner decision 5 of ADR `tagging-edges/0003` leaves to it, and for a lost record. The real-time
path itself is not affected: it streams its full stamp scan through `onEvent` and keeps only `(id, address)` pairs,
with no byte cap (its memory is bounded by the id count).

**Fix shape.** Not designed. The pass keeps every event of its read in memory to plan, so raising the cap moves the
ceiling without removing it. One direction: stream the read through `scanStrict`'s `onEvent` (added by story 3) and
bound what the plan keeps per address, the way the real-time path bounds its rounds. It needs its own ADR, and the
pass's tests (`test/tagging-edges-runner.test.js`, `test/strfry-scan-strict.test.js`) as the regression check.

**Pointer:** ADR `tagging-edges/0003` § Consequences ("New debt"); `src/lib/strfryScanStrict.js` (`DEFAULT_MAX_BYTES`);
`src/pipeline/tagging-edges/reconcileTaggingEdges.js` (the relay read); OPERATIONS §12.8.
