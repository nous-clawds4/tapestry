# Story 2: Add `treasureMaps` router preset and kind 10040 to Negentropy Sync

**Status:** Approved
**Created:** 2026-05-13
**Type:** Feature

## Background

Kind 10040 events (NIP-85 "TA Treasure Maps") are how a customer advertises which delegated signers publish their Trusted Assertions and at which relay. The Brainstorm Web of Trust pipeline depends on having each relevant customer's 10040 in local strfry — backend pipelines like `/api/get-all-10040-authors-locally` enumerate POVs from local strfry and skip anyone whose 10040 isn't there.

Today, operators have to import each 10040 manually (via the `/settings` Import button shipped in [#117](https://github.com/nous-clawds4/tapestry/pull/117), or via the user-detail page's Update button). That works for one-off bring-up but doesn't catch *changes* — when a customer publishes an updated Treasure Map, this instance won't see it until someone manually re-imports. For an instance serving multiple customers, manual import doesn't scale.

The fix is to treat 10040 like other event kinds the router already maintains (kind 0 profiles, kind 9998/9999 DCoSL events, etc.): add it as a router preset operators can toggle on. Volume is fine — across the nostr ecosystem there are at most low-thousands of kind 10040 publishers, trivial for strfry.

## User-facing description

**As an operator of a Brainstorm instance**, I want to enable continuous bidirectional sync of kind 10040 events with popular general-purpose relays, **so that** new and updated customer Treasure Maps land in my local strfry automatically — without me having to import them by hand — and my own customers' Treasure Maps propagate outward to other Brainstorm instances.

## Acceptance criteria

- [ ] On `/tapestry/settings/relays` Router Management tab, a new preset named `treasureMaps` is visible in the list of available presets.
- [ ] The `treasureMaps` preset defaults to OFF — operators deploying a fresh instance do not start syncing 10040s until they explicitly enable it on the Router Management tab.
- [ ] When an operator enables the preset, the strfry-router daemon reloads and begins exchanging kind 10040 events with the configured relays in *both* directions (inbound from upstream, outbound from this instance's own published 10040s).
- [ ] The configured relays for this preset are: `wss://relay.damus.io`, `wss://nos.lol`, `wss://relay.primal.net`.
- [ ] When an operator disables the preset, the bidirectional stream stops on the next router reload.
- [ ] The preset's enabled/disabled state persists across container restarts — toggling it on, then running a deploy that rebuilds the container, results in the preset still being on.
- [ ] On `/tapestry/settings/relays` Negentropy Sync tab, the Event Kinds picker offers a new option for kind 10040 (Treasure Maps). Selecting it and running a sync produces a strfry sync command filtered to `kinds: [10040]`.
- [ ] Documentation: `BIBLE.md` and/or `docs/CONFIGURATION.md` is updated to describe the router presets system (which doesn't currently appear in detail in either doc). The docs also state that a Negentropy preset system analogous to the router preset system is planned future work.

## Concepts touched

Concept-graph handles to be resolved by Architect via `/api/concept-graph/summaries`:

- Kind 10040 (TA Treasure Map / NIP-85)
- Kind 30382 (Trusted Assertion) — the events 10040 *references*; not directly touched but the reason 10040 matters
- strfry-router preset system
- Negentropy Sync UI

## Out of scope

- **Building a Negentropy preset system.** A future story can add a preset/profile system for the Negentropy Sync tab mirroring how router presets work. The Negentropy Sync change in *this* story is purely a one-item addition to the existing hardcoded Event Kinds picker.
- **Whitelisting which 10040 authors to sync.** This story syncs *all* 10040 events from the configured popular relays. A future story can add author allowlists.
- **Auto-enabling the preset on existing instances.** The preset is opt-in, so existing operators are unaffected until they choose to turn it on.
- **Changes to the per-user Import button on `/settings`.** That stays in place as a fast per-user fallback for fresh-droplet bring-up.

## Open questions

None at draft time. Design choices (preset name `treasureMaps`, the three relay URLs, doc updates, test scope) were resolved with the user before this story was drafted.

## Linked artifacts

- ADR: (filled in after Architecture phase)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
