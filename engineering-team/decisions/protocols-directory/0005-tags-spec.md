# ADR 0005 (protocols-directory): Tags & Taggings pre-NIP — family framing, D4 reconciliation, skeleton

**Status:** Accepted
**Date:** 2026-06-10
**Story:** `engineering-team/stories/protocols-directory/7-tags-spec.md`

> Full ADR — the epic finale: a two-branch synthesis (tags branch wire formats × the communities branch's correction) plus the family framing the owner delegated at the story gate.

## Context

Story 7 produces `protocols/drafts/tags.md` from the `feat/pubkey-tagging-target` branch (ADRs 0001/0009, firmware concepts `tag`/`nostr-user-tag`/`tag-pinning`, the three publishers), under two inherited obligations: ADR 0004's **D4** (reconcile the assertion-shape variants, `feat/communities` ADR 0030's a-primary correction as the latest word) and the communities spec's two pending markers. Fresh verification this phase: the deployed assertion publisher (`publishProfileTag.js` on the tags branch) emits exactly `['d','p','e','z','polarity']` — **no `a` tag** — so the deployed shape and the 0030-corrected shape genuinely differ on the wire today. The pin publisher's curation defaults verified (`observer`, `method: 'nip85:rank'`, `cutoff`, `includeScoreInTL`).

## Decision

### (1) Family framing (per the owner's gate guidance, recorded in the story)

The spec opens with **"The taggings family"**: a *tagging* is an assertion that a target belongs to a tag — a family whose **deployed instance** is `nostr-user-tag` (pubkey targets) and whose **planned siblings** are `nostr-event-tag` (event targets; kinds 39998/39999 first) with `dlist-tag` envisioned as a subset of `nostr-event-tag` (actively desired). The family tree is presented as **design direction sourced to the owner's ratified guidance** — explicitly non-normative beyond the deployed instance; no wire format is invented for unbuilt siblings. The **rename question** (`nostr-user-tag` → `nostr-user-tagging`?) is marked open and **wire-impactful**: the slug is embedded in `z` handles on user-signed history, so a rename is a concept-migration decision (the W1/legacy-literal lesson), never a documentation edit. Family naming + expansion gets a new worksheet entry, **W10**.

### (2) D4 reconciliation — honest, in spec text

The Taggings section presents:

- **Normative shape (a-primary):** `d` (deterministic), `p` = target pubkey, **`a` = the tag-element's a-coordinate (stable identity — what consumers claim/scan)**, `e` = tag event id at apply-time (provenance only), `z` = the deployment's `nostr-user-tag` concept address, `polarity`. Source: `feat/communities` ADR 0030 (the 2026-06-05 correction), matching the shape the communities spec quotes.
- **Deployed variant note (wire-status information, not a footnote):** the tags branch's live publishers emit `d/p/e/z/polarity` **without `a`** (tags-branch ADR 0001 shape); 0030 expects existing assertions to be backfilled with `a` and records its correction as "pending the tags branch owner's confirmation." Until confirmation + backfill, readers needing completeness must union `#a` and legacy `#e` lookups. Status presented exactly so.

### (3) Spec skeleton (fixed, 9 headings)

```
(repo-metadata header: 📝 pre-NIP · in-flight note: feat/pubkey-tagging-target (Vinney), unmerged,
 live at tags.brainstorm.world · sources: tags-branch ADRs 0001/0009 + firmware concepts;
 feat/communities ADR 0030 (assertion-shape correction); epic handoff §6)
---
Tags & Taggings
=====
## The taggings family            (deployed instance vs planned siblings; rename open → W10)
## Relationship to other specs    (rides on DList + Tapestry Concepts; consumed by Communities)
## Tag definitions                (kind 39999, z→tag concept, d=slug, content {tag:{slug,name,description}})
## Taggings (assertions)          (normative a-primary shape; deployed-variant note; d-tag convention
                                   profile-tag-<slug>-<target8>-<asserter8>; replaceability = latest-wins
                                   per (author, target, slug))
## Polarity                       ("1"/"-1"; v1 buckets ≥0.5 applied / ≤−0.5 disputed; reserved middle → W3)
## Pins                           (z→tag-pinning; dual e+a reference → W4; curation-method fields
                                   observer/method/cutoff/includeScoreInTL; d-tag tag-pin-<slug>-<author8>-<viewer8>)
## Unpinning                      (NIP-09 kind-5; pin-exists ⇒ pinned)
## Event tagging (planned)        (39998/39999 targets first; explicitly not yet specified; family tree pointer)
## Open questions                 (W3 polarity arc; W4 e-vs-a; W10 family naming/rename; deployed-variant
                                   reconciliation status; cross-deployment concept identity → W1)
```

