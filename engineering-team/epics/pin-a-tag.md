# Epic: Pin a tag (aka Tracked Tags)

**Status:** Active
**Created:** 2026-05-18
**Branch:** `feat/tracked-pinned-tags`
**Linked issue:** [#150 — Pinning (aka Tracked tags)](https://github.com/nous-clawds4/tapestry/issues/150)

## What this is

A user-opt-in mechanism for marking tags they want to track as a personal curated set. The primary downstream consequence is that each Pinned tag periodically gets a NIP-85 Trusted List published from it by the Tapestry Assistant, computed under the user's POV via a configurable curation method. This unlocks the five concrete utilities documented in #150: content discovery, GrapeRank input, list curation, channel feeds, and ring-signature input.

## Why now

Stories 1–9 built the tag substrate (apply, dispute, browse, search). The next leverage point is letting users turn a tag they care about into actionable output (a Trusted List under their POV) — which both extends Brainstorm's value to other nostr apps and gives this user a reason to come back.

## Naming

**Pin** is the verb of art. "Tracked tags" is the synonym in #150's title and the branch name; prefer **Pin / pinned** in user-facing copy and code identifiers going forward.

## Cross-story architectural shape

- **Storage**: each Pin is a **kind-39999** list-element signed by the user, carrying:
  - `z` → a new firmware ConceptHeader (kind 39998) for "tag-pinning"
  - `a` and `e` → references to the tag being pinned
  - `curation-method` → stringified JSON of the user's selected curation params
- **Replaceability**: kind-39999 list-elements are addressable replaceable (`d` keyed). Unpin and curation-method edits both go through the standard replacement path. Story 10 chooses kind-5 delete vs. replacement-with-status for unpin.
- **Curation-method schema (v1):**
  ```json
  {
    "observer": "<hex pubkey, default = self>",
    "method": "nip85:rank | follows | trust-everyone | trusted-list",
    "trustedList": "<a-tag ref, only if method=trusted-list>",
    "cutoff": 2,
    "includeScoreInTL": false
  }
  ```
- **TL publication** (Story 12): TA-side cron generates kind-30392 (per the Trusted List Custom NIP at nostrhub.io) on q24H / qWeek schedule + on-demand "Refresh now". Disputes function for v1: `endorsements ≥ cutoff AND endorsements > disputes` (subject to refinement during Story 12 design). **Publication destination: local strfry only.**
- **Scope of pinnable targets in v1**: tags whose targets are **pubkeys only**. Pinning tags of DLists or content is out-of-epic.

## Story decomposition

| # | Title | Status | Scope sketch |
|---|---|---|---|
| 10 | **Pin a tag (foundational)** | Draft | User can pin/unpin a tag from its detail page; `/pins` page lists pinned tags; default `curation-method` JSON written into each Pin event; no TL publication yet. |
| 11 | **Customize curation at pin time** | Stub | Dialog/form at pin moment (and from `/pins`) lets the user override default `curation-method`: observer, method, cutoff, include-score. Reuses Trust Determination vocabulary. |
| 12 | **Periodic TL publication from Pins** | Stub | TA-side cron generates kind-30392 per pinned tag, applying its `curation-method`. Publishes to local strfry only. Lock down disputes function. "Refresh now" button. q24H / qWeek schedule. |
| 13 | **"Most pinned" sort + filter on tag index** | Stub | Aggregate Pin events across active POV's WoT; new sort option, filter facet, per-row pin-count, and pin-state indicator on Story 4's tag index. |
| 14 | **Treasure Map (kind 10040) integration** | Stub | Surface pinned-tag TLs in the user's kind-10040 Treasure Map for cross-app discovery (nostria.app etc.). Tag prefix (`PinnedTag:` vs `TrustedList:`) needs its own design pass. |
| 15 | **Encryption option for Pin events** | Stub | Optional NIP-44 encryption of Pin events so a user's interests aren't a public fingerprint. Needs threat model first; defer until at least 12 ships. |

Only Story 10 has full AC right now. The others stay as stubs until promoted just before being worked.

## Explicitly out-of-epic

- **DM alerts on TL deltas.** Considered and dropped — the notification firehose risk outweighs the value at this stage. Logged in `engineering-team/follow-ups.md` for possible future revisit, not as a story stub here.

## Linked artifacts

- GitHub issue: https://github.com/nous-clawds4/tapestry/issues/150
- Foundational story: `engineering-team/stories/10-pin-a-tag.md`
- (Further story files added as stories are promoted from stubs)
