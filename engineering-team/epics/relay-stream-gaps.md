# Epic: relay-stream-gaps

**Created:** 2026-10-09
**Status:** Active
**Book:** `engineering-team/audits/relay-stream-gaps/book.md` (acceptance-frame)
**Provenance:** Operator report 2026-10-09 (in-session). Content the operator expected on the
local relay was missing until a manual negentropy sync, while 11 router streams on
`staging.brainstorm.world` showed as on. Diagnosed and measured the same day against staging
and production.

## Goal

What the router streams are meant to bring in actually arrives, and it doesn't depend on
someone remembering to run a manual negentropy sync.

## Why it matters

The streams work, but they are live only. strfry's router asks each upstream relay for no
stored events when it connects (it overrides any configured `limit` with 0). Whatever is
published upstream while a stream is not connected is never fetched. Measured 2026-10-09 by
comparing each minute's events on `wot.grapevine.network` with the local relay:

- Every deploy leaves a permanent hole. Staging lost 4, 10 and 12 events in the minutes its
  three deploys finished on 2026-10-08 (21:57, 23:34, 23:50 UTC; the last hole spans about
  23:50:20–23:50:40). Production lost 16 around its 23:42 deploy. Every other minute was
  complete.
- Every change on the Router Management tab restarts the router, which drops **all** streams,
  not just the one changed.
- Content no download stream covers never arrives. Production lacked 258 of the newest 300
  dcosl kind-39999 items and 18 of 78 kind-39998 headers since 2026-09-01. These are concepts
  such as `food-and-drink-places` and `github-accounts`, outside the five `#z`-filtered tag
  streams. (The unfiltered `dcosl` download is off by design: OPEN.md row 25, about 1.3M
  junk events.)

Outside those gaps the streams deliver: a 2-minute live test on 2026-10-09 saw 38 of 38 new
upstream events reach both staging and production, median latency about 1 s.

## Stories

`stories/relay-stream-gaps/`:
1. `1-stream-changes-without-router-restart.md` — changing streams on the Router Management
   tab no longer restarts the router or interrupts the other streams. Bug.

Queued (the book's acceptance frame; stories are drafted when picked up):
- The stream editor's Limit setting: make it work, or stop presenting it as if it did.
- Saved negentropy-sync presets, each switchable on or off, with the enabled ones run on a
  schedule as a Scheduled Task. This is the catch-up that closes deploy holes and covers
  content no stream carries. It is the "saved presets" item the retired `relay-management`
  epic queued.

## Key facts / guardrails

- strfry 1.1.0's router (`src/apps/mesh/cmd_router.cpp`) reloads its config file when the file
  is modified in place (inotify `IN_MODIFY`, 50 ms debounce). On reload it reconnects only the
  streams whose direction or filter changed; added streams connect and removed streams
  disconnect. The control panel's startup already relies on this after every deploy: it
  writes the config without a restart, and the streams come up.
- That watch is on the file's inode in this strfry version. Replacing the file (write to
  temp, then rename) would silently end reloads until the next restart.
- Router streams are live only in both directions. Up: the router starts from the newest
  local event and never uploads what was written while it was down.
- Per-instance config: each deployment keeps its own stream state on its data volume. The
  presets are starting points, not a shared truth.
