# After every deploy the router runs no streams until the control panel finishes starting, and one stream reconnected minutes late

**Id:** 2026-10-10-router-boots-with-empty-streams
**Type:** bug
**Opened:** 2026-10-10 (relay-stream-gaps, staging verification of stories 1–2)
**Status:** OPEN
**Done:** —

**What was seen.**
- `docker/entrypoint.sh:242–261` starts `strfry-router` with an **empty** `streams {}` config whenever
  `router-state.json` exists (`/etc/` isn't on a volume). The real streams only appear when the control panel calls
  `initRouter()` at the end of route registration (`src/api/index.js:696`). So every deploy's hole is the container
  stop, plus the control panel's startup, plus the reconnect.
- With the router patch from relay-stream-gaps #2 (a stream's Limit is fetched on connect), the WoT stream
  (`wss://wot.grapevine.network`, kinds 3/1984/10000, limit 5) still lost 1–2 events at each of deploys #544, #545 and
  #546 (2026-10-09). In each case what is present is exactly "the newest 5 at a moment T" with T 1.5–3.5 minutes
  after the container started (17:18:03–18, 17:24:23–30, 17:44:27–31 UTC). So the refetch works, but this stream
  connected minutes late. The kind-0 stream recovered within about 30–40 s. Why WoT was late is unknown without the
  router's log (`/var/log/supervisor/strfry-router-error.log`, lines `WoT: Connecting to …`). At deploy #551
  (20:56 UTC) WoT lost nothing (nothing was published in its window) and `userProfiles`, which has **no** limit, lost
  all 7 kind-0 events from its ~35 s window.

**Mitigation in hand.** Limits of 500 on the download streams (including `userProfiles`) cover a reconnect delay of
an hour or more at staging's rates, and the scheduled negentropy presets (relay-stream-gaps #3) catch the rest.

**Fix shape.**
- Have the entrypoint render `/etc/strfry-router-tapestry.config` from `router-state.json` before supervisord
  starts (reusing `buildConfigFromState`'s rules, e.g. a small node script), so streams come up with the router.
  `initRouter()` then rewrites the same content and nothing reconnects.
- Read the router log after a deploy to find why one stream connected minutes late.

**Pointer:** epic `engineering-team/epics/relay-stream-gaps.md`; book
`engineering-team/audits/relay-stream-gaps/book.md` § Staging verification; ADR relay-stream-gaps/0002.
