# The book-gate recipe in test plans uses relative requires, which break when the script is saved outside the repo

**Id:** 2026-09-22-gate-recipe-relative-require
**Type:** meta
**Opened:** 2026-09-22 (assistant-identification-tags #1, review § Harness friction 3)
**Status:** OPEN
**Done:** —

**What was seen.** The gate recipe that test plans carry (from `stories/done/assistant-management/1-…test-plan.md`
§ How to run, copied into this book's plan) does `require('./test/helpers/gateRunner')` and
`require('./test/registry')`. Fed to `node -` from the repo root it works; saved to a scratchpad file and run
from there, the relative requires resolve against the script's directory and the launch aborts. It cost the
Reviewer one aborted gate launch on 2026-09-22.

**Fix shape.** The recipe requires by absolute path from the repo root
(`require(require('path').join(process.cwd(), 'test/helpers/gateRunner'))`), or says "pipe this into `node -`
from the repo root; do not save it elsewhere". Better: a small `scripts/gate-for.sh <label> <pattern>` that
owns the computation, so plans cite one command instead of copying twenty lines.

**Second gap (2026-09-22, assistant-identification-tags #2, review § Harness friction 2).** The recipe exists only
as prose in each plan plus scratchpad copies. Story 2's plan describes a further step — drop the registry's
`excluded` suites, which a widened pattern (`Tag\.jsx`) pulls in and which make the launcher exit 2 — that lives in
no committed file, so each role re-derives it and a sibling session's copy was already gone. The `scripts/gate-for.sh
<label> <pattern>` shape above would close both gaps at once.

**Pointer:** review `engineering-team/reviews/assistant-identification-tags/1-the-one-answer-and-the-hubs-first-real-mark.md`
§ Harness friction 3; the plan's § How to run.
