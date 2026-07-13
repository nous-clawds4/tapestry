# Story 4: Index & cross-reference sweep (epic close-out)

**Status:** Approved
**Created:** 2026-07-13
**Type:** Doc

## Background

S1–S3 built the new NIP organization and deliberately deferred every semantic re-pointer and polish item to one closing pass (handoff D8, [`docs/NIP_REORG_DESIGN_HANDOFF.md`](../../../docs/NIP_REORG_DESIGN_HANDOFF.md)), so the ratification stories stayed minimal. That deferred worklist is now fully enumerated: the worksheet still aims W11 at a pointer-section and W1 at pre-split homes; the downstream consumer specs don't yet cite Stamping; BIBLE §22 still holds the selector prose that Shared Concepts made normative (ADR 0001's scheduled duplication #2) and §23's heading carries the retired spec name; and three reviews routed six nits here. When this story lands, the handoff flips to ✅ SUPERSEDED and the book becomes closeable.

## User-facing description

As a reader navigating the protocol corpus (or a future session picking up this epic's trail), I want every cross-reference, index row, and pointer to reflect the landed four-NIP organization, so that nothing dangles, nothing is normative in two places, and the epic's paper trail closes cleanly.

## Acceptance criteria

- [ ] **AC1 — worksheet re-aims.** W11's "graduated →" pointer aims at the Stamping spec (its actual resolving home now); W1's refs name Shared Concepts as the aggregation-policy home; W14's Refs line cites the current section title ("Open: which layers to stamp") instead of the retired one. W-entry *histories* otherwise unrewritten.
- [ ] **AC2 — downstream consumers cite Stamping.** Where `tags.md` and `communities.md` touch stamp-selection/dual-`z` territory, they reference the Stamping NIP rather than restating or omitting it — minimal cross-references at existing touchpoints only; no new sections invented, no wire-shape changes to either spec.
- [ ] **AC3 — BIBLE audits.** §22: the community-reference precedence selector keeps its implementation framing but gains a pointer naming Shared Concepts as the normative protocol home (resolving ADR 0001's transient duplication #2, per the §25/§26 precedent); §23's heading/display name updated to Class Thread Relationships; any other BIBLE pointer lines that name moved/renamed sections (e.g. references to tapestry-concepts § Multi-`z`) re-aimed. Glossary rows: pointer updates only where a row names a stale location — no vocabulary rewrites of historical definitions.
- [ ] **AC4 — spec polish nits (routed from reviews).** In `shared-concepts.md`: the illustrative `["b", …]` wire-shape example is replaced by a reference to inherit-from's wire-format section (staleness risk removed), and the "zero aggregation weight" statements carry the primitive's "(v1)" scoping. In `stamping.md`: the worked example's "branch handles" tightened to "cloud handles".
- [ ] **AC5 — epic paper trail closes.** `docs/NIP_REORG_DESIGN_HANDOFF.md` Status flips to **✅ SUPERSEDED** with a one-line pointer to the landed specs; the epic file's S4 marker flips to the story link (listed in this story's ADR explicitly, per S3's review note).
- [ ] **AC6 — gates and scope guard.** All links in changed files resolve; vocabulary policy holds in any touched living-spec text; historical records (ADRs, reviews, done stories) untouched; harness-lint clean; `npm test` stack-free green (the known 11-suite environmental caveat stands); no changes beyond the files the ADR enumerates.

## Concepts touched

None mutated (docs-mode).

## Out of scope

- Settling O1/W14 (its own `/discuss`); the correspondence-closure reconciliation flagged by S3's re-review (belongs to that same discussion).
- Republishing decentralized-lists to NostrHub (separate, author-keyed act per the README's publishing note).
- The pins dual-`z` implementation lag (eng-team story candidate, tracked in handoff O4).
- Closing the book — after this story ships, closing is offered separately (`/close-book`, user-ratified).

## Open questions

- None blocking. Exact edit sites are the Architect's enumeration (the BIBLE and consumer-spec touchpoints need line-level pinning).

## Linked artifacts

- ADR: (filled in after Architecture phase)
- Test plan: skipped — docs-mode
- Review: (filled in after Review phase)
