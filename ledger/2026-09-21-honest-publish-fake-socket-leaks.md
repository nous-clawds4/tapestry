# `honest-publish-reporting` leaves a fake relay socket installed for every later suite in the process

**Id:** 2026-09-21-honest-publish-fake-socket-leaks
**Type:** meta
**Opened:** 2026-09-21 (setup-status-and-alert #3, Phase 4)
**Status:** OPEN
**Done:** —

**What `test/honest-publish-reporting.test.js` does.** On its first run, it calls nostr-tools' pool
`useWebSocketImplementation(FakeRelaySocket)` (`harness()`, `:156`). The fake answers every relay URL it does not
know with `OK true` and reason `ok`. The suite never puts the real socket back.

**What that does to later suites.** The gate runs every suite in one Node process. So any suite that runs after it
and publishes through `SimplePool` sees fake relays. An unreachable `ws://127.0.0.1:1` reads as "accepted".

**How it was found.** Story 3's new U5 publishes to local stub relays (the `ws` package). It passed on its own and
failed inside the 100-suite gate with exactly that symptom.

**Why the damage is limited today.** The Tester made U5 and U8 install the real socket, the library default,
before publishing. Nothing else is known to be affected. But a suite that meant to check real relay behaviour
would silently check the fake instead, and whether it did would depend on the registry order.

**Fix shape.** `honest-publish-reporting` restores the default when its run ends:
`useWebSocketImplementation(globalThis.WebSocket)` in a `finally`. Suites that need a particular socket should
install it themselves, as U5 and U8 now do.

**Pointer:** `test/setup-alert-polish.test.js` `useRealWebSocket()`; the gate record `20260921T231551Z-82497-86f3`.
