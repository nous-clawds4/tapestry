# Story 17: TA-signed note Trusted List (the note analog of pinned-tag TLs) — issue #336

**Status:** Approved
**Created:** 2026-07-06
**Type:** Feature

## Background
For a **pinned tag**, the instance already maintains a TA-signed **kind-30392** Trusted List of
the **pubkeys** trusted-tagged with that tag, per the pin's observer POV
(`refreshPinnedTags.runOnePin` → aggregate → disputes function → `buildAndPublishTL`). Generalized
(target-typed) pinning (event-tagging Story 12 / ADR 0015) made a pin able to target **notes** too,
but the note side stopped at a **user/client-signed kind-30003** bookmark-set *export*
(`publishNoteBookmarkSetForPin`) — there is **no TA-signed, instance-maintained Trusted List of the
notes tagged with a tag.** That gap is **issue #336**, deferred from ADR 0015.

This story closes it: for a pin whose tag targets **notes**, the instance publishes a **TA-signed
Trusted List of the trusted-tagged notes**, refreshed on the same cadence as the pubkey TL — the
event/note analog of the pinned-tag pubkey TL. All the pieces already exist and are reused: the
notes-for-tag read (`handleForTag` → notes with `{id, applications, disputes, createdAt}`), the note
curation (`curateNotes(notes, method)`), and the TA-signed publisher (`buildAndPublishTL`, which
already supports `e`-tag members). This story wires them into the pin-refresh path.

Affected: consumers reading a tag's trusted notes as an instance-curated list (other clients,
federation, our own future note surfaces); the pin-refresh cron.

## User-facing description
As a client (or another instance) reading tags, I want the instance to publish a TA-signed Trusted
List of the notes trusted-tagged with a given tag — just like it does for pubkeys — so I can consume
"the trusted notes for tag X, under this observer's point of view" as a maintained list instead of
having to aggregate the raw taggings myself.

## Acceptance criteria
Testable from the outside.

- [ ] **Publishes a TA-signed note TL for a note-targeting pin.** Given a pin whose referenced tag
  has target-type **note** (the pin's `targetTypes` includes `note`), when the pin-refresh runs,
  then the instance publishes a **TA-signed** Trusted List (TA pubkey resolved at runtime, guarded
  publish path) whose members are the **notes trusted-tagged** with that tag — encoded as **`e`-tags**
  (note event ids) — computed under the pin's **observer POV**.

- [ ] **Curated by the pin's note method.** Given the pin declares a `noteMethod`, then the note
  members are curated by `curateNotes(notes, noteMethod)` (v1: `notes:net-endorsed` default /
  `notes:most-applied`), in that method's order.

- [ ] **Distinct, non-colliding identity.** The note TL uses a **distinct kind** from the pubkey
  pinned-tag TL (kind-30392) and a **target-type-qualified `d`-tag**, so a single pin's note TL and
  pubkey TL never collide. It carries the same provenance metadata shape as the pubkey TL
  (observer / source-tag / curation), and a content JSON listing the note members.

- [ ] **Empty / retraction.** Given the curated note set is empty (no trusted-tagged notes, or all
  disputed), then the instance publishes an **empty-membership replacement** at the same `d`-tag
  (mirroring the pubkey TL's retraction), not a stale list.

- [ ] **Refreshed alongside the pubkey TL.** Given the existing pin-refresh enumeration runs (the
  `refresh-all-pinned-tags` loopback cron), then every **note-targeting** pin gets its note TL
  refreshed in the same pass — the pubkey TL for that pin is still refreshed unchanged.

- [ ] **Additive — nothing existing changes.** The pubkey pinned-tag TL (kind-30392) and the
  user-signed kind-30003 note bookmark-set export are **unchanged**; removing this story's additions
  leaves both intact.

## Concepts touched
- `39998:<TA>:nostr-event-tag` — the note taggings whose targets populate the list.
- `39998:<TA>:tag` — the pinned tag.
- `39998:<TA>:tag-pinning` — the pin that drives the refresh (its observer + noteMethod + cutoff).

> TA pubkey resolved at runtime; the note TL is signed by the TA like the kind-30392 pubkey TL.

## Out of scope
- **Consuming/rendering** the note TL in any UI (this story publishes it; a reader surface is later).
- Note curation methods beyond `curateNotes`'s v1 set.
- The `NOTES_CAP` recency-window limitation on the underlying note read (documented in ADR 0015 /
  the Story-12 review; inherited, not fixed here).
- Third-party "taggings-on-tags" membership assertions (a separate, later direction).
- Any change to the pubkey pinned-tag TL, the kind-30003 export, search, ranking, or firmware.

## Open questions
- **Kind + d-tag (Architecture).** The pubkey pin TL is kind-30392; applicability is 30393. The
  Architect picks the note TL's kind (likely **30394**, the next in the sanctioned 30392–30395 TL
  range) and the target-type-qualified `d`-tag (e.g. `tl-pin-notes-<observer8>-<tagAuthor8>-<slug>`,
  paralleling the pubkey `tl-pin-…` and the client export's `notes-pin-…`). Confirm the metric label
  (e.g. `pinned-tag-notes`).
- Whether the note read is reused via `handleForTag`'s core or a small extracted helper — Architecture.

## Linked artifacts
- ADR: (filled in after Architecture phase)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
