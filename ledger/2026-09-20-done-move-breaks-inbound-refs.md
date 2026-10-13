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

**Recurred 2026-10-12 (`assistant-coming-soon` #1, Gate B review, harness friction 5).** New inbound pointers name
`engineering-team/stories/assistant-coming-soon/…`: `ui/src/pages/assistant/actions.js`'s header,
`test/helpers/comingSoonFixtures.js`, and the two ADR lines added at Gate B (`assistant-identification-tags/0001`,
`assistant-duty-cards/0001`). They go stale when the epic's folders move under `done/` at close. Four neighbouring
pointers in the same `actions.js` header already miss.

**Pointer:** `engineering-team/workflows/6-book-close.md` step 9;
`engineering-team/audits/nip05-ssrf-guard/audit.md` §7.

**Outbound links too, 2026-10-13 (book close `duty-menus-and-self-maps`, audit §7 P20).** No live file had a
markdown link into this book's folders, but 35 backticked pointers in 19 live files named them: the epic (5), the
handoff (1) and 17 ledger rows (29), 12 of them OPEN. The close repointed 34 to the `done/` paths, as
`assistant-coming-soon`'s close (`04f4eba4`) did, and left the one inside a `git show <hash> --` command, where the
old path is right. The move also broke 18 markdown links *inside* the five moved story files, which resolved
before it: 10 are the Linked artifacts lines (`../../decisions/<epic>/…`,
`../../reviews/<epic>/…`), and 8 point out to `docs/`, `protocols/` and `book.md`. `workflows/5-review.md` § Epic
close-out says "the relative paths *inside* the folder (story ↔ test-plan ↔ ADR ↔ review) stay intact — no
link-rewriting needed". That holds within one folder, not across the stories, decisions and reviews folders, each
of which moves one level deeper. The close left them, since `done/` is read-only by convention. Fix shape 1's "assert
every `.md` pointer in the moved files resolves" would catch them, and the sentence in `5-review.md` needs correcting
either way. Does it port to the other flow? Yes: every epic close-out runs the same move.
