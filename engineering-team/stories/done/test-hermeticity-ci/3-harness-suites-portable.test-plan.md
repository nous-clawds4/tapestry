# Test Plan: Story 3 — The harness suites are portable

**Story:** `engineering-team/stories/test-hermeticity-ci/3-harness-suites-portable.md`
**ADR:** — (Architecture skipped per the ratified book plan; design records: OPEN.md row 19's BSD-fallback sketch, row 20's fix direction, ADR 0006 for the hook content)
**Date:** 2026-07-06

## Coverage map

Unusual posture, declared at Planning: **three of the failing tests already exist** — they are the story's red baseline, not new work. This plan catalogs them, adds three new reds, and one pre-green defusal.

| Criterion | Test | Status today (macOS) | Fails now because |
|---|---|---|---|
| AC-1 (hook ships) | *(existing)* `session-start` "settings.json is valid JSON whose SessionStart hook invokes scripts/session-start.sh" + **(new)** "settings.json is git-tracked and carries ONLY the SessionStart hook wiring" (keys ⊆ {hooks}+$schema, hooks = {SessionStart}, `git ls-files` tracked — guarded on `.git` existing so bare-archive runs stay green) | both RED (everywhere) | file absent; once present, tracked-ness fails until the gitignore un-ignore lands |
| AC-2 (def-path blind spot) | **(new)** `harness-lint` "L12: a def-path row naming a file that does not exist is a violation naming the path" (ghost-row fixture); real-repo cleanliness via the existing repo-lint test | RED (everywhere) | the lint silently drops nonexistent def paths (`harness-lint.sh:242`) |
| AC-3 (BSD date) | *(existing)* `harness-lint` L9 fixture test; *(existing)* `harness-stats` book-throughput test; **(new)** `session-start` "one meta row older than 30 days fires the escalation banner via the AGE trigger alone" (2020-01-01 fixture row, count=1, banner must carry a ≥3-digit age) | all three RED on macOS, GREEN on Linux | `date -d` fails on BSD: L9 early-returns (`harness-lint.sh:214`), durations print `?` (`harness-stats.sh:109–118`), ages stay `?` so `META_MAX_AGE` never rises (`collect-meta.sh:24–27, 37–39`) |
| AC-4 (deterministic timing) | **(defusal, pre-green)** `login-failure-and-tag-collapse` AC-1a/1b/1c rewritten: zero-budget immediacy; next-macrotask injection under a 4000ms ceiling; deadline honor via a far-too-late signer + a 5s legible-fail safety harness. **No `Date.now()` remains in the suite.** | GREEN 18/0 | nothing — this is flake-hazard removal; the contracts still bind (a regressed implementation fails each rewrite: budget-consuming immediacy, one-shot check, ignored deadline) |
| AC-5 (green everywhere) | Procedural, at Implementation + Review: story-2 dead-port full run exits 0 on this macOS box; plain-run failing set shrinks by exactly the three harness suites; story-1 bare-copy procedure re-run (settings.json must be IN the archive — tracked — and session-start green there) | — | the three harness reds above |

## Edge cases

- [x] **Age trigger alone** (count=1 < 3) — the existing banner tests only exercised the count trigger; the new test isolates the age trigger, which is the part that is dead on BSD.
- [x] **Bare-archive safety:** the tracked-ness assertion guards on `.git` existing, so the story-1 bare-copy procedure (no `.git`) still passes the suite.
- [x] **Linux non-regression:** the three date-dependent tests pass on Linux today and must keep passing — the fallback must not change GNU-path behavior. Verified at review by the fixture tests themselves (they run the same code path CI will).
- [x] **Ghost def-path fixture** keeps the clean-tree fixture green (all its listed paths exist), so L12 adds no fixture churn.
- [x] **AC-1c hang protection:** if a regression made waitForNostr ignore its deadline, the test fails legibly at 5s instead of hanging the suite; both timers are cleared in `finally` (no stray unhandled rejection).

## Test infrastructure

- All in existing suites, existing styles (spawnSync fixtures for lint/digest; dynamic-import behavioral tests for nip07). No new frameworks, no stack, no network.
- **Implementer notes carried from Planning:** the fix touches def paths (`.claude/settings.json`, `harness-lint.sh`, `harness-stats.sh`, `scripts/lib`) → the impl commit needs an `engineering-team/CHANGELOG.md` row (L10). L12 and the settings.json ship must land **together**, or the real-repo lint test goes red on def-paths row 29. The `.gitignore` un-ignore must follow the `.claude/*`-not-`.claude/` pattern documented at `.gitignore:106`.

## How to run

```
node -e "require('./test/session-start.test.js').run().then(r=>console.log(JSON.stringify(r)))"
node -e "require('./test/harness-lint.test.js').run().then(r=>console.log(JSON.stringify(r)))"
node -e "require('./test/harness-stats.test.js').run().then(r=>console.log(JSON.stringify(r)))"
node test/login-failure-and-tag-collapse.test.js
BRAINSTORM_BASE_URL=http://127.0.0.1:9 npm test; echo "exit: $?"   # AC-5: expect exit 0 post-impl on macOS
```

## Verification

Confirmed 2026-07-06 at commit `d3c0f9b5` on macOS (BSD date), all failures on substantive assertion messages:

```
session-start:              {"pass":7,"fail":3}   — existence (existing) + only-hooks/tracked (new) + age-trigger (new)
harness-lint:               {"pass":27,"fail":2}  — L9 fixture (existing, macOS) + L12 ghost def-path (new)
harness-stats:              {"pass":7,"fail":1}   — book-throughput (existing, macOS)
login-failure-and-tag-collapse: 18 passed, 0 failed — defusal is pre-green by design; zero Date.now() remains
```

Post-implementation expectations: all four suites fully green on macOS **and** Linux; dead-port full `npm test` exits 0 on this machine; bare-copy procedure shows session-start green with `.claude/settings.json` present in the archive.
