# Epic: treasure-map-relay-presence

**Created:** 2026-09-07
**Status:** Done (epic retired 2026-09-07 at the book close — all three stories Done and
reviewed, in production via PRs #590 → staging and #597 → main; folders moved under `done/`)
**Provenance:** Operator request 2026-09-07 (in-session): the TA Treasure Map page reports only
whether the Map is in local strfry; show which relay or relays actually hold it — the three
Digital Ocean Tapestry instances, other Brainstorm/NosFabrica ecosystem relays, and general
purpose relays.

## Goal

**A user looking at their TA Treasure Map can see where on the public network it actually lives.**
Not one bit about the local relay, but a per-relay answer across every relay where a reader's
client would plausibly look — and, because kind 10040 is replaceable, whether each relay holds
*the version being displayed* or a divergent one.

## Why it matters

The Treasure Map exists to be found by *other people's* clients. Its value is entirely a function
of where it is replicated. Local strfry presence — the only signal the page carries today — says
nothing about that, and is the one location that is irrelevant to a third-party reader.

Measured on the local dev instance 2026-09-07, the owner's own Map (`27a0ee92…` @1774412135) was
present at 6 of 14 checked locations and **absent from 8**, including three of the four
general-purpose relays (`relay.damus.io`, `relay.primal.net`, `relay.nostr.band`), one of the
three trusted-assertion relays (`nip85.nostr.band`), and `dcosl.brainstorm.world`. The page
reported "✅ found · Local Strfry ● Present" throughout. Every one of those gaps is invisible today.

The replaceable-kind hazard is the sharper edge: a relay serving a *stale* 10040 silently points
readers at a delegation the user has since revoked or moved. A present/absent boolean cannot
express that; the divergence is exactly the thing worth surfacing.

## Stories

`stories/done/treasure-map-relay-presence/`:
1. `1-treasure-map-relay-presence.md` — per-relay presence and version-divergence over
   operator-configured relay groups. **Done.**
2. `2-per-relay-map-sync.md` — per-relay sync converging local strfry and one relay on the more
   recent copy. **Done.**
3. `3-scannable-presence-panel.md` — collapsed by default behind a status light; visible version
   timestamps. **Done.**

*(Plus one doc-lane chore: dropping the unreachable `*.nostr.band` relays from shipped
defaults — `reviews/done/treasure-map-relay-presence/drop-unreachable-nostr-band-relays.md`.)*

## Decisions
`decisions/done/treasure-map-relay-presence/`:
- `0001-per-relay-presence-probe.md`
- `0002-per-relay-map-sync.md`
- `0003-scannable-presence-panel.md`

## Key facts / guardrails

- **Kind 10040 is replaceable.** Two relays may legitimately hold different events for the same
  author. Presence is a three-or-more-valued answer (this version / a different version /
  absent / unreachable), never a boolean.
- **No relay URL may be hardcoded in page code.** Relay groups are already operator-editable at
  Home > Settings > Relays, defaulted in `src/config/defaults.json` and served publicly at
  `GET /api/relays`. The concept graph carries the parallel `nostr relay` element sets. A new
  group for Tapestry instances belongs in that existing machinery — a deployment must be able to
  point at its own peers.
- **Presence is a read-time question, re-derived per view** (architecture invariant 3). Nothing
  about which relay holds what may be precomputed or stored.
- The existing `GET /api/relay/external` merges results across the relay list and dedupes by
  event id — per-relay origin is lost by construction. Attribution is the capability this epic
  needs and does not yet have.
