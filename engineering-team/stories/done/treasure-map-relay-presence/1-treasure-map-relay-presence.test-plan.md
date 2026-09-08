# Test Plan: Story 1 — Show which relays hold the Treasure Map

**Story:** `engineering-team/stories/treasure-map-relay-presence/1-treasure-map-relay-presence.md`
**ADR:** `engineering-team/decisions/treasure-map-relay-presence/0001-per-relay-presence-probe.md`
**Date:** 2026-09-07

## Coverage map

All tests live in `test/treasure-map-relay-presence.test.js`, registered in `test/test.js`.
Classes follow the house pattern (cf. `test/tl-treasure-map-panel.test.js`): **P** probe behavior,
**A** API handler behavior, **C** config, **T** pure client helpers, **S** structure, **R** sentinel.

| Criterion | Test | Level |
|---|---|---|
| AC-1 coverage from configuration | `C1: defaults.json ships the Tapestry instance relay group with the three instances` | unit (config) |
| AC-1 | `T1: buildPresenceTargets unions the named groups, dedupes, and keeps every group label` | unit |
| AC-1 | `T2: buildPresenceTargets tolerates missing, empty and malformed config without throwing` | unit |
| AC-1 | `S2: the Relay Settings page exposes the Tapestry instance group for editing` | structure |
| AC-1 | `S4: no relay URL is hardcoded in the panel or the page` | structure |
| AC-1 | `S5: the panel resolves its relays from configuration, by group key` | structure |
| AC-2 holds this version | `P1: a relay returning the author's event reports present, with the event` | unit (DI) |
| AC-2 | `T3: compareMapVersions calls an identical event the version being displayed` | unit |
| AC-3 holds a different version | `T4: compareMapVersions reports a divergent version as older or newer` | unit |
| AC-3 | `T5: a divergent version with an equal timestamp claims no order` | unit |
| AC-3 | `P8: when a relay returns several valid events the newest is reported` | unit (DI) |
| AC-4 absent ≠ unreachable | `P2: a relay that EOSEs with no events reports absent, not unreachable` | unit (DI) |
| AC-4 | `P3: a relay that cannot be connected reports unreachable — distinct from absent` | unit (DI) |
| AC-4 | `A7: an unreachable relay is a 200 carrying the status, not an HTTP error` | unit (DI) |
| AC-5 never degrades the page | `S6: rows resolve per relay, not in one settled batch` | structure |
| AC-5 | `S3: the page mounts the presence panel` | structure |
| AC-5 | `R1`, `R2` — the page's other panels and the import affordance survive | sentinel |

## Edge cases

Beyond the criteria — each one is a hazard the ADR's measurements or the security posture surfaced.

- [x] **The bare-string connect throw** (`P4`). nostr-tools throws a *string*, not an `Error`
      (ADR M2), so `err.message` is `undefined`. `P4` fails if the implementation reports the
      literal `"undefined"` — the exact bug the architecture probe hit.
- [x] **Flaky connect must not read as unreachable** (`P5`). ADR M3 measured `relay.damus.io`
      throwing once and connecting cleanly seconds later. `P5` pins both halves: one retry
      recovers, and the retry is **bounded at one** (a persistently dead relay gets exactly 2
      attempts, not a loop).
- [x] **A forged event must not fake a divergence** (`P6`). A relay returning an event that fails
      signature verification reads `absent`, never `present` — otherwise any relay could tell a
      user their delegation had changed.
- [x] **Wrong author / wrong kind discarded** (`P7`).
- [x] **Connections never leak** (`P9`, `P10`) — closed on the success path, on early subscription
      close, and after a query timeout.
- [x] **A relay that connects but never EOSEs** (`P10`) resolves via the query timeout rather than
      hanging the row.
- [x] **Request validation / outbound-reach posture** (`A1`–`A5`): missing relay, non-websocket
      scheme (`http://`, `https://`, `file://`, bare host), more than one relay per request,
      malformed pubkey, malformed kind. The endpoint takes a client-named URL, so these are the
      checks that keep the ADR's "posture held, not widened" promise true.
- [x] **Response leaks nothing extra** (`A6`): only `id` + `created_at` come back, never `sig`,
      `content` or `tags`.
