# Test Plan: Story 6 — enforcement

**Story:** `engineering-team/stories/harness-self-improvement/6-enforcement.md`
**ADR:** `engineering-team/decisions/harness-self-improvement/0006-enforcement.md`
**Date:** 2026-07-04

## Coverage map

| Criterion | Test name | Test file | Level |
|---|---|---|---|
| AC-1 settings.json exists, valid JSON, SessionStart → the digest script | `.claude/settings.json is valid JSON whose SessionStart hook invokes scripts/session-start.sh` | `test/session-start.test.js` | integration |
| AC-2 script contract: lint + meta + stack lines, `/whats-open` pointer, exit 0 | `scripts/session-start.sh exists and is executable` + `the digest in this repo: exits 0 and carries the lint, meta, and stack lines` | 〃 | repo-integration |
| AC-2 always-exit-0 (never bricks) | `the digest never bricks a session: exit 0 even in an empty, git-less directory` | 〃 | fixture-integration |
| AC-2 meta state = the SHARED lib's, cwd-derived (ADR Option A extraction) | `a firing meta inbox (3 open rows) surfaces the escalation banner in the digest` + `a quiet meta inbox (1 recent row) reports the count without the banner — even with no lint script in the repo` | 〃 | fixture-integration |
| AC-3 six writing agents: allow-scoped Write/Edit, **allow-only shape** (no ask/deny — the ADR's precedence-proof rule) | `the six writing product agents carry allow-list-only Write/Edit scoping (product-team + OPEN.md, no ask/deny)` | 〃 | static (frontmatter) |
| AC-4 advisory agents lose Bash (and have no Write) | `the pure-advisory agents have neither Bash nor Write in their tool lists` | 〃 | static (frontmatter) |
| AC-5 honesty rewording (3 claim sites; CLAUDE.md doesn't grow) | reviewer inspection: exact-claims check per site + `wc -l CLAUDE.md` = 191 | Review | reviewer-run |
| AC-6 suite integration + existing suites green | registration in `test/test.js` (require/banner/summary/conjunction) + full-run parity check | `test/test.js` | integration |
| AC-7 live hook firing (this session predates the hook) | **deferred post-merge**: next fresh session confirms "the session-start digest appeared"; recorded in the review (staging-smoke deferral pattern) | Review | deferred |
| AC-8 def-paths (+`.claude/settings.json`, `scripts/session-start.sh`) + CHANGELOG + lint clean | reviewer inspection + `harness-lint.sh` (L10 + the def-file self-listing property) | Review + lint | mixed |
| ADR: no-second-copy of the meta parser; whats-open behavior preserved | reviewer inspection (grep: `collect_meta()` exists once, in `scripts/lib/collect-meta.sh`, sourced by both consumers) + reviewer re-runs the story-4 quiet/firing whats-open paths post-extraction | Review | reviewer-run |

## Edge cases

- [x] **Fixture cwd vs lib resolution**: the meta fixtures prove the digest reports the *fixture's* OPEN.md state (cwd-derived) while sourcing the lib script-relative — the same `BASH_SOURCE` discipline story 5 pinned for the verdict awk. A digest that read this repo's OPEN.md from a fixture cwd would fail the quiet test (this repo's inbox is not size 1).
- [x] **Firing via count, not age** (3 rows ≥ threshold) — date-independent, so the assertion never rots. The quiet fixture's row is dated 2 days back (computed at test time) — age stays under the 30d trigger.
- [x] **No lint script in the fixture repo** — the quiet-fixture test doubles as the degraded-repo case: the digest must tolerate a repo without `scripts/harness-lint.sh` and still exit 0 (assertion is on the meta line + exit code, not lint wording).
- [x] **Empty git-less directory** — exit 0 (the hook must never brick a session, whatever the cwd).
- [x] **Allow-only shape enforced, not just presence**: the agent test asserts the four allow rules *and* the absence of `deny:`/`ask:` keys — a well-meaning future "tightening" that adds deny rules would reintroduce the precedence bet ADR 0006 exists to avoid, and fails the suite.
- [x] **Banner token, not sentence**: the firing assertion pins `META ESCALATION` (the banner's distinctive token) + the count, not the full escalation sentence — whats-open owns the wording; the digest reuses it.
- [ ] Stack probe present-vs-absent both ways — only one is reachable per environment (this remote session has no stack → "absent" path exercised live; the "present" path is format-pinned by the regex alternation and verified on a stack-bearing machine at review or post-merge).

## Test infrastructure

- Node built-in runner via `test/test.js` (registered per convention: require, banner+run, summary line, overallOk conjunction). Meta fixtures are git-inited temp dirs carrying only a minimal OPEN.md with `| n | meta | … | date | OPEN | | |` rows shaped exactly for `collect_meta`'s field positions (`$3 ~ /meta/ && $6 ~ /OPEN/`, date in `$5`). No stack, no network.
- Frontmatter checks are static string/regex assertions on the block between the first two `---` lines — no YAML parser dependency (JS-without-build house rule).

## How to run

```
npm test
```

Standalone: `node -e "require('./test/session-start.test.js').run().then(r=>process.exit(r.fail?1:0))"`

## Verification

The new tests fail with the current code. Confirmed 2026-07-04 at commit `c6448a61` (pre-implementation): all 8 fail — the four digest tests because neither `.claude/settings.json` nor `scripts/session-start.sh` exists (the feature itself), the two agent tests because the writing agents carry no `permissions` block and the advisory agents still list Bash. The neighbouring harness suites are untouched (lint 25/25, stats 8/8):

```
  ✗ .claude/settings.json is valid JSON whose SessionStart hook invokes scripts/session-start.sh
      .claude/settings.json does not exist
  ✗ scripts/session-start.sh exists and is executable
      scripts/session-start.sh does not exist
  … (spawn of the missing script: repo digest, empty dir, firing fixture, quiet fixture)
  ✗ the six writing product agents carry allow-list-only Write/Edit scoping (product-team + OPEN.md, no ask/deny)
      product-strategist: no permissions block
  ✗ the pure-advisory agents have neither Bash nor Write in their tool lists
      product-advisor: Bash must be removed
suite: 0 passed, 8 failed
lint: 25/25  stats: 8/8
```
