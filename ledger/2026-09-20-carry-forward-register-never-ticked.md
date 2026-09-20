# Nothing ever ticks a §6 carry-forward item, so `/whats-open` printed 359 mostly-stale ones

**Id:** 2026-09-20-carry-forward-register-never-ticked
**Type:** meta
**Opened:** 2026-09-20 (work packet `h-rollup-scanner`; story `rollup-scanner-fidelity` #1)
**Status:** DONE
**Done:** 2026-09-20 (PR #706) — the section is bounded and states its totals; `6-book-close.md` carries the tick rule.

`/whats-open`'s closed-book carry-forward section printed every unticked `- [ ]` in every closed
book's audit §6, capped at 10 per book and unbounded in book count. Measured 2026-09-20: **55 books,
359 items** (48 / 323 when the packet was triaged on 2026-09-13 — it grows). Nothing in any workflow
ever ticks an item when it is resolved somewhere else, so most of the register describes work that is
done, and the section is skimmed rather than read.

Disposition taken with the operator on 2026-09-20: scope the section and fix the cause.

- The section lists the `WHATS_OPEN_CARRY_BOOKS` (default 8) most recently closed books within
  `WHATS_OPEN_CARRY_DAYS` (default 90), both overridable, and states the true totals plus what each
  suppressor removed. A book whose close date cannot be read is listed, never suppressed.
- `workflows/6-book-close.md` step 5 now tells a closer to tick items resolved elsewhere — including
  items of *earlier* books that this book resolved — and says why.

One measurement is worth keeping: the recency window alone barely bites today. Of the 55 books, a
90-day window suppresses 8 (46 items), because the repo's whole book history is about three and a
half months old. The window is the durable mechanism and the book budget is what bounds the section
now; the tick rule is what makes it *true*. A close date is read from `**Closed:**` and, failing
that, from the `**Status:** Closed (<date>)` line — four books carry it only there.

**Pointer:** `scripts/whats-open.sh` (the carry-forward section); `engineering-team/workflows/6-book-close.md` step 5; ADR `rollup-scanner-fidelity/0001`.
