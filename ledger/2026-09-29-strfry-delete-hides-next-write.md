# After `strfry delete` removes the relay's newest events, or a wipe, the next writes re-use their ids, and a live subscription that had passed an id never receives the write that re-uses it

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

**The mechanism, read in strfry's source** (1.1.0, commit `f31a1b9`, in the container's `/usr/local/src/strfry`; read
by story 3's review, rounds 1 and 2, and again for this row. Round 1's reading, which this row first carried, overstated
it to every subscription and to exactly as many writes as events deleted.)
- **Ids.** A new event takes the largest stored id plus one: `get_next_integer_key` returns
  `get_largest_integer_key_or_zero + 1` (`golpe/external/rasgueadb/main.h.tt:151-158`), called for every insert
  (`golpe/external/rasgueadb/modify.h.tt:155`).
- **What never lowers the largest id.** strfry writes a new event before it deletes what that event replaces or
  revokes, "to ensure levIds are not reused" (`src/events.cpp:369-387`), and the expiry cron never deletes the newest
  event, "because it could cause levId re-use" (`src/apps/relay/RelayCron.cpp:31`). So a kind-5, a replaced version
  and an expiry never lower it.
- **What does.** `strfry delete` deletes whatever its filter matches, the newest event included
  (`src/apps/dbutils/cmd_delete.cpp:45-76`), and a wipe deletes everything. The next writes then re-use every id from
  the new largest plus one up to the old largest: at least one per newest event deleted, and more where earlier
  deletions (a kind-5, a replacement, an expiry, an older operator delete) left gaps below them.
- **Who misses a re-used-id write.** A relay monitor thread keeps a cursor, the largest id it has visited. When it next
  wakes it lowers the cursor to the new largest id (`src/apps/relay/RelayReqMonitor.cpp:26-27`), and on a database
  change it visits every event above the cursor (`:50-58`), so a write that re-uses an id is still visited. But each
  subscription skips an event whose id is at or below the highest id its own monitor has passed
  (`ActiveMonitors::process`, `src/ActiveMonitors.h:93-98`): the last event sent to it, the last event visited that
  carries the same index key as one of its filters (a filter is indexed by its ids, else its authors, else its tags,
  else its kinds: `src/ActiveMonitors.h:167-195`), or the relay's newest event when it subscribed
  (`RelayReqMonitor.cpp:41-43`). So a re-used-id write is missed by the subscriptions that had passed its id, and
  delivered to the others. It is stored, and a scan or a new REQ finds it.
- **The debounce race.** A monitor thread wakes on a database change, which it hears 100 ms after the first change
  (`RelayReqMonitor.cpp:10`; `golpe/external/hoytech-cpp/hoytech/file_change_monitor.h:78-108`), or on a REQ, a CLOSE
  or a closed connection it serves. A write stored after the delete but before the thread next wakes is seen with the
  delete: the thread never sees the largest id fall, so it never visits the re-used id (`RelayReqMonitor.cpp:26-27`,
  `:56-58`), and every subscription it serves misses that write. That is every live subscription, unless a REQ or a
  CLOSE woke a thread in between.
- **A wipe while the relay runs** re-uses ids from 1. A subscription then misses writes until the ids pass the point
  its own monitor had reached, at most the old largest id. A new REQ's monitor starts from the relay as it is
  (`RelayReqMonitor.cpp:41-43`), so re-subscribing ends it.

**Impact.**
- The real-time path: its filters are indexed by the stamps' `z` tags and by kind 5, and every kind-5 and stamped
  tagging is sent to it. So after an operator delete it misses each write that re-uses an id at or below the last
  kind-5 or event carrying a stamp's `z` tag stored since it last subscribed, or the relay's newest event when it did;
  after a wipe, every write until the ids pass that point; and, like every subscriber, a write caught in the debounce
  race. Owner decision 10 of ADR `tagging-edges/0003`, as reworded by its Amendment A1 and corrected by A1
  clarification 24, covers this ("a subscription that stays connected but stops delivering"): what it misses is
  reflected at the next safety diff (≤ 10 min), except a version both stored and revoked by id while missed, which
  waits for the pass. OPERATIONS §12.9 tells the operator to restart the path
  (`supervisorctl restart tagging-edges-realtime`) after a relay wipe or a bulk delete. In the local run above, on the
  code before A1, the missed kind-5 was reflected by the next safety diff, 9 minutes after it was stored (story 3
  § Evidence, run 1).
- It is also one way a notice is lost under owner decision 11 (accepted): if the write never delivered is an
  address's newest version and it then leaves the relay with no event, the author's by-id deletion of the version the
  path last saw there removes the relationship, although that records an older version. The relay then holds nothing
  there the path or the pass can read, and the next pass would make the same removal.
- Other live subscribers miss writes the same way, with no error: each a re-used-id write it had passed, and every one
  a write caught in the debounce race. That includes nostr-search's ingest (`nostr-search/src/ingest.js`: a
  `{kinds:[0]}` REQ kept open after EOSE, so a profile re-using an id at or below the last kind 0 stored since it
  subscribed, or the relay's newest event then) and any client subscribed through the relay. After a wipe, each misses
  writes until the ids pass its own point, or until it re-subscribes.

**Fix shape.** Not designed. Ways to look at it:
- report it upstream, with the cites above: strfry could never re-use an id, with `strfry delete` keeping the newest
  event as the expiry cron does, or with ids taken from a stored high-water mark rather than the largest id present.
  Lowering the subscriptions' passed ids when a monitor sees the largest id fall would leave the debounce race;
- have operator deletes spare the relay's newest event, which then re-uses nothing. Following a delete with harmless
  writes takes the old largest id minus the new one, not as many writes as events deleted, since gaps below re-use
  too, and a real write stored among them is still missed. Restart every live subscriber after a wipe;
- for subscribers that cannot wait for a periodic re-read, re-read on a timer, or re-subscribe after an operator
  delete.

**Pointer:** story `engineering-team/stories/tagging-edges/3-real-time-path.md` § Evidence (the local end-to-end
run); ADR `tagging-edges/0003` owner decision 10 and A1 clarification 24; review
`engineering-team/reviews/tagging-edges/3-real-time-path.md` § Blocking 3 (round 1) and R2-1 (round 2); OPERATIONS
§12.9 "Things to know".
