# ADR 0001: Per-relay presence probe for the Treasure Map

**Status:** Accepted
**Date:** 2026-09-07
**Story:** `engineering-team/stories/treasure-map-relay-presence/1-treasure-map-relay-presence.md`

## Context

The story asks for five things. Quoting the criteria that constrain the design:

1. **Coverage comes from configuration, not code** — one row per checked location; no relay URL
   literal in page source; the operator changes the set from Home > Settings > Relays.
2. **A relay holding this version says so** — event id equals the displayed Map's.
3. **A relay holding a different version says which** — with `created_at`, older or newer.
4. **Absent and unreachable are distinguishable** — distinct states, distinct treatment.
5. **The check never degrades the page** — no delay to the Map's own render; per-relay rows
   resolve independently "rather than the whole panel waiting on the slowest relay."

### What the codebase has today

- `ui/src/pages/grapevine/TrustedAssertions.jsx:190–217` renders the single `Local Strfry:
  ● Present` row, plus an **Import to local strfry** button when absent. That button is shipped
  behavior and must survive.
- `GET /api/relay/external` (`src/api/relay/fetchEvents.js:48–63`) hands the whole relay list to
  `SimplePool.querySync` and dedupes by event id.
- `src/api/_shared/relaySource.js` holds the extracted sourcing primitives (ADR `event-page/0001`),
  including `realQuerySync` — also SimplePool-based. `follow-ups.md:131` tracks consolidating the
  remaining private copies into it, and warns (`:139`) that `realQuerySync` is the **verifying**
  variant and must not be unified with the event path's no-verify one.
- Relay groups are operator-editable end to end: `src/config/defaults.json:3–35` →
  `PUT /api/settings` → `RELAY_GROUPS` at `ui/src/pages/settings/RelaySettings.jsx:6–16` →
  `GET /api/relays` → `useConfig().aRelays`. There is **no** group holding the Tapestry instances.
- The page separately resolves general-purpose relays by Cypher against the concept graph
  (`TrustedAssertions.jsx:23–41`), used as the fallback source when the Map is not local.
- Concept `39998:<TA>:nostr-relay` carries parallel element sets in the graph (`general purpose
  relays`, `trusted assertion relays`, `trusted list relays`, …). The Tapestry instances are in
  none of them.

### Measurements taken for this decision (2026-09-07, local stack)

**M1 — the existing endpoint cannot satisfy criterion 4.** Calling `/api/relay/external` with a
single relay, against every failure mode:

| Case | Result |
|---|---|
| `nos.lol` (has it) | `success:true`, 1 event, 1.6s |
| `relay.damus.io` (absent) | `success:true`, 0 events, 0.2s |
| DNS does not resolve | `success:true`, **0 events**, 0.0s |
| TCP refused | `success:true`, **0 events**, 0.0s |
| HTTPS host, not a relay | `success:true`, **0 events**, 0.2s |
| Blackholed IP | `success:true`, **0 events**, 4.4s |

`SimplePool.querySync` swallows per-relay connection failure and resolves with what it got; the
handler's `Promise.race` timeout only fires if the *pool* hangs, which it does not. Unreachable
and absent are indistinguishable through this path. **This refutes Option D outright.**

**M2 — `Relay.connect()` does surface the distinction.** The same six cases through
`nostr-tools`' `Relay` class: all four failure modes threw at connect; both live relays connected
and returned EOSE (0.1–0.6s). Two implementation facts fell out:

- `AbstractRelay` has **no `querySync`** — its prototype is `connect, close, publish, count,
  subscribe, …`. The query must go through `relay.subscribe([filter], {onevent, oneose, onclose})`.
- The connect failure is thrown as a **bare string**, not an `Error`:
  `"Received network error or non-101 status code."` Reading `err.message` on it yields
  `undefined` — the first version of the probe reported exactly that.

