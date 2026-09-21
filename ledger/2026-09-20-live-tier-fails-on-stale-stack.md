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

---

**Update 2026-09-21 (avatar-menu account-section review) — a second door: the files are current,
the process is not.** The case above is a stack reading another tree. This one is not: the session
worked in the main checkout, which the container bind-mounts, so the branch's code is on disk inside
the container. But the Node process loaded its modules nine days earlier and has not restarted.

```
$ docker exec tapestry ps -eo lstart,args | grep '[c]ontrol-panel'
Sat Sep 12 17:37:30 2026 node /usr/local/lib/node_modules/brainstorm/bin/control-panel.js
$ git log --oneline --since='2026-09-12T17:37:30Z' HEAD -- src bin | wc -l   # by commit date: a lower bound
19
$ git log --oneline cde8b282..HEAD -- src bin | wc -l   # by ancestry from the boot commit row 289 names
20
$ curl -s -o /dev/null -w '%{http_code}' http://localhost:7778/api/assistant/roster
404        # yet the checkout registers the route: src/api/index.js:543
```

`scripts/dev-refresh.sh --ui` never restarts the backend (`DO_SERVER=0`, `:50`), and a UI-only change
is exactly when a session reaches for `--ui`. In the full gate run `20260921T041722Z-59978-66e1` (on
`3938a16f`), two suites are red for this reason alone: `author-scoped-inspection-roster` (the 404
above) and `profile-lookup-bounds` E2 — this row's own example, now reached from the main checkout.
`MAX_PUBKEYS_PER_REQUEST` is on disk, but it arrived on 2026-09-20 (`56ea6cf9`), after the process
started. The same drift voids the premise of `OPEN.md` row 289, whose local baseline rests on "the
control panel runs the checkout's code". That was true on 2026-09-13 and is not now, so some of that
row's fifteen suites may be stale-process failures rather than stale-state ones.

**Fix-shape addendum.** The build-identity probe in fix shape 2 has to cover the server process, not
only the served bundle. For example, the server could report the commit it booted from, or the probe
could compare the process start time with the newest `src/` or `bin/` commit. The cheapest interim
step is for `dev-refresh.sh --ui` to warn when the backend predates the newest `src/` or `bin/`
change. Restarting this instance does not need `--deps`: since the process started, root
`package.json` gained only the `gate:status` script (`072da83a`), `package-lock.json` is unchanged,
and every root dependency is already installed in the container. `scripts/dev-refresh.sh --server`
is enough.

**Follow-up 2026-09-21: restarted, then the gate compared suite by suite.** The backend restarted at
05:54:41Z (full `scripts/dev-refresh.sh`, checkout `aa4df2e3`), after which `/api/assistant/roster`
answered 200. The Node 22 full gate on that clean tree, `20260921T064337Z-21374-92e9`, was compared
with `20260921T044814Z-41349-9c0d` (on `78a09be5`, stale process): 17 → 14 red suites, 57 → 50
failed tests, 139 → 129 skipped.

- **Down to the restart.** Between the two commits, `src/` changed only in `src/api/assistant/`
  profile code, and none of these suites' test files changed.
  - `author-scoped-inspection-roster` went from 5 failures to 0. Its route and handler predate both
    runs (`src/api/index.js:543`), and the old process answered 404.
  - `profile-lookup-bounds` went green; its E2 is this row's own example.
  - `event-less-create-set` ran 10 live tests it had been skipping (11 → 1 skipped, all passing). Its
    live class skips unless the container serves `GET /api/normalize/node-primitives`, and the old
    process did not. That is a feature-keyed probe of the kind fix shape 3 cautions about. Here it
    turned stale code into skips, with an accurate note, rather than failures.
- **Not attributable.** `recognizable-published-ta-profile` also went green, but #724
  (assistant-profile #3, inside `aa4df2e3`) rewrote the H1–H3 assertions that had failed and the
  assistant-profile code they test.
- **Unchanged.** The other 14 red suites have identical pass, fail and skip counts in both runs, so
  none of them is a stale-process failure. That settles this update's "some of that row's fifteen
  suites may be stale-process failures": apart from the one suite above, none were. Row 289's
  per-suite triage, stale instance state or a real regression, still stands for all 14.
