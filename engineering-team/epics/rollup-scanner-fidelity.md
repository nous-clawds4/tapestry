# Epic: rollup-scanner-fidelity

**Created:** 2026-09-20
**Status:** Active
**Book:** `engineering-team/audits/rollup-scanner-fidelity/book.md`
**Provenance:** work packet `h-rollup-scanner` (operator's 2026-09-13 `/whats-open` triage);
`OPEN.md` rows 290 (second half) and 208; the `###`-nesting finding in
`engineering-team/reviews/harness-self-improvement/ledger-closeout-2026-09-13.md` § Harness
friction, item 7, which its author deliberately left unfiled for the operator to decide.

## Goal

Every session's first and last view of the repo — the session-start digest and `/whats-open` —
reports what the repo actually holds. A scanner that quietly drops an item is worse than no
scanner: it converts "nobody looked" into "we checked, and there was nothing there."

## Why it matters

Each defect here has already cost something measurable.

- A `PICKED UP` marker retires a whole entry, so `_intake.md:611` has read "**Part B still
  OPEN**" in its own marker line while being invisible to every roll-up since 2026-07-02 — 80
  days. The same class cost ~3 months of re-derivation on the `publishToRelays` diagnosis
  (row 208, row 200).
- A `###` block under a marked parent vanishes with its parent. One untriaged security note went
  that way in September and was recovered only because a reviewer was reading the file by hand.
- `collect-meta.sh` and `whats-open.sh` read the same file with two different regexes, and
  disagree about 6 of 33 entries. Only one of them was ever fixed (2026-09-13).
- The roll-up emits a line of invalid UTF-8 today (row 193 under the 150-byte trim), which is
  harmless to a terminal and fatal to a strict decoder — it surfaced when a reviewer's Python
  refused to read the roll-up.
- Open-book ages have never printed on anyone's Mac: `date -d` is GNU-only and `date` exits
  with `illegal option -- d`. Row 19 fixed exactly this in `collect-meta.sh` on 2026-07-06 and
  `whats-open.sh` was missed.

## Why a new epic

`harness-self-improvement` is `Done` under a Closed book, so reactivating it trips harness-lint
L2's reopen blind spot (rows 129, 322) and needs a run-scoped waiver, a CHANGELOG row, and a
removal at close. A new epic costs this file. Same choice as `honest-test-gate` (2026-09-12) and
`ledger-row-identity` (2026-09-19).

## Stories

`stories/rollup-scanner-fidelity/`:

1. **scanners-report-what-is-there** — the six defects above, fixed together behind
   fixture-driven tests. Bug.

## Out of scope (whole epic)

- Working through the backlog the scanners are hiding. Making it visible is this epic; disposing
  of it is not.
- `/whats-open`'s remaining reader gap — the ledger section reads row files only when `OPEN.md`
  exists (OPEN.md row `2026-09-20-rollup-reader-gap-and-stale-comment`). Same script, different
  defect, already filed and owned elsewhere.
- Any change to what `harness-lint` enforces.

## Related

- `OPEN.md` rows 290, 208, 19, 200; row `2026-09-20-rollup-reader-gap-and-stale-comment`.
- ADRs `harness-self-improvement/0004` and `0006` — the meta-escalation state and the digest.
- ADR `ledger-row-identity/0001` — the ledger's two homes, both read by these scanners.
