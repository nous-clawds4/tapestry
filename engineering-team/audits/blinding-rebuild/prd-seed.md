# PRD Seed: Direction-mode gate integrity (blinding by construction)

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/blinding-rebuild/audit.md`
**Anchor:** acceptance frame in `book.md` (operator-ratified direction, 2026-07-28)
**Confidence:** high
**Date:** 2026-08-04

> Harness infrastructure, no product surface. This seed exists to satisfy the return edge; its practical content is one recommendation.

## 1. Product vision
`[FROM FRAME]` The operator can trust an autonomous run's gate verdicts because no judge can see schedule, progress, or prior-verdict signals — the blinding holds by construction of the inputs, not by instruction. `[INFERRED]` The audience is the operator of Direction-mode books and every future session that reads the run record.

## 2. Personas
`[INFERRED]` The operator (arms/ratifies books, reads retros); the Director (spawns judges/roles); blinded judges and phase roles (consume pinned inputs). No end-user persona — nothing here reaches the product.

## 3. Scope (as-built)
`[FROM FRAME]` Pinned epic-status extraction at Gate 1; journal-only verdict outcomes; outcome-free journal-commit subjects; L14 artifact hygiene + template guidance; #133 pinned reads ratified and extended to field extractions; role-input scoping; review files free of completion arithmetic; harness-stats (b2) journal tallies.

## 4. Domain model
`[INFERRED]` None — no concepts, events, or stored shapes touched. The "domain" is the harness's own artifact graph (books, journals, stories, ADRs, reviews, epics).

## 5. Design rules (as-built)
`[FROM FRAME]` Gate history lives only where no rubric requires a judge to read. `[INFERRED]` Partial reads are pinned commands, never instructions; mention (backticked) vs use (bare) is the hygiene boundary; instruments always exit 0.

## 6. Carry-forward & open questions
Promoted from audit §6: legacy-ADR glob extension (optional); Option B escalation trigger; the gate-run doc-rule ratification batch; staging ship; book retirement post-ingestion.

## 7. What product must validate
- [ ] Nothing — **recommendation: no product action** (the harness-gate-integrity #1 precedent). This book is internal harness infrastructure; the product team may note that Direction-mode retros now carry measured gate tallies when reading future audits.
