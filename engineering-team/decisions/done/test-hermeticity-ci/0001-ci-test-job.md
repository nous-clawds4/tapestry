# ADR 0001: The first CI test gate — one pull_request-triggered stack-free job

**Status:** Accepted
**Date:** 2026-07-06
**Story:** `engineering-team/stories/test-hermeticity-ci/4-ci-test-job.md`

## Context

Stories 1–3 made `npm test` (= `node test/test.js`, `package.json:13`) an honest stack-free gate: hermetic (story 1), whole-suite counted SKIPs for the 24 live suites (story 2), portable across GNU/BSD with the harness suites green everywhere (story 3). Nothing runs it automatically. All five files in `.github/workflows/` are `appleboy/ssh-action` deploys triggered by pushes to their long-lived branches (staging, main, three sandboxes) — no job runs any test (OPEN.md row 13(c), harness review R-E3).

Constraints, verified in this checkout:

- **Reviewer constraints (binding, book design constraints):** stack-free suites only — e2e/Playwright deferred; the gate surfaces flakes, never normalizes them (no retry, no rerun-on-red, no failing-set baselines; skips visible and counted).
- `package-lock.json` v3, in sync, registry.npmjs.org only, no `.npmrc`. Native deps (lmdb, msgpackr-extract, bufferutil, utf-8-validate, websocket) ship linux-x64 prebuilds pinned in the lockfile — their **install scripts must run** (a global `--ignore-scripts` breaks the prebuild downloads). One wart: `@scarf/scarf` 1.4.0's postinstall phones home — suppressed by `SCARF_ANALYTICS=false`.
- Node: `engines >=18` (`package.json:90-92`), no `.nvmrc`; the production Dockerfile installs nodesource **22.x** — prod parity favors 22.
- `playwright.config.js:17` sets `retries: process.env.CI ? 2 : 0` — a retry mechanism that must stay **out of this gate's path** (the job must never invoke `npm run test:playwright`).
- Branch protection: main requires PRs with **zero** required checks; staging permits direct pushes. So this check is advisory-by-default everywhere; making it *required* is an explicit ruleset change the story reserves for the operator post-book.
- `harness-lint.sh` L9 (freshness) and L10 (changelog-touch) consult `git log`; on a shallow clone both **skip silently**, so a shallow-checkout CI would quietly disable two harness self-checks inside the harness-lint suite's real-repo pass. Full history is cheap here: pack size 17.69 MiB.
- The deploy workflows fire on **push** (post-merge); a **pull_request**-triggered job runs pre-merge and cannot race or delay them.
- No concepts touched — no handles to resolve; the stack's absence on the runner is the point.

## Options considered

### Option A — one `pull_request`-triggered workflow running plain `npm test` (chosen)
`.github/workflows/test.yml`: `on: pull_request: branches: [staging, main]`; ubuntu-latest; `actions/checkout@v4` with `fetch-depth: 0`; `actions/setup-node@v4` with `node-version: 22` + `cache: npm`; `npm ci` (scripts on, `SCARF_ANALYTICS: "false"`); `npm test`; `timeout-minutes: 15`; concurrency group per head ref with `cancel-in-progress: true`. One job, stable check name.
**Pros:** the command CI runs is the command every contributor runs — R-E3's literal ask, zero drift surface between local and CI; composes with deploys by construction; L9/L10 stay live in CI; no new npm scripts or runner forks to maintain. **Cons:** full-history checkout costs ~18 MiB per run; the gate inherits everything `npm test` does (by design — that is the gate).

### Option B — dedicated `test:ci` entrypoint (subset runner or env-gated suite list)
A second npm script running a curated stack-free list.
**Pros:** explicit manifest of what CI runs. **Cons:** re-introduces the split stories 1–3 existed to eliminate — two gates that can drift, "green in CI" ≠ "green locally," silent subset shrinkage is exactly the skip-creep the reviewer banned. Story 2 already made `npm test` itself honest; a fork of it is negative work. Rejected.

### Option C — `push`-triggered on all branches (test-everything)
**Pros:** feedback before a PR exists. **Cons:** duplicate minutes per PR (push + PR events), runs race the deploy workflows' trigger on the long-lived branches, and the check-per-PR surface (AC-1) still needs `pull_request` anyway. Costs without gating value. Rejected.

