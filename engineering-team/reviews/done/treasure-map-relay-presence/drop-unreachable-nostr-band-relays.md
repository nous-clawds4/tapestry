# Review: drop the unreachable `*.nostr.band` relays from the shipped defaults

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-09-07
**Lane:** Doc / one-liner (intake §3 strictness table — Implementer + Reviewer, no story file; this
review is the lane's record)
**Diff:** `src/config/defaults.json` only — two array entries removed.
**Provenance:** Operator observation 2026-09-07, in-session: the two rows the presence panel
reported as "Couldn't reach" are both `*.nostr.band`, and the operator judged them defunct.

## What changed

| Group | Removed | Left |
|---|---|---|
| `aPopularGeneralPurposeRelays` | `wss://relay.nostr.band` | damus, primal, nos.lol |
| `aTrustedAssertionRelays` | `wss://nip85.nostr.band` | nip85.brainstorm.world, nip85.nostr1.com |

No other file changed. No code changed.

## Evidence the removal is warranted

The operator's read was checked rather than taken on report, because "unreachable from our
container" and "defunct" are different claims with different remedies.

| Host | DNS | TCP 443 (from the **host**, outside Docker) | NIP-11 over HTTPS |
|---|---|---|---|
| `relay.nostr.band` | resolves → 95.216.33.150 | **closed** | timeout (8s) |
| `nip85.nostr.band` | resolves → 65.109.67.137 | **closed** | timeout (8s) |
| `nos.lol` (control) | resolves → 142.132.206.70 | open | — |

Both hosts fail at the transport layer from the **host machine as well as the container**, so this
is not a container-egress artifact, and the control host on the same test is fine. Two distinct
hosts on two distinct Hetzner IPs are both unreachable.

**Stated limit of the evidence:** this is one network vantage point, and DNS records are still
standing, so the honest claim is "unreachable, sustained" rather than "permanently gone". The
change is trivially reversible — re-add at Home > Settings > Relays, no code change — which is
what makes acting on this level of evidence proportionate.

## Blast radius

- **`aTrustedAssertionRelays`** is consumed by exactly two places: `RelaySettings.jsx:11` (the
  editing surface) and `TreasureMapRelayPresence.jsx:22`. Removing `nip85.nostr.band` therefore
  affects only the presence panel.
- **`aPopularGeneralPurposeRelays`** is consumed by five: `BrainstormSettings.jsx:226`,
  `SearchPreferences.jsx:239`, `UserDetail.jsx:76`, `BrainstormSearch.jsx:314`, and the panel.
  Each of those was previously spending a connection attempt on an unreachable host on every use,
  so removal should *reduce* latency there, not change behavior. No consumer enumerates the group
  by index or expects a fixed length (checked at each site).
- `safeModeRelays` never contained either host — confirmed.

## Verification

- `defaults.json` parses; every other group byte-identical.
- `GET /api/relays` after a container restart serves neither host in any group
  (`nostr.band still served anywhere: NO`).
- This instance's `/var/lib/brainstorm/settings.json` carries **no `aRelays` override**, so the
  defaults change takes effect here directly — the operator's "remove from this instance" and
  "remove from shipped defaults" collapse into this one edit.
- Panel re-checked live: **zero** "Couldn't reach" rows, no `nostr.band` row, summary reads
  `7 of 10 hold a copy` (was `6 of 12` — two dead relays gone, plus the `tags.brainstorm.world`
  sync performed earlier this session).
- Story suites re-run: `treasure-map-relay-presence` 35/35, `treasure-map-relay-sync` 22/22.
  Neither pins a relay-list length, so neither was affected.

## Findings

### Blocking

None.

### Non-blocking

1. **The concept graph still carries both hosts.** `nip85.nostr.band` remains an element of the
   `trusted assertion relays` set and `relay.nostr.band` of `general purpose relays`. That surface
   is unaffected by this edit (it is firmware, not settings), and the Treasure Map page's *other*
   code path — the Map-lookup fallback in `TrustedAssertions.jsx` — still reads the graph by
   Cypher. So a fallback search can still attempt a dead relay. Deliberately deferred: it needs a
   firmware change plus a reinstall on every deployment, and it is the natural moment to settle
   whether `aRelays` or the graph is canonical. Tracked at `follow-ups.md:131` (ADR
   treasure-map-relay-presence/0001 § Consequences).
2. **No automated guard against re-adding a dead relay**, and none proposed — the doc/one-liner
   lane has no Tester phase, and a test asserting the *absence* of a specific URL would ossify a
   judgement that is meant to stay reversible.

### Harness friction

None this change.

## Verdict

**PASS**

A two-entry deletion from a config default, with the operator's premise independently verified
from a second vantage point, a fully enumerated blast radius in which every affected consumer
strictly benefits, and live confirmation that the served config and the rendered panel both
reflect it. Reversible from the Settings UI without a deploy.
