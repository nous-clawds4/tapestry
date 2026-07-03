# Phase 6: Book Close (milestone — not a per-story phase)

## Role
Reviewer, operating at **book scope**. See `engineering-team/roles/reviewer.md` → "Book-scope audit".

## Cadence
This phase does **not** run per story or per epic. It runs once, when a **book of work** completes — a PRD (or one roadmap phase of a PRD), or, with no PRD, the ask captured in the book's acceptance frame. The per-story cycle (Phases 1–5) is orthogonal and keeps running underneath.

## Trigger
Human-ratified. Engineering **offers** to close; the human's "yes" is the invocation. See `workflows/5-review.md` → "Completion detection" for how the offer fires at the review boundary, and `CLAUDE.md` → "Intent Detection" for the natural-language completion triggers. `/close-book` is the explicit override.

## Input
- The book manifest `engineering-team/audits/<book-slug>/book.md` (anchor + epic set). If none exists, reconstruct one first (see Provenance in step 1).
- The anchor: the PRD §sections, or the acceptance frame.
- All stories / ADRs / reviews under the book's epics, plus their incremental `## Deviations` logs.
- The book diff: `git diff <base>..<head>` across the book's epics.
- **For the post-mortem (step 7):** the book's `journal.md` (Direction-mode books), the "Harness friction" sections of the book's reviews, and the book's OPEN.md `meta` rows.

## Output
Two artifacts under `engineering-team/audits/<book-slug>/`:
1. `audit.md` — the **Build Audit** (as-built record), using `templates/build-audit.md`.
2. `prd-addendum.md` **or** `prd-seed.md` — the product feedback, using the matching template:
   - **PRD-backed** → addendum (deltas onto the existing PRD).
   - **No PRD** → seed (reconstructed baseline in PRD shape).

Both are **engineering-authored and live under `engineering-team/`.** The product team *reads* them to scope the next phase — engineering never writes into `product-team/`. This mirrors the forward handoff, where engineering reads the product team's `stories-queue.md`.

## Steps
1. **Resolve the anchor & provenance.** Read `book.md`; set the mode (PRD-backed / acceptance-frame / reconstructed) and confidence. No manifest *and* no PRD → reconstruct intent from `_intake.md` + git history, mode = reconstructed, confidence = low — and say so loudly in the audit header.
2. **Roll up the per-story record.** Aggregate, don't re-derive: ADR `Consequences`/`Out of scope`, story `Out of scope`/`Open questions`, review verdicts, and Implementer `## Deviations` logs across the book's epics.
3. **Walk the diff.** Confirm what actually shipped. Flag anything in the diff with no story/ADR provenance — that's undocumented work, a finding in its own right.
4. **Build the deviation log.** For each gap between anchor and as-built: Specified / Built / Type / Rationale (sourced) / Product impact / Carry-forward.
5. **Write the Build Audit** (`audit.md`).
6. **Write the feedback doc** (addendum or seed) — promote deviations and the carry-forward register into product-facing framing. Recommendations are *input*, not decisions.
7. **Post-mortem / harness retro.** *(This is "the post-mortem" the Director role routes proposed amendments to.)* Harvest every process note, harness-friction line, and proposed amendment from the step-7 inputs (journal.md, review "Harness friction" sections, the book's `meta` rows) plus the Implementer `## Deviations` entries that are process- rather than product-shaped. For **each** finding, record in the audit's §7 table exactly one terminal state — **operator-ratified harness commit (SHA) · OPEN.md `meta` row (#) · declined (reason)** — **no fourth state**: a lesson with no recorded disposition is a step-7 failure, not an option. Ask per finding: *does this port to the other flow (Direction ↔ human-gated)?* Cite `scripts/harness-stats.sh` output when available, so the retro runs on measurement rather than anecdote. Ratification is the operator's; this step only forces the decision to happen.
8. **Run the gate** at close: `npm test`; record the result in the audit.
9. **Flip the book to Closed.** Set `**Status:** Closed`, fill the close-artifact links and confidence in `book.md`.
10. **Sweep loose ends to `OPEN.md`.** Any small / cross-cutting follow-up this book leaves that has no other home — a one-off cleanup, a "does BIBLE need a note?" decision, a branch to delete — gets a row in the root [`OPEN.md`](../../OPEN.md) ledger so it isn't lost. (Larger deferred scope already lives in the audit's §6 carry-forward; link it, don't duplicate it. Harness lessons were already dispositioned in step 7 — don't re-sweep them here.)
11. **Gate:** "Book closed. Audit + {addendum|seed} written to `audits/<book-slug>/`. Retro dispositions recorded in audit §7. Ready for the product team to scope the next phase. Anything to correct?"

## Per-phase commit
Commit the audit, feedback doc, updated `book.md`, and any `OPEN.md` ledger rows together: `git add engineering-team/audits/<book-slug> OPEN.md && git commit -m "book-close: <book-slug>"`.

## Book retirement
Like epics, a closed book's folder moves under `audits/done/<book-slug>/` once the next phase has ingested it (one `git mv` on the directory). Everything outside `done/` is live; everything under it is shipped and read-only by convention.

## The return edge — closing the loop
This phase is the return edge that turns the one-way product→engineering pipeline into an iterative loop:

```
product PRD ─▶ eng epics/stories ─▶ build ─▶ /close-book ─▶ audit.md + prd-addendum.md
     ▲                                                              │
     └──────────  product /discover (next phase) ◀─────────────────┘
                  opens grounded: "here's what shipped, here's where it
                  drifted from plan and why, here's the carry-forward"
```

With no PRD, the seed *bootstraps* the product side: the product team adopts it as the baseline for `/discover` instead of starting cold.