**M3 — connect failure is flaky, so "unreachable" must not be a one-shot verdict.**
`relay.damus.io` threw at connect on one pass and connected cleanly (0.4s, 0 events) on the next,
seconds later. Reporting a healthy relay as unreachable on a transient is a false alarm the user
cannot distinguish from a real one.

**M4 — the baseline this feature exists to expose.** The owner's Map `27a0ee92…` is present at 6
of 14 candidate locations and absent from 8. Healthy relays answer in well under a second; only
genuinely dead ones reach the timeout — which is precisely when criterion 5 bites.

### Constraints

- POV/architecture invariant 3: presence is re-derived at read time. Nothing may be stored.
- The server connecting to a client-named relay URL is an existing exposure shape
  (`/api/relay/external` already does it); this ADR must not widen it.
- No new lint/build tooling (CLAUDE.md).

## Options considered

### Option A — Single-relay presence endpoint, client fans out one request per relay

`GET /api/relay/presence?relay=<one wss url>&pubkey=…&kind=10040` returns a discriminated
`{status: 'present' | 'absent' | 'unreachable', event}`. A new page component issues one request
per configured relay with bounded concurrency and renders each row as it lands.

- **Pros.** Each row's lifecycle is independent *by construction* — criterion 5 is satisfied by
  the shape of the solution, not by a state machine. The endpoint is a pure function of one relay,
  so Phase 3 can test each status in isolation. No streaming plumbing, no partial-parse failure
  modes. Smallest new surface that clears all five criteria.
- **Cons.** N HTTP round trips. Over HTTP/1.1 the browser caps ~6 sockets per origin, so a dead
  relay occupies a slot for the timeout window and later rows resolve in a second wave. Mitigated
  by M2/M4: healthy relays clear in <1s, so waves are cheap and only genuinely dead relays stall.

### Option B — One batch endpoint, results streamed as NDJSON/SSE

One request carries the whole relay list; the server fans out and writes each result as it lands;
the client reads incrementally.

- **Pros.** One connection, no per-origin cap, true per-row independence.
- **Cons.** Materially more machinery for the same user-visible outcome: streaming response
  handling in Express, an incremental reader on the client, and a new class of partial-stream
  failure to specify and test. Buys us nothing over Option A until the relay count is far larger
  than the ~13 in play.

### Option C — One batch endpoint, single JSON response after `Promise.allSettled`

Simplest server shape; the panel shows one spinner and fills in at once.

- **Pros.** One round trip. Least code.
- **Cons.** **Fails criterion 5.** The response is gated on the slowest relay, so a single dead
  relay makes the whole panel wait the full timeout — the exact scenario the criterion names.

### Option D — No server change: call `/api/relay/external` once per relay

Attractive on its face — a single-relay call *is* a per-relay query, and the merge/dedup problem
only arises with multiple relays.

- **Cons.** **Refuted by M1.** The endpoint reports `success:true, events:[]` for DNS failure, TCP
  refusal, a non-relay host, and a blackholed IP alike — identical to a real absence. Criterion 4
  is unreachable through this path regardless of how it is called.

## Decision

We chose **Option A**.

It is the least machinery that satisfies all five criteria, and criterion 5 — the one that killed
Option C — falls out of the request-per-relay shape rather than being engineered on top of it.
Option B's advantages are real but do not pay for their complexity at this relay count; if the
checked set grows past a few dozen, B is the documented upgrade path and the client-side fan-out
is the only part that changes.

The probe is built on `Relay.connect()` + `relay.subscribe()` (M2), **not** `SimplePool`, because
SimplePool structurally cannot report reachability (M1).

Two sub-decisions:

- **Relay list source: the `aRelays` settings groups, not the concept graph.** Criterion 1 names
  Home > Settings > Relays as the operator's editing surface, and that surface is backed by
  `aRelays`. The concept graph's parallel relay sets are not editable from there.
