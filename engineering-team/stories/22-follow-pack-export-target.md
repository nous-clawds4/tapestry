# Story 22: Follow Pack (kind-39089) export target

**Status:** Approved
**Created:** 2026-05-30
**Type:** Feature

## Background

Story 21 / ADR 0019 collapsed pin publication into a single **Export**
modal with two targets hidden behind a "What will be exported?"
disclosure: a **Follow Set** (kind-30000, user-signed, cross-client) and
a **Trusted List** (kind-30392, TA-signed, internal). Both are checked by
default.

NIP-51 also defines a **starter pack** (kind-39089): "a named set of
profiles to be shared around with the goal of being followed together,"
carrying `p` (pubkey) tags. Several nostr clients (e.g. Amethyst,
Primal) surface starter packs as a first-class "follow these all at
once" affordance — a discovery surface a plain Follow Set does not get.

A pinned tag's membership is exactly such a named set of profiles, so it
is a natural thing to publish as a starter pack. But unlike the Follow
Set, a starter pack is a deliberate "share this around" act, not the
private cross-client mirror most users want by default. So it should be
**opt-in**, not part of the default export.

## User-facing description

As a user exporting a pinned tag, I want an optional **Follow Pack**
target in the "What will be exported?" disclosure, so that I can publish
my pinned-tag membership as a shareable NIP-51 starter pack (kind-39089)
that other clients let people follow all at once — without changing the
default two-target behavior.

## Acceptance criteria

- [ ] Given the Export modal's "What will be exported?" disclosure, when
      it is expanded, then it shows a third target labeled **Follow Pack
      (kind-39089)** in addition to Follow Set and Trusted List.
- [ ] Given the modal is opened, then **Follow Pack is unchecked by
      default**; Follow Set and Trusted List remain checked by default.
- [ ] Given Follow Pack is checked and Export is confirmed, when the
      export runs, then a kind-39089 event is signed (NIP-07) and
      published carrying the same `p` membership, `d`-tag, title, and
      description as the kind-30000 Follow Set for the same pin.
- [ ] Given only Follow Pack is checked (Follow Set + Trusted List
      unchecked), when Export is confirmed, then the export still runs
      (Follow Pack alone is a valid selection); the Export button is
      disabled only when **all three** targets are unchecked.
- [ ] Given any user-signed list (Follow Set and/or Follow Pack) is
      selected, then the relay-preview block renders (it is relevant to
      both, since both publish to the user's write relays + fallbacks).
- [ ] Given copy that names the Follow Set / Trusted List pair (the
      trigger-button tooltip, the modal header doc), then it also
      mentions the optional Follow Pack.
- [ ] Given the kind-39089 is published, then it carries a
      **sharing-appropriate description** (not the kind-30000 mirror copy
      that says "Re-publish from your Brainstorm instance").
- [ ] Given a pin's `/pins` row, then it carries a `followPackStatus`
      whose shape/vocabulary mirrors `nip51ExportStatus`
      (`never-exported` | `ok-fresh` | `stale`, with a member diff vs the
      current kind-30392), derived live from strfry.
- [ ] Given a Follow Pack has been exported for a pin, when the Pinned-tab
      detail panel renders, then it shows a copyable **"Follow Pack
      (naddr)"** row (gated on `followPackStatus.status !== 'never-exported'`,
      the same gating as the Follow Set row — before the first export the
      naddr would point at nothing).
- [ ] Given an exported Follow Pack's membership now differs from the
      current pinned-tag membership (`stale`), then the panel shows a
      **drift hint** ("N members behind your current list — re-export to
      update"); the pack is NOT silently re-published (snapshot semantics).
- [ ] Given a pin whose Follow Pack was previously exported, when the
      Export modal opens, then it surfaces a "last exported as a pack {ago}"
      hint under the checkbox — without auto-checking it (opt-in preserved).

## Concepts touched

No concept-graph concepts change. The kind-39089 reuses the existing
`tag-pinning` z-tag handle (`TAG_PINNING_Z_TAG`), exactly as the
kind-30000 export does — no new concept, **no firmware reinstall**.

## Out of scope

- **Auto-re-publishing** the pack on re-tag. Packs are deliberate
  point-in-time snapshots; the re-export orchestrator (ADR 0019's
  `runReexportForPin`) stays kind-30000 only. Honesty is provided by the
  drift hint, not by silently re-signing the pack.
- The starter-pack `image` tag.
- A separate d-tag namespace for the pack (it reuses the Follow Set's
  d-tag — distinct addressable coordinate by kind).

## Open questions

- None blocking. (Resolved: Follow Pack reuses the same d-tag as the
  Follow Set — different kind ⇒ distinct addressable coordinate, so no
  collision; keeps the two parallel.)

## Linked artifacts
- ADR: `engineering-team/decisions/0020-follow-pack-export-target.md`
- Test plan: `engineering-team/stories/22-follow-pack-export-target.test-plan.md`
  (read-side failing tests added to `test/collapse-into-export-concept.test.js`).
- Review: `engineering-team/reviews/22-follow-pack-export-target.md` — **PASS** (2 non-blocking cosmetic notes)
