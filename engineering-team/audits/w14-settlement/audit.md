# Build Audit: w14-settlement — Reach + the layer-selection rule

**Book:** `engineering-team/audits/w14-settlement/book.md`
**Date:** 2026-07-13
**Branch / commit range:** `778a00b0..76951354` (staging; PR #351)
**Provenance:** Acceptance-frame (eager — the frame is the 2026-07-13 `/discuss` ratification, written before the story)
**Confidence:** high

## 1. What shipped

- **Reach** — the third `b`-graph construct, defined once in Shared Concepts § Reach (any-type transitive closure from the author's own header; permission-shaped; publisher-side SHOULD, never a reader gate; observer's-view framing), with the three-construct split table and consistency edits in § Terminology / § Declared affiliation — `stories/w14-settlement/1-ratify-reach-and-layer-selection.md` (PR #351).
- **The layer-selection rule** — Stamping's write rule gains its optional tier (demand-selected intersections within the cap, drawn from reach; **ancestors never required**); the read contract completes (breadth-MUST-expand; the non-expanding-client floor as a defined outcome); § Open becomes "Layer selection (set × branch) — settled". Same story.
- **W14 → Resolved** (Resolution block, history preserved); inherit-from gains one appended cross-ref sentence with its `:53` paragraph byte-identical; two settled-question pointers un-staled (tapestry-concepts phrase, README row — the review kick-back).

## 2. Epics & stories rolled up

### Epic: `w14-settlement`
| Story | Delivered | Status | Review |
|---|---|---|---|
| #1 ratify-reach-and-layer-selection | § Reach + write-rule tier 3 + read contract + W14 flip + pointer fixes | Done | `reviews/w14-settlement/1-ratify-reach-and-layer-selection.md` (CHANGES_REQUESTED → PASS on re-review) |

## 3. As-built inventory

Docs-only; no runtime/UI/wire change; no concepts mutated; no firmware reinstall. Six spec-surface files changed: `shared-concepts.md` (+§ Reach), `stamping.md` (write rule item 3, read contract, settled section, Sources), `inherit-from.md` (+1 sentence), `worksheet.md` (W14 Resolved), `tapestry-concepts.md` + `protocols/README.md` (pointer accuracy). After this book, **no NIP in the corpus carries an open section**, and every `b`-graph reading has exactly one normative home: affiliation (Shared Concepts § Declared affiliation), deference closure (Inherit-From § Resolution), aggregation/clouds (Shared Concepts), reach (Shared Concepts § Reach), stamp selection (Stamping).

## 4. Deviations from intent

| # | Specified (anchor) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | Frame edit surface implied 4 files (ADR 0001 original plan) | 6 files — settling the question staled two live pointers the plan missed | constraint-discovered | Review Finding 1 → ADR 0001 Amendment rows 6–7 | None (accuracy fix) | — |
| 2 | ADR text "Every candidate stamp…" in the settled section | "Every possible stamp…" | interpretation (word-tightening) | AC4's literal no-"candidate" gate (Implementer, flagged; review assessed required) | None | — |

**Undocumented work:** none — re-review verified both fix commits touch exactly the enumerated surfaces; frame fidelity checked clause-by-clause with nothing dropped, weakened, strengthened, or invented.

## 5. Quality state at close

- **Test gate at close:** harness-lint clean; `npm test` stack-free green with the 11 stack-dependent suites failing environmentally (OPEN.md #27 — stale bind-mounted local stack; differential baseline established in the nip-reorg reviews; CI `stack-free` green on PR #351).
- **Known open issues:** none introduced.
- **Debt:** none new.

## 6. Carry-forward register

- [ ] **Implementation now unblocked by settled spec:** the resolver/reach walk, cloud stamping, and the cap/formula/cold-start tuning (deferred to implementation by ADR 0033; the write rule's tier 3 and § Reach now give the walk a normative target). From nip-reorg audit §6, unchanged: pins dual-`z` parity; target-typed tag definitions (W10); W1 identity; publication-ladder decisions.
- [ ] The interop-floor product question from the nip-reorg seed §7 is now **half-answered** (the floor is *defined*); remaining product half: which real clients must be assumed non-expanding.

## 7. Process findings (harness)

`scripts/harness-stats.sh` at retro: 479 phase commits · 90 reviews decided · kick-back 2% (churn 2 — this book's CR is one) · books open 2 / closed 11 · cycle-time median 0d.

| Finding | Source | Terminal state |
|---|---|---|
| The review-verdict awk known-edge fired in production use: a CHANGES_REQUESTED report parsed **PASS-final** (trailing "…becomes a PASS" + "## On PASS" heading), tripping L1 until the parent reworded two format lines — second occurrence of the documented edge class (first: tq-#22 waiver) | reviews/w14-settlement/1 round-1 file; harness-lint run 2026-07-13 | **OPEN.md row #28** (reviewer-template/lint guard candidate) |
| Settling an open question staled live surfaces that advertised it as open; the ADR's site enumeration missed them (caught by review; fixed via ADR Amendment + 2-line commit) | reviews/w14-settlement/1 Finding 1; ADR 0001 Amendment | **declined** (no harness edit): single occurrence; the grep-for-old-status check is now precedented in the review report and the amended-ADR pattern — revisit if it recurs |