- **Comparison happens on the client.** The endpoint reports what a relay holds (`id`,
  `created_at`); *same / older / newer* is computed in the component against the displayed Map.
  This keeps the endpoint a pure presence probe with no notion of "the version being displayed."

## Consequences

- **Enables.** A per-relay, version-aware view of where the Map lives. The probe is generic over
  `(relay, pubkey, kind)`, so the deferred "publish to the relays missing it" story and any future
  "where does this event live" surface can reuse it unchanged.
- **Security posture held, not widened.** The endpoint accepts a client-named relay URL, exactly
  as `/api/relay/external` already does. It must apply the same `wss://`/`ws://` scheme validation
  and accept **one** relay per request. It introduces no new class of outbound reach.
- **A malicious relay must not be able to fake "your Map was replaced."** Returned events are
  signature-verified (`verifyEvent`) and matched against the requested `kind`/`pubkey`; anything
  failing is discarded, and a relay left with nothing reports `absent`. Without this, any relay
  could serve a forged 10040 and make the panel claim the user's delegation had changed.
- **Constrains.** The `{status, event}` response shape becomes the contract the panel renders.
  Adding a status later is a coordinated change.
- **Two relay-list sources now coexist on one page** — the new panel reads `aRelays`; the existing
  Map-lookup fallback keeps its concept-graph Cypher query (`TrustedAssertions.jsx:23–41`).
  Deliberate: this story adds a panel and must not alter a shipped read path. Both resolve to the
  same four general-purpose relays today, but they can drift. Follow-up below.
- **New debt / follow-ups.**
  1. Reconcile the two relay-list sources on this page (and decide whether `aRelays` or the graph
     is canonical instance-wide). Folds naturally into `follow-ups.md:131`.
  2. The Tapestry instance relays land in `aRelays` only — the concept graph's `nostr relay`
     element sets still do not know them. Adding them there is a firmware change and is **not**
     part of this story.
  3. `_shared/relaySource.js` gains a third `querySync` variant (verifying SimplePool, no-verify
     SimplePool, and this connect-observing probe). The `follow-ups.md:139` caveat applies with
     equal force: **do not unify them** — each exists for a distinct outcome.
- **Firmware reinstall required?** **No.** No concept definitions change.

## Implementation notes

**1. `src/api/_shared/relaySource.js` — add `probeRelayForEvent(relayUrl, filter, opts)`**

Returns `{ status: 'present' | 'absent' | 'unreachable', event: <newest matching event> | null,
error: string | null }`. Alongside the existing `realQuerySync`, never replacing it.

- Connect with `Relay.connect(relayUrl)` from `nostr-tools` (required via the module's existing
  `NOSTR_TOOLS_PATH` / `WS_PATH` absolute-path convention), raced against `connectTimeoutMs`.
- **Normalize the throw**: `const msg = err instanceof Error ? err.message : String(err)` — M2
  proves the library throws a bare string, and `err.message` on it is `undefined`.
- **One bounded retry** on connect failure before returning `unreachable` (M3: damus.io threw once
  and connected on the next attempt). One retry, not a loop.
- Query with `relay.subscribe([filter], { onevent, oneose, onclose })` — `AbstractRelay` has no
  `querySync` (M2). Resolve the collected events on `oneose`; reject on `onclose`; race against
  `queryTimeoutMs`. Close the subscription on every exit path.
- Verify each event with `verifyEvent` and drop any whose `kind`/`pubkey` do not match the filter.
  If nothing survives → `absent`. Keep the newest surviving event by `created_at`.
- `relay.close()` in `finally`, guarded — the connection must not leak on any path.
- Suggested defaults: `connectTimeoutMs: 5000`, `queryTimeoutMs: 5000` (measured healthy path is
  0.1–0.6s, so these are generous).

**2. `src/api/relay/presence.js` — new `handleRelayPresence`**

`GET /api/relay/presence?relay=<url>&pubkey=<64-hex>&kind=<int>`

