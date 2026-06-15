# Story 1: Live-feed read path — recent notes from the source identity's follows

**Status:** Draft
**Created:** 2026-06-15
**Type:** Feature

## Background
We want a basic "live feed": kind-1 notes from the accounts a single **source identity**
follows. The eventual purpose is to host a later, separate capability — tagging any feed item
with any existing Tag — so this feed is intentionally plain. This story builds **only the read
path that produces the feed's contents**, independent of how they are displayed. The page that
renders these contents is a separate story in this epic (`live-feed` #2).

The **source identity** is the logged-in user when one is present, otherwise the instance's
**House point-of-view identity** (per the `pov-resolution` epic / three-PoV standard). The
source's kind-3 follow list is read from **local strfry**. The followed authors' kind-1 notes
are fetched from the instance's configured **general-purpose relays**. Author display name and
avatar are taken from the instance's **existing local profile data** (kind-0 in strfry /
Meilisearch), not from the external relays.

Affected: anyone (logged in or anonymous) who wants to see recent notes from the source
identity's follows. The work is **additive and read-only** — no writes/publishes, and no
change to search, profiles, ranking/scoring, or firmware.

## User-facing description
As a visitor to this Tapestry instance, I want the feed's contents to be assembled from the
recent notes posted by the accounts the source identity follows — so that the feed shows me
relevant, current activity and clearly tells me when there's nothing (or no source) to show.

## Acceptance criteria
Testable from the outside (input → observable behavior). "The source identity" = the
logged-in user if one is present, else the instance's configured House point-of-view identity.

- [ ] **Resolution & content.** Given a source identity whose **kind-3 follow list is present
  in local strfry** and whose follows have posted kind-1 notes, when the feed contents are
  requested, then the result is the kind-1 notes **authored by those follows**, ordered
  **newest-first**, capped at the **50 most recent** qualifying notes; each item carries the
  note's **author identifier, timestamp, and text**, plus the author's **display name and
  avatar drawn from local profile data** (kind-0 in strfry / Meilisearch). Kind-6 (reposts) and
  kind-7 (reactions) are **excluded**; notes from accounts the source does **not** follow are
  excluded.

- [ ] **Relay source with fallback.** Given the request in the criterion above, the followed
  authors' kind-1 notes are gathered from the instance's configured **general-purpose relays**
  (the `the-set-of-general-purpose-relays` set under the `nostr-relay` concept, resolved by
  slug relative to this instance's own Tapestry Assistant — never a hardcoded deployment
  identifier). When that set **cannot be resolved or is empty**, the read path instead uses the
  fixed fallback relays `wss://relay.damus.io`, `wss://relay.primal.net`, `wss://nos.lol`,
  and still returns notes. (Resolved-set vs fallback is an observable distinction in the
  outcome.)

- [ ] **Edge — no source identity.** Given there is **no logged-in user and no House
  point-of-view identity configured**, when the feed contents are requested, then the result
  is an explicit **"no source / no House PoV" outcome** — distinct from an empty list — and no
  relays are queried.

- [ ] **Edge — follow list not local.** Given a source identity exists but its **kind-3 follow
  list is not present in local strfry**, when the feed contents are requested, then the result
  is an explicit **"follow list not available" outcome** — distinct from both the no-source
  outcome and an empty-but-present feed.

- [ ] **Edge — present but empty.** Given a source identity's kind-3 follow list **is present**
  in local strfry but yields **no qualifying kind-1 notes** within the recent window, when the
  feed contents are requested, then the result is an explicit **empty-feed outcome** for a
  valid, present follow list — distinct from the two outcomes above.

## Concepts touched
- `39999:e00ed09087b831ecf40442c82768b2114b707008916ac801dabbfbe76ae9df36:the-set-of-general-purpose-relays`
  — "general purpose relays" (relay set the kind-1 notes are fetched from; with hardcoded fallback).
- `39998:e00ed09087b831ecf40442c82768b2114b707008916ac801dabbfbe76ae9df36:nostr-kind`
  — kind-3 (source follow list, from local strfry), kind-1 (feed notes), kind-0 (profile display data).
- `39998:e00ed09087b831ecf40442c82768b2114b707008916ac801dabbfbe76ae9df36:nostr-user`
  — the source identity (a Nostr account identified by pubkey).
- House point-of-view identity — per the `pov-resolution` epic / three-PoV standard (the
  instance's configured House pubkey); not re-defined here.

## Out of scope
- The `/feed` page itself — rendering, layout, the "Live Feed" heading, the
  "Showing the most recent 50 notes" indicator, the on-page empty-state copy, public/no-login
  reachability, and the no-horizontal-overflow-at-1280px requirement. That is `live-feed` #2;
  this story produces the contents and the three edge outcomes, not their presentation.
- Tagging feed items with existing Tags (the later, separate book this feed exists to host).
- A source-identity / PoV selector — the source is resolved (logged-in user, else House PoV),
  never chosen here.
- Reposts (kind 6), reactions (kind 7), replies/threading, pagination beyond the 50-note
  recent-window cap, infinite scroll, full history.
- Any write/publish; any change to search, profile pages, ranking/scoring, or firmware.

## Open questions
Resolved at Planning by the operator's acceptance frame and two pre-resolved decisions:
- Recent-window cap = **50** notes (fixed).
- The source-resolution order (logged-in user → House PoV) and the three distinct edge
  outcomes are fixed by the frame.

None outstanding for this story.

## Linked artifacts
- ADR: (filled in after Architecture phase)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
