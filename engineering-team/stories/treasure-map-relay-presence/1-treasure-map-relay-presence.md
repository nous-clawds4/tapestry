# Story 1: Show which relays hold the Treasure Map

**Status:** Approved
**Created:** 2026-09-07
**Type:** Feature

## Background

The TA Treasure Map page (`/tapestry/grapevine/trusted-assertions`) reports exactly one fact about
where the Map lives: `Local Strfry: ● Present`. That is the least useful location it could report.
The Map's entire purpose is to be found by *other people's* clients, which never read this
instance's local relay — so the page is silent about the only thing that determines whether the
delegation works.

The gap is not hypothetical. Measured on the local dev instance 2026-09-07, the owner's Map
(`27a0ee92…`) was present at 6 of 14 checked locations and absent from 8 — including three of the
four general-purpose relays, one of the three trusted-assertion relays, and
`dcosl.brainstorm.world`. The page said "found, present locally" the whole time.

There is a second, sharper problem. Kind 10040 is a **replaceable** event: relays may each hold a
*different* version for the same author, and a relay serving a stale copy silently advertises a
delegation the user has since changed. The page publishes new Map versions itself — via the
Trusted-List opt-in card and the manual editor — and then gives the user no way to see whether
that publish actually landed anywhere, or which relays are still serving the old one. A
present/absent boolean cannot express this.

Affected: any Brainstorm user viewing their own Treasure Map — most acutely the ones who just
published a change from this page and want to know it took.

## User-facing description

As a Brainstorm user looking at my TA Treasure Map, I want to see which relays hold my Map and
whether each one holds the version I am looking at, so that I can tell whether my delegation is
actually discoverable by other people's clients, and spot any relay still serving a stale copy.

## Acceptance criteria

- [ ] **Coverage comes from configuration, not code.** Given a signed-in user whose Map is found,
      when the page renders it, then the page shows one presence row per checked location,
      covering local strfry plus every relay URL in the relay groups designated for Map lookup —
      by default the Tapestry instance relays (including `tapestry.brainstorm.world/relay`,
      `staging.brainstorm.world/relay`, `tags.brainstorm.world/relay`), the trusted-assertion
      relays, the trusted-list relays, and the general-purpose relays. No relay URL used by this
      check appears as a literal in page or component source, and an operator can change the
      checked set — including the Tapestry instances — from Home > Settings > Relays without a
      code change.

- [ ] **A relay holding this version says so.** Given a checked relay that returns a kind-10040 by
      the Map's author whose event id equals the displayed Map's id, then that relay's row reports
      that it holds the version being displayed.

- [ ] **A relay holding a different version says which.** Given a checked relay that returns a
      kind-10040 by the Map's author whose event id differs from the displayed Map's, then that
      relay's row reports a divergent version, shows that version's `created_at`, and states
      whether it is older or newer than the displayed Map.

- [ ] **Absent and unreachable are distinguishable.** Given a checked relay that responds with no
      matching event, its row reports the Map absent from that relay. Given a relay that fails to
      connect, errors, or exceeds the check's time limit, its row reports it unreachable — a
      distinct state from absent, in both wording and visual treatment.

- [ ] **The check never degrades the page.** Given the relay check is slow, partially failing, or
      failing entirely, when the page loads, then the Map header, Map Entries panel, raw-event
      toggle, TL opt-in card, and manual editor all render and stay usable; the Map's own lookup
      and first render are not delayed by the check; and each relay row shows a pending state
      until that relay resolves, rather than the whole panel waiting on the slowest relay.

## Concepts touched

- `39998:<TA>:nostr-relay` — nostr relay. Its supersets already carry the relay sets this check
  reads (`general purpose relays`, `trusted assertion relays`, `trusted list relays`,
  `web of trust relays`, `DList relays`, `profile relays`). The Tapestry instance relays are not
  yet present in any of them — resolving where they belong is the Architect's call, alongside the
  parallel `aRelays` groups in `src/config/defaults.json` / `GET /api/relays`.
- The kind-10040 Trusted Assertions Treasure Map itself has **no concept-graph handle** (checked
  against `/api/concept-graph/summaries`, 56 concepts, 2026-09-07). Name it in plain language.

## Out of scope

- **Repairing coverage.** No "publish to this relay" / "push my Map everywhere it's missing"
  affordance. This story reports; it does not fix. (Tempting, and the obvious successor — the
  measured data above makes the case for it — but it is a write path with its own consent,
  signing, and failure semantics.)
- Presence for anything other than the displayed kind-10040: not the 30382 assertions on the
  Trusted Assertions list page, not Trusted Lists, not profiles.
- The same panel on any other page.
- Automatic re-checking, polling, or background refresh. A single check per Map view is enough;
  whether a manual re-check control is offered is the Architect's call.
- NIP-65 outbox discovery — deriving the relay set from the viewer's own kind-10002 relay list
  rather than instance configuration.
- Changing where the page *publishes* the Map.

## Open questions

*(None blocking. Resolved during drafting: the three Tapestry instance relay URLs were verified
live and serving kind-10040 events, 2026-09-07; general-purpose relays are included by default
because the measured data shows real Maps do land there — the owner's is on `nos.lol`; profile
relays are excluded by default as kind-0 infrastructure, and an operator who disagrees can add
the group.)*

## Notes for the Architect

This story reaches three layers — relay configuration, the server's external-relay read path, and
the page. It was kept as one story because the user-visible outcome is indivisible: a coverage
list that omits the Tapestry instances does not answer the request. Two facts to start from:

1. `GET /api/relay/external` (`src/api/relay/fetchEvents.js`) hands the whole relay list to
   `SimplePool.querySync` and dedupes by event id, so per-relay attribution is lost by
   construction. This capability does not exist yet anywhere in the codebase.
2. Relay groups are already operator-editable end to end — `src/config/defaults.json` →
   `PUT /api/settings` → `RELAY_GROUPS` in `ui/src/pages/settings/RelaySettings.jsx`, read by the
   client via `useConfig().aRelays`. The page separately reads relay sets from the concept graph
   by Cypher. Which of the two is the source of truth for this check is a real decision worth an
   ADR.

## Linked artifacts

- ADR: `engineering-team/decisions/treasure-map-relay-presence/0001-per-relay-presence-probe.md`
- Test plan: `engineering-team/stories/treasure-map-relay-presence/1-treasure-map-relay-presence.test-plan.md`
- Review: (filled in after Review phase)