- Validate: exactly one `relay`, scheme `wss://` or `ws://` (mirror `fetchEvents.js:39`); `pubkey`
  is 64 hex chars; `kind` is a non-negative integer. 400 on any failure.
- Build `{ kinds: [kind], authors: [pubkey], limit: 1 }`, call `probeRelayForEvent`.
- Respond `{ success: true, relay, status, event: { id, created_at } | null, error }`. Return only
  `id` and `created_at` — the panel needs nothing more, and the full event is already on screen.
- A relay-level failure is a **200 with `status: 'unreachable'`**, not an HTTP error; the row needs
  the status, and a non-2xx would conflate transport with outcome.

**3. `src/api/index.js`** — register beside the existing external route (`:309`):
`app.get('/api/relay/presence', handleRelayPresence);` with the `require` alongside `:83`.

**4. `src/config/defaults.json`** — add to `aRelays`:

```json
"aTapestryInstanceRelays": [
  "wss://tapestry.brainstorm.world/relay",
  "wss://staging.brainstorm.world/relay",
  "wss://tags.brainstorm.world/relay"
]
```

All three verified live and serving kind-10040 events, 2026-09-07. Existing deployments merge
defaults with their stored `settings.json`, so the group appears without operator action — confirm
that merge behavior in `src/config/settings.js` during implementation.

**5. `ui/src/pages/settings/RelaySettings.jsx`** — add a `RELAY_GROUPS` row (`:6–16`):
`{ key: 'aTapestryInstanceRelays', label: 'Tapestry Instance Relays', hint: 'Peer Tapestry/Brainstorm instances', restart: false }`.
This is what makes criterion 1's "without a code change" true.

**6. `ui/src/pages/grapevine/TreasureMapRelayPresence.jsx` — new component**

- Props: `{ event, inLocal, onImportLocal, importing }`.
- Relay set: `useConfig().aRelays`, unioned over
  `PRESENCE_GROUP_KEYS = ['aTapestryInstanceRelays', 'aTrustedAssertionRelays',
  'aTrustedListRelays', 'aPopularGeneralPurposeRelays']`. **Group keys, not URLs** — no relay
  literal enters page source, per criterion 1. Dedupe by URL; a relay in two groups renders once
  carrying both group labels.
- Renders the **local strfry row first**, from the `inLocal` prop the page already computes — no
  request needed, and the existing **Import to local strfry** button moves here unchanged.
- Fans out with bounded concurrency (4) so the panel cannot starve other page requests. Each row
  holds its own `{ status, event, error }` and starts in `pending`.
- Row status, computed client-side against `event.id` / `event.created_at`:
  `present` + same id → *holds this version*; `present` + different id → *different version* with
  its timestamp and older/newer; equal `created_at` with a different id → *different version, same
  timestamp* (do not claim an order); `absent`; `unreachable`.
- Wording for `unreachable` should say the check could not reach the relay — not that the relay is
  down (M3).
- All state is local to this component, so a total failure of the check cannot affect the page.

**7. `ui/src/pages/grapevine/TrustedAssertions.jsx:190–217`** — replace the Local Strfry block with
`<TreasureMapRelayPresence event={event} inLocal={inLocal} onImportLocal={importToLocal}
importing={importingLocal} />`. The existing `search()` effect, its Cypher relay query, and the
import handler are otherwise untouched — the Map's own lookup and first render must not gain a
dependency on the probe (criterion 5).

## Out of scope

- Any write path — publishing or repairing the Map on relays that lack it (story-level defer).
- Re-pointing the page's existing Cypher relay lookup at `aRelays`, or picking a canonical
  instance-wide relay-list source. Consequence 1 above; folds into `follow-ups.md:131`.
- Adding the Tapestry instance relays to the concept graph / firmware.
- Streaming the probe results (Option B) — the documented upgrade path if the relay set grows.
- Caching or persisting presence results. Invariant 3 forbids it.
- Presence for any event other than the displayed kind-10040.
