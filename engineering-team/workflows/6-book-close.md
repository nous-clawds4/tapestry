# Phase 6: Book Close (milestone — not a per-story phase)

## Role
Reviewer, operating at **book scope**. See `engineering-team/roles/reviewer.md` → "Book-scope audit".

## Cadence
This phase does **not** run per story or per epic. It runs once, when a **book of work** completes — a PRD (or one roadmap phase of a PRD), or, with no PRD, the ask captured in the book's acceptance frame. The per-story cycle (Phases 1–5) is orthogonal and keeps running underneath.

## Trigger
Human-ratified. Engineering **offers** to close; the human's "yes" is the invocation. See `workflows/5-review.md` → "Completion detection" for how the offer fires at the review boundary, and `CLAUDE.md` → "Intent Detection" for the natural-language completion triggers. `/close-book` is the explicit override. For a **Direction-mode** book the offer itself is gated: it is valid only with the final completion judge's APPROVE of the completion report in hand (`direct-feature` skill, Stage 3) — an offer made without that audit is void, the same class as approving over a KICK_BACK. *(Ratified 2026-07-28 — store-and-show postmortem, audit §7 P12 residual.)*

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
7. **Post-mortem / harness retro.** *(This is "the post-mortem" the Director role routes proposed amendments to.)* Harvest every process note, harness-friction line, and proposed amendment from the step-7 inputs (journal.md, review "Harness friction" sections, the book's `meta` rows) plus the Implementer `## Deviations` entries that are process- rather than product-shaped. For **each** finding, record in the audit's §7 table exactly one terminal state — **operator-ratified harness commit (SHA) · OPEN.md `meta` row (#) · declined (reason)** — **no fourth state**: a lesson with no recorded disposition is a step-7 failure, not an option. Ask per finding: *does this port to the other flow (Direction ↔ human-gated)?* Cite `scripts/harness-stats.sh` output (run it at retro time), so the retro runs on measurement rather than anecdote. Ratification is the operator's; this step only forces the decision to happen.
8. **Flip the book to Closed.** Set `**Status:** Closed`, fill the close-artifact links and confidence in `book.md`.
9. **Epic close-out — same breath as the close.** For every epic the book lists whose stories are all Done and whose branch has merged to the shared line, run the epic close-out (`workflows/5-review.md` → "Epic close-out"): flip the epic `**Status:** Done` and move its story/ADR/review folders under `done/` (per-file when the `done/<epic>/` folders already exist from an earlier close). `harness-lint` **L2** enforces the pairing — *a Closed book ⇒ every epic it lists is Done* — so a close that skips this step leaves the tree lint-red for every future session. An epic deliberately left Active (stories remaining, or the branch unmerged) is recorded in the audit with its reason instead. *(Ratified from OPEN.md #121, 2026-07-28 — fix (a); the `add-a-concept-to-a-tapestry` close proved the order manually.)*
10. **Run the gate over the final state:** `npm test`; record the result in the audit. The gate runs **after** the flip and the epic close-out so it certifies the tree the close actually leaves behind — in any other order L2 reports red on a correct close or green on an incomplete one.
11. **Sweep loose ends to `OPEN.md`.** Any small / cross-cutting follow-up this book leaves that has no other home — a one-off cleanup, a "does BIBLE need a note?" decision, a branch to delete — gets a row in the root [`OPEN.md`](../../OPEN.md) ledger so it isn't lost. (Larger deferred scope already lives in the audit's §6 carry-forward; link it, don't duplicate it. Harness lessons were already dispositioned in step 7 — don't re-sweep them here.)
12. **Gate:** "Book closed. Audit + {addendum|seed} written to `audits/<book-slug>/`. Retro dispositions recorded in audit §7. Ready for the product team to scope the next phase. Anything to correct?"
13. **Close-out — after the gate and the close commit.** A book close is the only moment when the work is provably finished *and* still fresh; at the next session's start you would be reconstructing it, and in a dedicated cleanup session you would be doing archaeology. So the close carries its own tidy-up rather than leaving one for the operator to remember. Steps 1–2 are **correctness** and are performed; steps 3–4 are **judgment** and are *offered*, never done unasked.
    1. **Refresh the durable notes.** Anything that carries into the next session and still describes this book as open — agent memory, a `docs/*HANDOFF*.md` — is now a *false map*, which is worse than no map because it reads as authoritative. The next session's first act is to trust it. Update it to what is true, including what the next work actually is.
    2. **Push the branch the close landed on.** Not tidiness — **correctness on a multi-machine checkout.** `OPEN.md` row numbers are allocated by reading the highest on `origin`, so rows that exist only locally are invisible to the other machine and it will mint the same numbers (OPEN.md row 151 — two independent `#148`s in one day, forcing a renumber inside a deploy-critical merge). The same applies to any surface a sibling session reads from `origin`.
    3. **Offer to promote** to the production line. Usually the close commit is docs-only and the deploy itself achieves nothing — the reason to do it is that a `main` left behind means the *next* promotion bundle carries this leftover plus the new work, and a bundle that isn't exactly "what I just built" is a bundle nobody reads carefully. **Offer; never merge to the production branch without explicit per-promotion approval** (see `/cycle-prod`) — this step must not become a way for that rule to be automated away.
    4. **Offer to prune** local branches already merged to the production line — `git branch --merged origin/main`. **Exclude everything in `scripts/long-lived-branches.txt`**: sandbox deploy targets and parked work live there and look identical to stale branches from the outside. Branch deletion is the one irreversible act in this list; list the exact names and delete only on an explicit yes.
    5. **Fast-forward the local refs** for branches that only trail (a local `main` 30-odd commits behind `origin/main` after a run of promotions is normal and harmless — but it makes `git log main` quietly lie to the next person who reads it).

    *Known limit:* this fires only at a book close. A session that ships stories without closing a book leaves the same unpushed state; `/whats-open`'s "Riding staging, not yet on main" and "Unmerged feature branches" sections are the (softer) surface for that case.

## Per-phase commit
Commit the audit, feedback doc, updated `book.md`, and any `OPEN.md` ledger rows together: `git add engineering-team/audits/<book-slug> OPEN.md && git commit -m "book-close: <book-slug>"`. The step-13 close-out follows this commit.

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
