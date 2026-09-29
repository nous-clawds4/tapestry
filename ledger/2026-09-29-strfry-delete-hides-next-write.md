# After `strfry delete` removes the relay's newest event, the next stored event never reaches a live subscription

**Id:** 2026-09-29-strfry-delete-hides-next-write
**Type:** bug
**Opened:** 2026-09-29 (tagging-edges #3, the local end-to-end run)
**Status:** OPEN
**Done:** —

**What was seen.** strfry 1.1.0, local stack, 2026-09-28 at about 23:50Z. The real-time path had just reflected a
stamped tagging, which was then the relay's newest event. An operator-style `strfry delete --filter '{"ids":[…]}'`
removed it. The tagging's author then stored a kind-5 naming it through the relay's websocket (`OK true`, and a later
`strfry scan` finds it). The path's live subscription never delivered that kind-5: `subscription.lastEventAt` stayed
at the deleted tagging's delivery. The next event after it was delivered as usual.

The same thing happens without the path. A plain `REQ … limit:0` for one author's kind-1 notes saw A, then `strfry
delete` removed A, then B and C were stored through the websocket. Both are on the relay, and the live subscription
delivered `["A","C"]`: never B.

The likely mechanism, not read in strfry's source: a new event takes the largest level id plus one, so deleting the
newest event makes the next write reuse its level id, and the live monitor has already passed that id. Only a delete
of the newest event triggers it: an operator's CLI delete, or an expiry. A kind-5 or a replaced version always removes
something older than itself.

**Impact.**
- The real-time path: owner decision 10 of ADR `tagging-edges/0003`, as reworded by its Amendment A1, covers this ("a
  subscription that stays connected but stops delivering"): what it misses is reflected at the next safety diff
  (≤ 10 min), except a version both stored and revoked by id while nothing was delivered, which waits for the pass.
  In the local run above, on the code before A1, the missed kind-5 was reflected by the next safety diff, 9 minutes
  after it was stored (story 3 § Evidence, run 1).
- It is also one way a notice is lost under owner decision 11 (accepted): if the write never delivered is an
  address's newest version and it then leaves the relay with no event, the author's by-id deletion of the version the
  path last saw there removes the relationship, although that records an older version. The relay then holds nothing
  there the path or the pass can read, and the next pass would make the same removal.
- Every other live subscriber misses that one event too, with no error. That includes nostr-search's ingest
  (`nostr-search/src/ingest.js`: a `{kinds:[0]}` REQ kept open after EOSE, so a profile stored at that moment) and any
  client subscribed through the relay.

**Fix shape.** Not designed. Ways to look at it:
- confirm the mechanism in strfry's source and report it upstream;
- have operator deletes avoid the newest event, or follow each with a harmless write;
- for subscribers that cannot wait for a periodic re-read, re-read on a timer.

**Pointer:** story `engineering-team/stories/tagging-edges/3-real-time-path.md` § Evidence (the local end-to-end
run); ADR `tagging-edges/0003` owner decision 10.
