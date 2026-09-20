# A `###` block under a marked `_intake.md` entry is invisible, so retiring the parent erases the child

**Id:** 2026-09-20-intake-sub-entries-invisible-to-readers
**Type:** meta
**Opened:** 2026-09-20 (work packet `h-rollup-scanner`; first recorded 2026-09-13 in the ledger-closeout review, deliberately left unfiled for the operator)
**Status:** DONE
**Done:** 2026-09-20 (PR #706) — `/whats-open` warns, and `0-intake.md` carries the convention.

Both readers of `_intake.md` key on `## 20YY-…` headings only. A `### ` block nested inside an entry
is therefore not an entry: marking the parent resolved removes the child from every roll-up, with no
warning anywhere. The review of the 2026-09-13 ledger closeout hit one instance — an untriaged
security note filed a day after its parent, recovered only because a reviewer was reading the file by
hand — and recorded it as a judgement call for the operator rather than filing a row
(`reviews/harness-self-improvement/ledger-closeout-2026-09-13.md` § Harness friction, item 7).

Disposition taken with the operator on 2026-09-20: **do both** of the candidate fixes that review
offered. `scripts/whats-open.sh` now names any *retired* entry that still carries `### ` blocks,
listing those blocks; and `workflows/0-intake.md` states that a new concern gets its own `## ` entry
even when it surfaces inside an existing one, with the warning called what it is — a backstop, not
the convention. One entry qualifies today (`_intake.md:2017`, three blocks).

Pinned by `test/rollup-scanners.test.js` AC-10 and AC-11: a retired entry with `### ` blocks is
named with them; a clean retired entry, and an *open* entry with `### ` blocks, raise nothing.

**Pointer:** `scripts/lib/collect-intake.sh` (the `nested` column); `scripts/whats-open.sh` (the intake section); `engineering-team/workflows/0-intake.md` step 1.
