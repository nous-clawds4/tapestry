# `readRelayEvents`' connect retry can leave a socket open when a relay finishes connecting after nostr-tools' own 4.4 s timeout

**Id:** 2026-09-21-relay-reader-socket-leak
**Type:** bug
**Opened:** 2026-09-21 (setup-status-and-alert #1 review, non-blocking 4)
**Status:** OPEN
**Done:** —

nostr-tools 2.10.4's connect timeout rejects without closing its WebSocket. The container's
`node_modules/nostr-tools/lib/cjs/index.js:677–682` shows it: it rejects after 4.4 s and leaves
`this.ws` open.

`readRelayEvents` (`src/api/_shared/relaySource.js:247–253`) then retries with a new `Relay`. When
a slow relay finishes connecting after that first timeout, the first attempt's socket is open and
nothing closes it.

This predates `/api/setup/status`, but that endpoint adds a caller. Every signed-in `/setup` load
that misses locally reads up to 11 relays through it, and story 2 plans to put its answer on every
page.

**Fix shape:** close the `Relay` from a failed attempt before retrying. `relay.close()` in the
retry's catch, guarded, is probably enough. Or wrap the connect so a timed-out socket is always torn
down. Confirm against a relay that accepts slowly: a local `ws` server that delays its upgrade.

**Pointer:** `engineering-team/reviews/done/setup-status-and-alert/1-setup-shows-where-you-stand.md`
§ Non-blocking 4.
