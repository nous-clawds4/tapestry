# A suite's live tier FAILs, rather than skips, when the local stack serves a different branch than the working tree

**Id:** 2026-09-20-live-tier-fails-on-stale-stack
**Type:** meta
**Opened:** 2026-09-20 (book close `profile-lookup-bounds`, retro finding R4)
**Status:** OPEN
**Done:** —

The repo's live-tier convention is `if (!(await stackPresent())) return 'SKIP'` — a suite that needs
a running stack skips politely when there isn't one. `stackPresent()` asks whether the stack
**answers**. It cannot ask the question that actually matters: *is the stack running the code in this
working tree?*

On this machine the container bind-mounts the **main checkout**
(`/Users/clawds4/repos/nous-clawds4/tapestry → /usr/local/lib/node_modules/brainstorm`; see
`2026-09-20-claude-md-overstates-bind-mount`). A session working in a `.claude/worktrees/*` worktree
therefore has a stack that is present, healthy, and serving **someone else's branch**. Every live
assertion then describes code the session did not write — and the failure is a hard FAIL, because
`stackPresent()` returned true.

**Measured on this book.** `test/profile-lookup-bounds.test.js` E2 asserts the over-cap refusal
carries `limit`/`received`/`hint`. Against the deployed branch it passes:

```
$ TAPESTRY_BASE=https://staging.brainstorm.world node -e "require('./test/profile-lookup-bounds.test.js').run()…"
profile-lookup-bounds: 27 passed, 0 failed, 0 skipped
```

Against the default `localhost:7778` it does not, and cannot:

```
profile-lookup-bounds: 26 passed, 1 failed  — E2 (live, AC5)
$ docker exec tapestry grep -c MAX_PUBKEYS_PER_REQUEST …/src/api/profiles/fetchProfiles.js
0
```

The constant this book added is simply not in the container. So the full gate run at this book's
close — `20260920T220348Z-88393-a712`, 210/210 suites, FAIL, 3351 passed / 77 failed — lists
`profile-lookup-bounds` among its 33 failing suites, on the strength of one test that is correct and
passing everywhere the code actually runs.

**Why it is worth a row:** it is the "FAILs where it should SKIP" class, but arriving through a new
door. The existing deferred grouping (`OPEN.md` #192/#194/#27/#204/#205, "the local test gate lies")
is about suites failing on *absent* state — an empty graph, an unreachable Meilisearch. This is a
suite failing on *stale* state, which is worse in one specific way: absent state is obvious once you
look, while a healthy stack serving last week's code looks exactly like a healthy stack. A session
that trusts a red suite here goes hunting for a bug in a correct diff — and one that trusts a *green*
live tier in a worktree has verified nothing at all.

**Fix shape**, cheapest first:

1. **Say it where it bites.** A live-tier helper comment, and a line in the cycle-local skill: from a
   worktree, `localhost:7778` is not your code — point `TAPESTRY_BASE` at a deployment that carries
   it, or deploy first.
2. **Make the guard honest.** `stackPresent()` could take an optional freshness probe — a cheap
   assertion that the served build carries a marker from this tree — and return `'SKIP'` with a
   reason when it does not. The reason string matters more than the skip: "stack is serving another
   branch" is actionable, a bare SKIP is not.
3. Note the tension with `2026-09-20-smoke-tier3-cannot-verify-a-negative`: a guard that skips
   whenever the new contract is missing would skip exactly when a genuine regression appears. The
   probe must key on *build identity*, not on the feature under test.

**Pointer:** `test/profile-lookup-bounds.test.js` (`stackPresent`, E1–E3);
`.claude/skills/cycle-local/SKILL.md`; related: `2026-09-20-claude-md-overstates-bind-mount`,
`2026-09-20-smoke-tier3-cannot-verify-a-negative`, `OPEN.md` #192/#194/#27/#204/#205; audit
`engineering-team/audits/profile-lookup-bounds/audit.md` §7 R4.
