# PRD Seed: Harness Gate-Integrity & Lint Robustness

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/harness-gate-integrity/audit.md`
**Anchor:** acceptance frame in `book.md`
**Confidence:** high *(for the as-built facts; see §7 for the one product-shaped question)*
**Date:** 2026-07-25

> Reverse-engineered baseline in PRD shape. **Caveat up front:** this book is **internal engineering infrastructure** — the harness's own self-checking machinery — with **no end-user product surface**. There is little for a product team to scope here; the seed exists to close the return edge honestly and to surface the one place where a product-adjacent decision could eventually arise. Sections are tagged `[FROM FRAME]` / `[INFERRED]` / `[UNKNOWN — product input needed]`.

## 1. Product vision
`[FROM FRAME]` The harness's aggregate test gate must actually gate: a green `npm test`/CI run should genuinely mean every registered suite passed. Before this book, a stray `;` orphaned 9 suites from the exit code, and the per-suite summary could print SKIP over a real failure — so "green" could hide a regression. `[INFERRED]` The audience is **engineers and Direction/CI runs**, not end users. The "opportunity" is trust in the harness itself — a precondition for every feature that ships through it.

## 2. Personas
`[INFERRED]` — no end-user personas. The beneficiaries are internal roles: the **Implementer/Tester/Reviewer** (whose suites now actually gate), the **Director** (whose Direction-mode gates depend on a truthful `npm test`), and **CI** (the stack-free job).

## 3. Scope (as-built)
`[FROM FRAME]` Five defects fixed, each with a regression test that would have caught it: (1) re-attach the severed `overallOk` gate so all 142 suites gate; (2) make the class self-detecting (a future un-wired suite fails the harness); (3) stop summary lines masking FAIL as SKIP; (4) enforce ADR `## Consequences` (the close-book debt-harvest source); (5) guard the `check_L8` bash-3.2 empty-array crash. **Out of scope (as-built):** the `totalSkipped` skip-accounting drift; historical-ADR (`done/`) coverage; flipping any CI check to "required"; `contextScopedPins` (feat/tags-only).

## 4. Domain model
`[INFERRED]` None. No concepts, handles, schema, event kinds, or stored shapes — the change lives entirely in `test/test.js`, `scripts/harness-lint.sh`, and three test suites. Firmware reinstall: no.

## 5. Design rules (as-built)
`[INFERRED]` Harness-internal conventions reinforced, not user-facing design: (a) every `await <suite>.run()` result must appear in the `overallOk` expression (now self-asserted); (b) per-suite summaries use the guarded ternary `(pass+fail)===0 && skipped ? SKIP : …`; (c) active ADRs carry `## Consequences`; (d) `harness-lint` invariants skip the retired `done/` tree; (e) new harness-lint invariants are fail-tier via `violation()`, registered in the run block + catalog, and any def-path commit carries a CHANGELOG row.

## 6. Carry-forward & open questions
Promoted from audit §6 — all engineering-internal:
- G7 single-line bad-form hardening (optional; OPEN.md #100).
- `totalSkipped` skip-accounting drift (informational).
- Book/epic `done/` retirement after ingestion.
- Ship to staging (harness-infra cadence).

## 7. What product must validate
- [ ] **`[UNKNOWN — product input needed]` (low priority):** essentially nothing here is product-facing. The *only* product-adjacent question is whether harness/CI **reliability** should ever surface to end users (e.g. a public "build health" signal). There is no current demand for this and no surface was built; it is noted solely so the return edge is complete. Default recommendation: **no product action** — this book is done as internal infrastructure.