- [x] **Empty / malformed relay config** (`T2`): null config, missing group, non-array group, and
      a URL repeated inside one group must not crash the panel.
- [x] **Vacuous-pass guard**: `S4` and `S6` are negative assertions over the new panel file, so
      they would pass trivially while the file does not exist. Both now assert the panel is
      non-empty first — verified: they fail at the baseline below and only become meaningful once
      `S3` passes.

## Test infrastructure

- **Framework:** Node built-in runner — `node test/test.js`. No new framework.
- **Hermetic by construction.** Every P and A test drives an **injected** `connect` / `verify` /
  `probe`, so this suite opens no socket and never requires `nostr-tools`. That is deliberate:
  OPEN.md row 13 records suites failing misleadingly in a bare checkout because a transitive
  top-level `require('nostr-tools')` throws. It also keeps the suite free of the ambient-relay
  drift class in OPEN.md rows 75 / 126 / 141 — there are no relay counts and no live corpus here.
- **Injection contracts pinned by this suite** (in `relaySource.js`'s existing DI-by-parameter
  idiom — cf. `resolveGeneralPurposeRelays(runCypher)`):
  - `probeRelayForEvent(relayUrl, filter, { connect, verify, connectTimeoutMs, queryTimeoutMs })`
    → `{ status: 'present' | 'absent' | 'unreachable', event, error }`
  - `handleRelayPresence(req, res, { probe })`
  The Implementer must provide real defaults for the injected dependencies; the tests supply fakes.
- **Concept Graph API:** not used. This story reads relay config, not the graph.
- **Firmware state:** no precondition — no concept definitions change, so no
  `POST /api/firmware/install`.
- **Fixtures:** all in-file (`ev()`, `fakeRelay()`, `flakyConnect()`, `fakeRes()`). Nothing is
  written to strfry, so this suite adds no fixture residue to the shared local relay (OPEN.md
  row 128's hazard class).
- **Local full-suite note:** running the whole `npm test` locally needs
  `BRAINSTORM_PUBLISH_LOCAL_ONLY` set (OPEN.md row 191). This suite alone needs nothing.

## How to run

The suite in isolation:

```bash
node -e "require('./test/treasure-map-relay-presence.test.js').run().then(r => console.log(r))"
```

The full gate:

```bash
npm test
```

## Verification

The new tests fail with the current code. Confirmed 2026-09-07 at commit `f5f874b1`:

```
=== 5 passed, 30 failed ===
```

The 5 passes are exactly the R sentinels (`R1`–`R5`), which are designed to pass before *and*
after — they fail only on collateral damage. Every one of the 30 feature tests fails because the
code does not exist yet, not from a typo or an import error:

```
  ✗ P1..P10  ADR § Implementation notes 1: src/api/_shared/relaySource.js must export
             probeRelayForEvent(relayUrl, filter, opts)
  ✗ A1..A7   src/api/relay/presence.js failed to load: Cannot find module '.../src/api/relay/presence.js'
  ✗ C1       AC-1: aRelays.aTapestryInstanceRelays must exist so the Tapestry instances are
             checked and operator-editable
  ✗ T1       AC-1: ui/src/utils/treasureMap.js must export buildPresenceTargets(aRelays, groupKeys)
  ✗ T3       AC-2: ui/src/utils/treasureMap.js must export compareMapVersions(displayed, found)
  ✗ S1       ADR § Implementation notes 3: src/api/index.js must register GET /api/relay/presence
  ✗ S2       AC-1: RELAY_GROUPS must include aTapestryInstanceRelays — this is what makes
             "without a code change" true
  ✗ S3       ui/src/pages/grapevine/TreasureMapRelayPresence.jsx must exist
  ✗ S4/S6    ui/src/pages/grapevine/TreasureMapRelayPresence.jsx must exist for this check to
             mean anything
  ✗ S5       AC-1: the panel must read aRelays via useConfig()
```

`node --check` passes on both `test/test.js` and the new suite; the runner registration is wired
at all four touchpoints (require, run, summary line, exit-code conjunction). The full `npm test`
gate belongs to Phase 4 — this phase verified the subset, per workflow step 5.
