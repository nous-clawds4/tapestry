# Moving an epic's folders under `done/` at book close silently breaks every reference that points at them

**Id:** 2026-09-20-done-move-breaks-inbound-refs
**Type:** meta
**Opened:** 2026-09-20 (nip05-ssrf-guard book close, retro §7)
**Status:** OPEN
**Done:** —

`workflows/6-book-close.md` step 9 says to flip the epic to Done and `git mv` its story / ADR /
review folders under `done/`. It says nothing about the references that pointed at the old paths, so
every one of them dangles the moment the move lands.

**Measured, not assumed.** The `nip05-ssrf-guard` close broke 7 pointers in one move: the story, its
test plan, the review, three `ledger/` rows, and two source files (`src/utils/ssrfGuard.js:10`,
`test/nip05-ssrf-guard.test.js:5`, both of which carry a `Story:` header comment).

**It is systemic, not a slip.** `compute-endpoint-hardening` closed 2026-09-19 and still has three
references pointing at its pre-`done/` path — its own `audits/compute-endpoint-hardening/audit.md`,
`engineering-team/epics/compute-endpoint-hardening.md:19`, and
`test/harden-compute-endpoint.test.js:5` — and **zero** references pointing at where its story
actually lives. Whoever follows one of those gets a 404 and has to guess.

This close rewrote its own 7 rather than copying the precedent, which is why the count above is
exact. That fixes one book, not the rule.

**Fix shape, two candidates:**

1. **A step in the workflow** — after the `git mv`, rewrite inbound references
   (`git grep -l '<old path>'`) and assert every `.md` pointer in the moved files resolves. Cheap,
   but it is a manual step and manual steps are how the three stale `compute-endpoint-hardening`
   refs happened.
2. **A lint check (preferred)** — a rule that every `engineering-team/**` path mentioned in a
   tracked file exists. That catches this class *and* the sibling finding from the same retro (a
   citation copied out of `_intake.md` carrying a path that had gone stale years earlier), and it
   catches them on the next lint run rather than at the next reader.

Either way the existing stale refs under `compute-endpoint-hardening` want the same sweep; there may
be more from earlier closes.

**Pointer:** `engineering-team/workflows/6-book-close.md` step 9;
`engineering-team/audits/nip05-ssrf-guard/audit.md` §7.
