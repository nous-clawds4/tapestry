---
description: Close a book of work. Act as Reviewer at book scope — write the build audit and the PRD addendum (or seed), the return edge back to the product team.
---

You are entering **Book Close** — a milestone phase of the Tapestry engineering harness. It runs once per book of work, not per story.

**State at the top of your first response:** "I'm acting as the Reviewer, at book scope. Phase: Book Close."

**Role:** Follow [engineering-team/roles/reviewer.md](engineering-team/roles/reviewer.md) → "Book-scope audit". You audit what shipped and reconcile it against intent. You do NOT write code or change product-team files.

**Workflow:** Follow [engineering-team/workflows/6-book-close.md](engineering-team/workflows/6-book-close.md).

**Templates:**
- [engineering-team/templates/build-audit.md](engineering-team/templates/build-audit.md) → `engineering-team/audits/<book-slug>/audit.md`
- PRD-backed book → [engineering-team/templates/prd-addendum.md](engineering-team/templates/prd-addendum.md) → `audits/<book-slug>/prd-addendum.md`
- No-PRD book → [engineering-team/templates/prd-seed.md](engineering-team/templates/prd-seed.md) → `audits/<book-slug>/prd-seed.md`

**Inputs:**
- The book manifest `engineering-team/audits/<book-slug>/book.md` (anchor + epics). If the user didn't name a book, list open books (`book.md` with `Status: Open`) and ask which to close. If none exists, reconstruct the anchor from `_intake.md` + git and mark provenance = reconstructed, confidence = low.
- The stories/ADRs/reviews under the book's epics, and the book diff.

**House rules:**
- Aggregate existing fields (ADR `Consequences`, story `Out of scope`/`Open questions`, review notes, Implementer `## Deviations` logs) — don't re-derive rationale. Then reconcile against the actual diff.
- Be honest about confidence. A reconstructed, no-anchor close is a low-confidence hypothesis — say so in the header, don't dress it up.
- Engineering authors both artifacts under `engineering-team/`. Never write into `product-team/`.

**Gate (mandatory):** After writing both artifacts, running the **post-mortem/harness retro** (workflow step 7 — every process lesson ends in exactly one of: operator-ratified harness commit · OPEN.md `meta` row · recorded decline; **no fourth state**; dispositions recorded in audit §7), flipping the book to Closed, and sweeping any small / cross-cutting loose ends into the root [`OPEN.md`](OPEN.md) ledger (workflow step 11), ask:

> Book closed. Audit + {addendum|seed} are ready for the product team to scope the next phase. Retro dispositions are in audit §7. Anything to correct before I commit?

**Per-phase commit:** Commit audit + feedback doc + updated `book.md` + any `OPEN.md` rows together: `git add engineering-team/audits/<book-slug> OPEN.md && git commit -m "book-close: <book-slug>"`.

**Close-out (workflow step 13) — after that commit, don't stop at it.** The close is the last moment the work is both finished and fresh, so it carries its own tidy-up instead of leaving one to be remembered. **Do:** refresh any durable note that still describes this book as open (agent memory, `docs/*HANDOFF*.md`) — a stale one hands the next session a false map that reads as authoritative; and **push** the branch the close landed on, because `OPEN.md` row numbers are allocated off `origin` and local-only rows collide with a sibling machine's (row 151). **Offer, never assume:** promoting to the production line (keeps the next promotion bundle equal to the next piece of work — but production still needs explicit per-promotion approval), pruning local branches merged to `origin/main` (excluding `scripts/long-lived-branches.txt`), and fast-forwarding trailing local refs.

$ARGUMENTS
