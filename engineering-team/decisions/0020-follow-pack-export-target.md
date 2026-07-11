# ADR 0020: Follow Pack (kind-39089) export target

**Status:** Accepted
**Date:** 2026-05-30
**Story:** `engineering-team/stories/22-follow-pack-export-target.md`

## Context

ADR 0019 established the single **Export** modal (`ui/src/components/
ExportModal.jsx`) with two targets behind the "What will be exported?"
disclosure:

- **Follow Set** — kind-30000, user-signed, default-checked. A *private
  cross-client mirror*: it lands under the user's own pubkey so their
  own nostr clients can read it. Prepared by `POST
  /api/trusted-list/prepare-nip51-export`, signed via NIP-07, published
  by `publishNip51ExportForPin()` (`ui/src/utils/publishTagPin.js:234`).
- **Trusted List** — kind-30392, TA-signed, default-checked. Recomputed
  by `POST /api/trusted-list/refresh-pinned-tag`.

Story 22 adds a third, **opt-in** target: a NIP-51 **Follow Pack**
(kind-39089, "starter pack"). Per the NIP, a 39089 is "a named set of
profiles to be shared around with the goal of being followed together,"
carrying `p` (pubkey) tags. Clients like Amethyst/Primal surface starter
packs as a first-class "follow these all at once" affordance.

The crucial semantic difference from the Follow Set: **a starter pack
exists to be handed to other people.** That reframes what "done
properly" means — see the critique of the first-cut implementation below.

### What an exploratory first cut already did (the substrate to ratify or fix)

An incremental change landed before this ADR. It:

- Added an optional `kind` (default 30000, validated ∈ {30000, 39089}) to
  `handlePrepareNip51Export` (`src/api/trustedList/index.js`) and threaded
  it through `publishNip51ExportForPin({ kind })` and the modal.
- Added an unchecked-by-default **Follow Pack** checkbox to the
  disclosure, publishing kind-39089 on confirm (TL → 30000 → 39089 order).
- Updated the trigger tooltip + header doc-comment copy.

**What it got right:** the DRY publish path (one source of wire-shape
truth — d-tag, z-tag, title, `p` membership are kind-agnostic), the
unchecked default, z-tag binding consistent with ADR 0017, server-side
kind validation, and fresh-membership ordering. This ADR **keeps that
core.**

