# Nothing in the implement-feature command says Phase-4 test corrections go in their own test commit

**Id:** 2026-10-09-phase4-test-fixes-own-commit
**Type:** meta
**Opened:** 2026-10-09 (book `assistant-outbox-relays`, stories 1 and 3 review round 1)
**Status:** OPEN
**Done:** —

During Phase 4 of `assistant-outbox-relays`, the Implementer corrected four test defects (a route sentinel blinded by
`codeOnly()`, two over-broad sibling guards, two hub-count pins) inside the `impl:` commit. The review judged each
correction right, but `workflows/4-implementation.md` and `templates/adr.md` want test edits kept out of Phase 4, and
`.claude/commands/implement-feature.md` does not restate that a correction found while implementing goes to the Tester's
lane in its own `test:` commit. Proposed: one line in the command file. A related trap: `codeOnly()` helpers in several
suites read a `/*` inside a string (for example `'/api/settings/*'` in `src/api/index.js`) as the start of a block
comment.

**Pointer:** `engineering-team/reviews/assistant-outbox-relays/1-the-outbox-check-and-the-hubs-outbox-relays-card.md` § Findings
