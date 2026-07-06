# Epic: Tag Applicability

**Status:** Active
**Provenance:** Operator request 2026-07-06 (David's four-step sequence). Implements the
ratified tag-identity doctrine — see `docs/research/on-tagging-and-ontology/TAG-IDENTITY-MEMO--for-david.md`
and `STATE_AND_DIRECTION_MEMO_2026-07-05.md`. Cross-cutting vocabulary-policy work spanning
both pubkey-tagging (`profile-tags`) and event-tagging (`event-tags`) — hence its own epic,
not a sub-story of `event-tagging`.

## The doctrine this epic implements (constraint, not up for re-litigation)

> **Topic is the identity of the Tag; target-type is a property of the Tagging;
> applicability is a derived, per-POV view.**

- The declared type z's are **hints** — the author's optional, additive statement of intent.
  Never required for a tag to function; never a gate a reader enforces.
- The **operative** source of "which tags are for events / pubkeys" is a pair of **derived
  Trusted Lists** whose membership is **HINT ∪ USAGE** (declared-z tags UNION tags observed
  applied to that target type in the taggings data). Usage is already computed by
  `/api/tags/index` (unified tag index) — build on it, don't re-scan.
- Why hint alone can't be the source: z-membership is author-only, and no pre-existing tag
  carries the new z's — a hint-only picker would hide every existing tag and pressure users to
  re-mint per-type duplicates (identity forks). Hence the union.

## Stories

`stories/tag-applicability/`:
1. **type-hints-and-applicability-lists** — emit the two additive z-hints on newly-created
   tag-elements (pubkey-flow / event-flow), and derive + publish the two **HINT ∪ USAGE**
   Trusted Lists ("Tags for Nostr Pubkeys" / "Tags for Nostr Events"), TA-signed. The data
   substrate. *(steps 1+2)*
2. **type-aware-picker-and-scheduled-regen** — the three tag pickers become type-aware
   (type-relevant tags first, full-search always one tap away), and the TL regeneration runs on
   the existing task-queue schedule. The visible layer + freshness. *(steps 3+4)*
3. **same-slug-cross-type-warning** *(fast-follow)* — when creating a new tag whose slug already
   exists in the other type's usage set, surface it and offer to adopt it instead of minting a
   duplicate. The primary anti-fork affordance.

**Dependency order:** #1 → #2 (the picker consumes #1's lists; it falls back to live
`/api/tags/index` when a list is unavailable). #3 builds on #2's create flow.

## Out of scope (whole epic — reject at the gate)

- **No per-type tag-concept DLists** in the concept graph (no "A2/A3" headers) — the lists are
  derived views published as TLs, not new concepts.
- **No changes to existing tag-elements or taggings; no retroactive re-stamping.**
- **No facet letters / multidimensional tag encoding** (the W2/L1 arc).
- **No third-party membership assertions** (dlist-tag taggings-on-tags) — later story.
- **No firmware concept-seeding for the two z strings** (deferred; the core constants suffice).
- **No removal or weakening of any existing read path** — the declared z's must be inert to
  every existing reader (`classifyEventTaggings`, profile-tags reads, `/api/tags/index`); each
  story carries a regression check.
- **No pushes/deploys without explicit operator approval.** (`feat/tags` auto-deploys to
  `tags.brainstorm.world` on push — operator approves each push.)

## Anticipated future (noted, not built)

- The two z values are the **lowest rung of the z-tag ladder** — human-readable, pubkey-free,
  DList-NIP-permitted. A future graduation to a-tag handles will be bridged by a **pointer-typed
  b-tag**; this epic commits to that path but does not build it.
- **Docs-mode follow-up:** record the two-string convention in `protocols/drafts/tags.md` once
  shipped (spec docs are pre-NIP).

## Concepts (referenced, not re-defined)

- `39998:<TA>:tag` — the **shared tag vocabulary** (one list; both target types draw from it).
- `39998:<TA>:nostr-user-tag` — pubkey taggings (the USAGE source for the pubkey list).
- `39998:<TA>:nostr-event-tag` — event taggings (the USAGE source for the event list).

> TA pubkey resolved at runtime (`getOwnerAssistantPubkey` / `useConfig().taPubkey`) — never
> hardcoded (CLAUDE.md). Handles above use the local TA `82b75e47…973833` for reference only.
