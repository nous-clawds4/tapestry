# ADR 0004: Close-out sweep — exact edit sites and pointer policy

**Status:** Accepted
**Date:** 2026-07-13
**Story:** `engineering-team/stories/nip-reorg/4-index-crossref-sweep.md`

## Context

S4 is pure enumeration: every deferred re-pointer, audit, and nit, resolved at line level against base `80e8ae47`. Survey results: worksheet re-aims at `worksheet.md:97-99` (W11 Status line), `:105` (W11 Refs), `:21` (W1 Refs), `:140` (W14 Refs); consumer touchpoints are each spec's existing "Relationship to other specs" section (`tags.md:26`, `communities.md:26`) — neither mentions stamping today, and tags.md's "carries a `z` tag" (singular) is stale against the deployed dual-`z`; BIBLE sites are the §22 "Resolution model" paragraph (~`:1523`), the §23 heading `:1545` + TOC row `:36` (anchor changes), and no `Multi-z` references exist in BIBLE; polish sites `shared-concepts.md:36` (wire example), `:39/:53/:82` (v1 scoping), `stamping.md:57`; paper-trail sites `docs/NIP_REORG_DESIGN_HANDOFF.md:3` and `epics/nip-reorg.md:17`. **No README edits remain** — S1/S2/S3 each maintained their rows in-story.

## Options considered

### Option A — one-commit enumerated sweep (chosen)
All sites in one implementation commit against the table below. Pros: one review, one diff, the epic closes in one PR. Cons: none at this size (~12 small hunks across 8 files).

### Option B — split BIBLE edits into a separate story
Rejected: the BIBLE items are two sentences and a heading; a fifth story is pure ceremony.

### Option C — also rewrite W1/W11 bodies into D2 vocabulary
Rejected: worksheet resolution records are history (AC1: "histories otherwise unrewritten"); W11's body keeps its 2026-06-13 "consensus signal" wording by design.

## Decision

**Option A**, with three judgment calls resolved:

1. **tags.md gets a one-sentence wire-accuracy fix, not just a citation.** `tags.md:26` changes from "each carries a `z` tag naming…" to "each carries one or more `z` stamps naming…, selected per [Stamping](./stamping.md)". This is a cross-reference at an existing touchpoint (AC2-compliant), and it un-stales the sentence against the deployed dual-`z` without touching the event-shape sections. No deployment history enters the spec (boundary rule).
2. **communities.md adds Stamping to its upstream-primitives list** (`:26`), with the containment/membership boundary named: containment items follow Stamping's selection; membership assertions keep their single applied-concept handle (Stamping § Boundary) — the mirror of the link Stamping already makes.
3. **BIBLE §22 gets one pointer sentence, not a rewrite.** Appended to the "Resolution model" paragraph: the protocol-facing statement of the selector — and the cloud/aggregation model consuming it — is normative in `protocols/drafts/shared-concepts.md`; §22 remains the implementation-and-history record (the §25/§26 precedent). The neighboring candidate-exit paragraph keeps its ADR-history character unedited; glossary rows `1486/1487` stay (they define implementation vocabulary and still correctly say "See §22").

## Consequences

- ADR 0001's duplication #2 closes; every scheduled obligation from ADRs 0001/0003 is then resolved.
- The BIBLE §23 anchor changes (`#23-class-thread-membership-tags-n-s` → `#23-class-thread-relationships-n-s`); the TOC is the only in-repo user of it (assert during implementation).
- The handoff flip makes the book completion-detectable; close is offered separately per house rules.
- **Firmware reinstall required?** No.

## Implementation notes

| # | File:site | Edit |
|---|---|---|
| 1 | `protocols/worksheet.md:97-99` (W11 Status) | "Graduated → [tapestry-concepts spec]" → "Graduated → [stamping spec](./drafts/stamping.md) (convention) + [shared-concepts spec](./drafts/shared-concepts.md) § Clouds (cloud model)" |
| 2 | `protocols/worksheet.md:105` (W11 Refs) | "(resolving home)" ref re-aimed the same way; tapestry-concepts kept as the pointer-trail mention |
| 3 | `protocols/worksheet.md:21` (W1 Refs) | Append: `[shared-concepts spec](./drafts/shared-concepts.md) (aggregation-policy home; § Cross-deployment identity states the trajectory)` |
| 4 | `protocols/worksheet.md:140` (W14 Refs) | § "Open: subset/ancestor stamping" → § "Open: which layers to stamp" |
| 5 | `protocols/drafts/tags.md:26` | Per Decision 1 |
| 6 | `protocols/drafts/communities.md:26` | Per Decision 2 |
| 7 | `BIBLE.md:36` + `:1545` | Heading → "## 23. Class Thread Relationships (`n`, `s`)"; TOC row text + anchor regenerated; assert the old anchor has exactly one referrer (the TOC) before editing |
| 8 | `BIBLE.md` §22 Resolution-model ¶ (~1523) | Append the Decision-3 pointer sentence |
| 9 | `protocols/drafts/shared-concepts.md:36` | Replace the fenced `["b",…]` example with prose + link to [Inherit-From](./inherit-from.md) § "The `b` tag" (format stated once) |
| 10 | `protocols/drafts/shared-concepts.md:39,53,82` | "(v1)" scoping on all three zero-weight statements |
| 11 | `protocols/drafts/stamping.md:57` | "branch handles" → "cloud handles" (worked example only; `:45`'s "branch handles" is correct two-axis inference vocabulary and stays) |
| 12 | `docs/NIP_REORG_DESIGN_HANDOFF.md:3` | Status → ✅ SUPERSEDED, one-line pointer to the three landed specs + note that open questions live on in W14/W1 |
| 13 | `engineering-team/epics/nip-reorg.md:17` | S4 marker → story link (ADR-listed per S3's review note) |

**Reviewer verification plan:** every table row applied and nothing else (`git diff` file set = exactly these 8 files); old BIBLE anchor grep = 0 after edit; all links in changed files resolve; W11/W1 body histories byte-identical outside the Refs/Status lines; vocabulary gate on touched living-spec sentences (historical "consensus" occurrences in worksheet resolution records untouched by design); `npm test` (known 11-suite caveat) + harness-lint; after this lands, grep the epic's scheduled-obligation trail (ADR 0001 #2, ADR 0003 consequence, six review nits) and confirm each is closed or explicitly out-of-scope (O1-related).

## Out of scope

Settling O1/W14; the correspondence-closure reconciliation; NostrHub republication; pins dual-`z`; book close.
