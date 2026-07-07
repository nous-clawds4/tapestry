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
1. **type-hints-and-applicability-lists** — ✅ **DONE** (live). Emits the two additive z-hints on
   newly-created tag-elements (pubkey-flow / event-flow) and derives + publishes the two
   **HINT ∪ USAGE** Trusted Lists ("Tags for Nostr Pubkeys" / "Tags for Nostr Events"), TA-signed.
   Kind **30394** (addressable-member TL per `protocols/drafts/trusted-lists.md`; shipped on 30393,
   migrated 2026-07-06 with the legacy lists retracted in place). *(steps 1+2)*
2. **type-aware-picker-and-scheduled-regen** — ✅ **DONE** (live). The pickers are type-aware with
   **scoped search + a same-slug "Show other results" cross-context escape + usage-context hints**
   (reshaped 2026-07-06 to David's direction; the picker computes HINT ∪ USAGE live via
   `/api/tags/applicability`, viewer-inclusive — the published TLs serve external consumers). *(steps 3+4)*
3. **same-slug-cross-type-warning** — 🚫 **SUPERSEDED — folded into #2** (2026-07-06): the picker's
   same-slug "Show other results" escape *is* the anti-fork affordance; no standalone create-time
   warning ships.
4. **event-driven-applicability-republish** — ✅ **DONE** (PASS 2026-07-06). Diff-guard (republish only
   on membership change) + debounced, user-authed `notify-applicability` trigger fired best-effort from
   the tagging hooks + a disabled-by-default hourly backstop seed — keeps the *published* lists fresh
   for external consumers without a busy timer.

**Dependency order:** #1 → #2 (the picker consumes #1's derivation); #4 builds on #1's publisher.

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
