# A human-gated book leaves no durable record that the operator approved a gate

**Id:** 2026-09-20-human-gated-approvals-leave-no-record
**Type:** meta
**Opened:** 2026-09-20 (`ledger-row-identity` book close, retro finding R2)
**Status:** OPEN
**Done:** —

**In human-gated mode the approvals that move a story from phase to phase are asserted by the session
that received them and recorded nowhere a Reviewer can check.** The review of story
`ledger-row-identity` #1 says so twice. Under "Not verified" it lists "the operator's approvals at the
Test Design and Implementation gates" ("asserted by the orchestrating session and the `64f2d787` commit
message; nothing in the repo records them"), and its post-verdict check lists "that the operator
approved pushing the branch and opening the PR" the same way. The review of story #2 does not raise it;
it takes the Planning gate's outcomes from the story's own prose.

What the repo does hold for that book, read at its close on 2026-09-20:

| Gate | Where an approval is written down |
|---|---|
| Planning | story prose — both stories' "Open questions" say "ratified by the operator at the Planning gate on 2026-09-19"; `book.md` says the operator confirmed the frame |
| Architecture | one sentence in the ADR's Decision ("the operator chose C at the Architecture gate") |
| Test Design | the two `test:` commit messages (`64f2d787`, `5a963767`) and one line in story #1's Deviations |
| Implementation | nothing — neither `impl:` commit message (`8e624eb5`, `d37354e6`) mentions one |
| Review, push, PR, merge | nothing in the repo |

Every entry is a sentence a session chose to write; none has a fixed place or shape, so none can be
found by a command, and the last two gates have no entry at all. A Direction-mode book has
`journal.md`, whose Decision lines `scripts/harness-stats.sh` counts. A human-gated book has no
counterpart, and `harness-lint` L14 (rightly) keeps verdict vocabulary out of stories, ADRs and epics,
so those files cannot become the journal.

Fix shapes, cheapest first:

1. Say in `workflows/5-review.md` that in human-gated mode the operator's presence is the record, so a
   Reviewer stops listing approvals as unverified. Changes nothing else.
2. A trailer in each phase commit (`Gate: <phase> approved by the operator, <UTC date>`): greppable and
   free, though still the session's assertion.
3. A `## Gates` log in `book.md`, one line per gate (UTC date, story, phase, the commit it released),
   written when the approval is given. L14 scans `stories/`, `decisions/` and `epics/`, not `audits/`,
   so the path is open to it; check the wording against L14's two shapes before adopting it.

Does it port to the other flow? No: Direction mode already has the journal. This is its human-gated
mirror.

**Pointer:** the `ledger-row-identity` book's audit, §7 (R2); the review of story `ledger-row-identity` #1, § "Not verified" and § "Not verified in this check"; `scripts/harness-lint.sh` `check_L14`; `engineering-team/roles/director.md` (the journal).