**Where it fell short (why the user wasn't convinced):**

1. **Write-only.** A starter pack's whole purpose is sharing, yet the
   cut computes the share `naddr` at publish time and discards it. The
   Follow Set gets a copyable "Follow Set (naddr)" row in
   `PinnedListPanel.jsx:365`; the 39089 got nothing. You could publish a
   pack and have zero UI trace or shareable handle for it.
2. **No status / no memory.** `enrichRowsWithNip51ExportStatus`
   (`src/api/profile-tags/index.js:1479`) scans kind-30000 only, so the
   modal can't show "already exported as a pack," the checkbox resets
   blind, and a published pack silently drifts after a re-tag (the 30000
   has the honest two-line in-sync/stale machine; the pack had nothing).
3. **Description copy mismatch.** Both kinds reused
   `BRAINSTORM_EXPORT_DESCRIPTION` ("…Re-publish from your Brainstorm
   instance to update.") — mirror framing that is meaningless to a
   stranger who receives the pack in another client.

### Concepts touched (Concept Graph orientation)

Via `http://localhost:8877/api/concept-graph/node/39998:<TA>:tag-pinning`
— the `tag-pinning` concept (`uuid 39998:<TA>:tag-pinning`, labels
`NostrEvent / ListHeader / ConceptHeader`) is the binding the kind-30000
export's `z` tag already references (ADR 0017 Q2). The Follow Pack reuses
the **same** z-tag handle. **No concept schema changes; no new concept.**

## Options considered

### Option A — Ratify-and-complete: keep the DRY path, add the read-side (chosen)

Keep the parameterized prepare/publish path. Add what makes a pack a
coherent, shareable, trackable artifact:

- A **sharing-appropriate description** for kind-39089 (not the mirror copy).
- **Status tracking**: extend the `/pins` enricher's single strfry scan to
  cover kind-39089 too (one combined `kinds:[30000,39089]` scan), yielding
  a new `followPackStatus` per row whose vocabulary **mirrors
  `nip51ExportStatus` exactly** (`never-exported` / `ok-fresh` / `stale`,
  with a member diff vs the current 30392) — the *export* action is what
  publishes the pack, so the status speaks of exporting, not "sharing."
- A copyable **"Follow Pack (naddr)" row** in `PinnedListPanel`, gated on
  `followPackStatus.status !== 'never-exported'` (same gating as the Follow
  Set row — before the first export the naddr would point at nothing), plus
  a **drift hint** ("N members behind your current list — re-export to
  update") when `stale`.
- Packs are **explicit snapshots**: NOT wired into the re-export
  orchestrator (`runReexportForPin`). They are not silently re-signed on
  every re-tag; the drift hint keeps them honest instead.

- **Pros:** keeps the one-cut's DRY core; the pack stops being write-only;
  honest about staleness without a prompt-per-retag; one extra event kind
  in an already-existing batched scan (negligible cost); reuses the
  existing `NaddrRow` component and diff machinery.
- **Cons:** adds a `followPackStatus` field + a panel row + a description
  branch — more surface than the one-cut, though all read-side and small.

### Option B — Write-only one-cut, as landed (rejected)

Publish-and-forget; no share affordance, no status.

- **Cons:** the feature is incoherent for its own purpose — you can
  publish a "share this around" artifact and then have no way to share it
  or even see it exists. Rejected by the user explicitly ("not convinced
  it did it properly").

### Option C — Fully symmetric first-class pack (separate namespace + auto-re-export) (rejected)

Give the pack its own d-tag namespace and wire it into the re-export
orchestrator for full kind-30000 parity (re-signs on every re-tag).

- **Cons:** over-built. A distinct d-tag breaks the elegant "same
  membership, parallel addressable coordinate" model for no user benefit.
  Auto-re-publish forces a *second* NIP-07 signing prompt on every Apply/
  Dispute/curation-edit that touches a pinned tag — worse UX for an
  artifact that is better understood as a deliberate point-in-time
  snapshot. Doubles the status/orchestrator surface. Rejected.

## Decision

We chose **Option A**. The 39089 differs from the already-built 30000 by
one field on the write side (`kind`), so the DRY prepare/publish path
stays. But "proper" for a *sharing* artifact requires the read-side the
first cut omitted: a retrievable share handle, a record that it was
shared, and honest drift signalling. Packs are **explicit snapshots**
(no auto-re-publish) — a starter pack is "here's the set right now," and
silently rewriting a published pack (with a prompt) on every re-tag is
worse than a visible "re-export to update" hint. Follow Pack stays
**unchecked by default**; the default two-target behavior of ADR 0019 is
unchanged.

Note on vocabulary: the **Export** action publishes the kind-39089 to the
user's write relays + fallbacks, so the pack is public the moment it is
exported — copying its naddr just hands someone a pointer to something
already live. The UI therefore speaks of *exporting* (consistent with the
Follow Set), not a separate "share" step.

## Consequences

- **Enables:** publishing a pinned tag's membership as a shareable NIP-51
  starter pack, with a copyable naddr and an honest "exported / N behind"
  status — surfaced under the user's own identity, discoverable in
  pack-aware clients.
- **Constrains / trades away:** when both Follow Set and Follow Pack are
  checked, the user sees two NIP-07 prompts (one per distinct signed
  event) — unavoidable and honest. A pack can lag the current membership
  until the user deliberately re-exports; we surface that rather than hide
  or auto-fix it.
- **Follow-ups / debt:** the starter-pack `image` tag is unspecified
  (deferred). If snapshots later prove annoying, auto-re-publish remains a
  future option — but it would mirror, not fork, the 30000 orchestration.
- **Firmware reinstall required?** **No.** No concept definitions change;
  the 39089 reuses the existing `tag-pinning` z-tag handle.

## Implementation notes

Concrete; the Implementer reads this.

**Wire shape (kind-39089), built by `handlePrepareNip51Export`:**
```
{ kind: 39089, pubkey: <viewer>, tags: [
    ['d', dTag],                       // SAME dTag as the 30000 (tl-pin-<obs8>-<author8>-<slug>)
    ['z', TAG_PINNING_Z_TAG],          // concept binding, per ADR 0017
    ['title', title],
    ['description', FOLLOW_PACK_DESCRIPTION],   // NEW kind-specific copy
    ...members.map(pk => ['p', pk]),
  ], content: '' }
```
The shared `d`-tag is intentional and correct: `30000:viewer:dTag` and
`39089:viewer:dTag` are distinct addressable coordinates (kind differs),
so they coexist without collision and stay parallel.

- **`src/api/trustedList/index.js` — `handlePrepareNip51Export`:**
  - The `kind` param + `exportKind ∈ {30000,39089}` validation already
    exist (keep). Add a `FOLLOW_PACK_DESCRIPTION` constant and select it
    when `exportKind === 39089`; otherwise keep `BRAINSTORM_EXPORT_DESCRIPTION`.
    Suggested copy: *"A starter pack from Brainstorm — a set of profiles
    trusted in this tag under the sharer's web-of-trust point of view.
    Follow them all at once."*

- **`src/api/profile-tags/index.js` — `enrichRowsWithNip51ExportStatus`:**
  - Widen the single batched scan from `kinds:[30000]` to
    `kinds:[30000, 39089]` (same `authors:[viewer]`, same `'#d': wantedDTags`).
    Bucket results by `(kind, dTag)`; latest-by-`created_at` per coordinate.
  - Leave `row.nip51ExportStatus` (kind-30000) exactly as is.
  - Attach `row.followPackStatus` derived the same way against the 39089
    bucket, **with the same field/vocabulary shape** as `nip51ExportStatus`:
    `{ status, exportedAt, exportEventId, memberCount, diffVsTL, currentTitle }`
    where `status ∈ {'never-exported','ok-fresh','stale'}` (`stale` when the
    member diff vs the current 30392 is non-zero).
  - Update the function doc-comment to note it now covers both NIP-51 list
    kinds. (A sibling enricher is acceptable too, but one combined scan is
    cheaper — prefer extending in place.)

- **`ui/src/utils/publishTagPin.js`:**
  - `publishNip51ExportForPin({ kind = 30000 })` and the `naddrEncode({ kind })`
    already exist (keep — it already *returns* `{ naddr, … }`).
  - Do **not** add kind-39089 to `runReexportForPin` (snapshot decision).
    Add a one-line comment there stating packs are deliberately excluded.

- **`ui/src/components/ExportModal.jsx`:**
  - Keep `exportFollowPack` default `false` and the kind-39089 confirm
    branch. When `followPackStatus.status !== 'never-exported'` (read from
    the pin row the parent already has), show a subtle "Last exported as a
    pack {ago}" hint under the checkbox — do **not** auto-check it (opt-in
    semantics preserved; surfacing memory ≠ re-selecting).
  - (Optional polish) on a successful pack export, surface the returned
    `naddr` as a "Copy pack address" affordance in the done state. The
    persistent naddr row in the panel (below) is the primary deliverable.

- **`ui/src/components/PinnedListPanel.jsx`:**
  - Add a `naddr39089` memo mirroring `naddr30000` (`PinnedListPanel.jsx:205`)
    but `kind: 39089`.
  - Render a `<NaddrRow label="Follow Pack (naddr)" …>` gated on
    `followPackStatus.status !== 'never-exported'`, help copy e.g. *"Others
    can follow the whole set at once from this address."*
  - When `followPackStatus.status === 'stale'`, render a drift hint using
    `diffVsTL` (e.g. "This pack is N members behind your current list —
    re-export to update").

## Out of scope

- The starter-pack `image` tag.
- Auto-re-publishing the pack on re-tag (explicitly rejected — packs are
  snapshots; the drift hint covers honesty).
- A separate d-tag namespace for packs (rejected — shared d-tag is correct).
- Any concept-graph schema change / firmware reinstall (none needed).