## Decision

We chose **Option A** — one workflow, plain `npm test`, `pull_request` → staging/main. Recorded sub-decisions:

| Decision | Value | Why |
|---|---|---|
| Trigger | `pull_request: branches: [staging, main]` | pre-merge gate; cannot interfere with push-triggered deploys |
| Node | `22` | production Dockerfile parity (nodesource 22.x); engines floor 18 stays untouched |
| Cache | `setup-node` `cache: npm` (lockfile-keyed) | standard; no bespoke cache keys to rot |
| Install | `npm ci`, scripts **enabled**, `SCARF_ANALYTICS: "false"` | lockfile fidelity; prebuild downloads need scripts; scarf phone-home suppressed |
| fetch-depth | `0` (full history) | keeps L9/L10 live in the CI lint pass; 17.69 MiB pack makes it cheap |
| Timeout | `timeout-minutes: 15` | stack-free run is 2–4 min incl. install; 15 is a hang guard, not a budget |
| Concurrency | group `test-${{ github.head_ref \|\| github.ref }}`, `cancel-in-progress: true` | newer push supersedes older run; no queue pileup |
| Retries | **none, structurally** | no retry action, no `--retries`, no re-run steps; `test:playwright` (the only retry-bearing path, `playwright.config.js:17`) is never invoked |
| Check name | `test / stack-free` (workflow `Test`, job id `stack-free`) | stable name for the operator's future required-check flip |
| Required-check | **not taken** | explicitly reserved for the operator post-book (story AC-4) |

## Consequences

- Every PR to staging/main now carries a visible, honest verdict; the reviewer's "npm test must be clean" Gate becomes a platform fact.
- The job's log inherits the runner's per-suite SKIP lines and `Total skipped:` aggregate — skip-creep is reviewable on every PR (AC-2).
- A red check has no retry escape hatch; the culture cost (nobody can "re-run until green") is the point.
- On macOS dev boxes and Linux CI the gate is now the *same* command with the same expected result — divergence between them is itself a signal.
- Debt/follow-ups: the check is advisory until the operator flips the ruleset (documented, not taken); e2e/throwaway-relay phase deferred; a future ui-build job would be a separate ADR.
- **Firmware reinstall required?** No — no concept definitions touched.

## Implementation notes

- **File: `.github/workflows/test.yml`** (new) — name `Test`; job id `stack-free`; the table above is normative. Steps: checkout@v4 (`fetch-depth: 0`) → setup-node@v4 (`node-version: '22'`, `cache: 'npm'`) → `npm ci` → `npm test`. Job-level `env: SCARF_ANALYTICS: "false"`. Nothing else — no artifact uploads, no annotations, no third-party actions beyond the two official ones.
- **File: `OPERATIONS.md`** — new section "CI test gate (PRs to staging/main)" adjacent to the existing CI/CD deploy documentation: what runs (`npm ci && npm test`, stack-free, live suites self-skip), what is deliberately excluded (e2e/Playwright + relay-touching — deferred phase), the no-retry policy and its rationale (zero-flake record makes red = signal), the flake-waiver pattern (a cited quarantine file mirroring `scripts/harness-lint-waivers.txt`, created **only** when a real stack-free flake is first observed — its existence is the surfaced-flake signal), and the explicit note that required-check status is an operator decision not yet taken. **Update the `**Last updated:**` header** (L9 checks it against git).
- The workflow file is CI wiring, not a harness def path — no CHANGELOG row required by L10; the OPERATIONS.md touch isn't def-path either. (If the team later promotes `.github/workflows/` into `harness-def-paths.txt`, that's a separate ratified change.)
- Test Design note: the Tester can pin the workflow's normative properties (triggers, no-retry absence, timeout, concurrency, env, the two-action allowlist) as source contracts over the YAML — the live green-run proof (AC-5) is procedural at the book's PR.

## Out of scope

- Required-check ruleset changes; staging direct-push policy.
- e2e/Playwright CI, hosted throwaway relay (later phase).
- Any second job (ui build, Docker build) — future ADRs.
- The flake-waiver file itself (created on first observed flake, not before).
