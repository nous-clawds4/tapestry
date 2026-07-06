# Epic: Test Hermeticity + CI

**Status:** Done
**Book:** `engineering-team/audits/test-hermeticity-ci/book.md` (acceptance-frame, Closed 2026-07-06)

## What this is

OPEN.md row 13 / harness-review finding R-E3: the gap between "`npm test` must be clean" as prose (workflows 4–5, Gate 4) and as a platform guarantee. Three parts — (a) one stack-free suite (live-feed B9) is non-hermetic in bare checkouts because the TA-pubkey read escapes `feedReadPath.js`'s injectable seam and a silent catch converts the missing-dep crash into fallback-relay behavior; (b) 12 live-API suites hard-fail `fetch failed` without the local stack, so `npm test` exits 1 stack-free and the gate can't be evaluated; (c) no `.github/workflows/` job runs any test. This epic makes `npm test` an honest stack-free gate on Linux and macOS, then puts it on PRs to staging/main.

Binding reviewer constraints (vcavallo, PR #337): **stack-free suites only** — e2e/Playwright and the hosted-throwaway-relay question are a later phase; **the gate surfaces flakes** — no auto-retry, no rerun-on-red, visible counted SKIPs.

## Stories

`stories/test-hermeticity-ci/` — 1–3 independent of each other; 4 depends on all three:

1. **feed-hermeticity** — the TA-pubkey read joins `feedReadPath.js`'s documented injectable seam as a fifth dependency (lazy, runtime-resolved default; house TA rule intact); the relay-degrade catch logs what it swallows; B9 passes in a bare checkout and B10/B11 stop passing vacuously.
2. **stack-free-npm-test** — the 12 unguarded live-API suites gain the existing `controlPanelReachable()`-style whole-suite skip guard (visible, counted SKIPs; still run live when the stack is up); the runner surfaces skip totals in its summary.
3. **harness-suites-portable** — `.claude/settings.json` actually ships (`.gitignore` un-ignore + tracked hook file; OPEN.md row 20); harness-lint flags def-path rows with no file on disk; BSD-date fallbacks in `harness-lint.sh` L9 / `harness-stats.sh` / `scripts/lib/collect-meta.sh` (row 19); `login-failure-and-tag-collapse`'s wall-clock asserts made deterministic.
4. **ci-test-job** — `.github/workflows/test.yml`: `npm ci && npm test` on `pull_request` → staging/main (Node 22, lockfile cache, `SCARF_ANALYTICS=false`, no retries, concurrency-cancel, hard timeout); OPERATIONS.md gains the CI-test-job section; the ADR records the no-retry policy, the Node pin, the fetch-depth choice, and the flake-waiver pattern (file created only on the first real flake).

## Out of scope (whole epic)

- e2e/Playwright in CI; the hosted-throwaway-relay question (later phase per the reviewer).
- Stabilizing the live `*-publish` class: poll-instead-of-sleep for `PROPAGATION_MS`, per-suite strfry state isolation, de-hardcoding the dev TA pubkey in `profile-tags-publish.test.js:24`.
- Making the CI check *required* in the GitHub rulesets (post-book operator decision); staging direct-push policy.
- ROADMAP/OPERATIONS content refreshes beyond the new CI section (OPEN.md rows 14–15).

## Related

- OPEN.md rows 13 (anchor), 19 + 20 (retired by story 3).
- `docs/HARNESS_REVIEW_HANDOFF_2026-07-02.md` §4.1 R-E3 (and R-E4's lesson: source-regex sentinels can pass while runtime behavior is broken).
- `audits/harness-self-improvement/{book,audit,prd-seed}.md` — the predecessor book that deferred R-E3 here (frame bullet 7; carry-forward §6).