Out of the spec (boundary, per the epic handoff's original analysis): the Trusted-List (kind 30392) publication pipeline, pinned-tab UI, "most pinned" aggregation, PoV read filtering, the `tl-pin-*` d-tag layer, and the ADR 0015 legacy-literal exception (BIBLE/branch history; all `z` handles deployment-neutral with the W1 pointer).

### (4) Communities-spec repoints

Both markers — the Relationship sentence and the Membership intro — become plain references to `[Tags & Taggings](./tags.md)`, parentheticals retired; the Membership intro gains "(deployed-variant status noted there)" so the communities reader still discovers the backfill caveat.

### (5) Worksheet treatment

- **W3 / W4:** refs gain the spec as owning context (`[tags spec](./drafts/tags.md)` § Polarity / § Pins, alongside the existing branch-ADR refs).
- **New W10 — Taggings family naming & expansion:** the owner's guidance quoted; the rename's wire impact; handle decisions for `nostr-event-tag`/`dlist-tag`; relationship to the event-tagging rollout. Refs: the spec § family, story 7's gate record, handoff §6.
- Proactive sweep for anything else.

### (6) README final state

Row 7 → working copy (story 7 ✅). The index preamble's "Migration is in progress…" paragraph is replaced with the completed framing: the initial migration (stories 1–7) is complete; every spec lives here as the working copy; the status column tracks publication state. Flagged as the story's allowed small edit.

## Options considered

The one real fork was **where the deployed-variant note lives**: spec text (chosen — it is wire-status information an implementer needs to read events correctly today) vs. source-map-only (rejected: hides a live read-completeness hazard) vs. resolving silently to a-primary (rejected outright: falsifies the wire and pre-empts Vinney's pending confirmation).

## Consequences

- The epic's migration completes: no wire format left homeless; the communities spec's dependency closes.
- The D4 union-read guidance gives implementers a correct path *today* while the backfill decision stays Vinney's.
- W10 inherits the family/rename program — including the `dlist-tag` ambition — as a tracked protocol question rather than chat history.
- **Firmware reinstall required?** No.

## Implementation notes

- Files: `protocols/drafts/tags.md` (new, per skeleton); `protocols/drafts/communities.md` (two marker repoints); `protocols/worksheet.md` (W3/W4 refs, +W10, sweep); `protocols/README.md` (row 7 + preamble). **BIBLE.md: zero diff.**
- Source map required (spec section → tags-branch ADR/publisher/firmware lines, 0030, handoff §6), with the D4 presentation and any survey-vs-source corrections flagged.
- Gates: `npm test`; four-file diff scope; zero BIBLE diff; link/anchor checks incl. the W10 anchor and the repointed communities links; dual-normativity sweep (assertion shape now lives in tags spec as normative — communities spec's quoted block must read as *consumption* of it, not a second normative home; verify the framing).

## Out of scope

- Resolving W1/W3/W4/W10; Vinney's backfill confirmation; any rename migration.
- Event-tagging wire format; TL pipeline; code/firmware changes; publishing.
- Epic close-out (the PROTOCOLS_DIRECTORY_DESIGN_HANDOFF status flip and `/close-book` belong to the epic-completion step after this story ships, not to this story).
