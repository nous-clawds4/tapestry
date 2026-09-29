# After `strfry delete` removes the relay's K newest events, the next K stored events never reach a live subscription, and after a wipe no write does until it reconnects

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

**The mechanism, confirmed in strfry's source** (1.1.0, commit `f31a1b9`, read in the container's
`/usr/local/src/strfry` by story 3's review, round 1, and again for this row):
- A new event takes the largest level id plus one: `get_next_integer_key` returns `get_largest_integer_key_or_zero + 1`
  (`golpe/external/rasgueadb/main.h.tt`), called for every insert (`golpe/external/rasgueadb/modify.h.tt`).
- A live monitor skips every event whose level id is at or below the last one it has passed: `ActiveMonitors::process`
  continues when `item.latestEventId >= ev.primaryKeyId` or `sub.latestEventId >= ev.primaryKeyId`
  (`src/ActiveMonitors.h`).
- So deleting the relay's K newest events lowers the largest id by K, the next K writes reuse ids the monitors have
  already passed, and those K writes reach no live subscription. They are stored, and a scan or a new REQ finds them.
- A wipe (every event deleted) hides every write from a live subscription until the new ids pass the old largest one,
  or until it re-subscribes: a new REQ's monitor starts from the relay as it is.
- Expiry cannot trigger it: the expiry cron skips the most recent event, "because it could cause levId re-use"
  (`src/apps/relay/RelayCron.cpp`). A kind-5 or a replaced version cannot either: strfry writes the new event first and
  deletes after it, "to ensure levIds are not reused" (`src/events.cpp`). Only a delete of the newest events from
  outside the write path triggers it: an operator's `strfry delete`, or a wipe.

**Impact.**
- The real-time path: owner decision 10 of ADR `tagging-edges/0003`, as reworded by its Amendment A1 and corrected by
  A1 clarification 24, covers this ("a subscription that stays connected but stops delivering"): what it misses is
  reflected at the next safety diff (≤ 10 min), except a version both stored and revoked by id while nothing was
  delivered, which waits for the pass. After a delete of the K newest events that is K writes. After a wipe it is every
  write until the path reconnects, so OPERATIONS §12.9 tells the operator to restart the path
  (`supervisorctl restart tagging-edges-realtime`) after a relay wipe or a bulk delete. In the local run above, on the
  code before A1, the missed kind-5 was reflected by the next safety diff, 9 minutes after it was stored (story 3
  § Evidence, run 1).
- It is also one way a notice is lost under owner decision 11 (accepted): if the write never delivered is an
  address's newest version and it then leaves the relay with no event, the author's by-id deletion of the version the
  path last saw there removes the relationship, although that records an older version. The relay then holds nothing
  there the path or the pass can read, and the next pass would make the same removal.
- Every other live subscriber misses those events too, with no error. That includes nostr-search's ingest
  (`nostr-search/src/ingest.js`: a `{kinds:[0]}` REQ kept open after EOSE, so a profile stored at that moment) and any
  client subscribed through the relay. After a wipe, each stays deaf until it reconnects.

**Fix shape.** Not designed. Ways to look at it:
- report it upstream, with the cites above: `strfry delete` could skip the most recent event as the expiry cron does,
  or live monitors could be reset after a delete;
- have operator deletes avoid the newest events, or follow each with as many harmless writes, and restart every live
  subscriber after a wipe;
- for subscribers that cannot wait for a periodic re-read, re-read on a timer, or re-subscribe after an operator
  delete.

**Pointer:** story `engineering-team/stories/tagging-edges/3-real-time-path.md` § Evidence (the local end-to-end
run); ADR `tagging-edges/0003` owner decision 10 and A1 clarification 24; review
`engineering-team/reviews/tagging-edges/3-real-time-path.md` § Blocking 3; OPERATIONS §12.9 "Things to know".
