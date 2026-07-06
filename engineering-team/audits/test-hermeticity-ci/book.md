# Book of Work: Test Hermeticity + CI

**Slug:** test-hermeticity-ci
**Status:** Open
**Opened:** 2026-07-05
**Closed:** —

## Intent anchor
**Acceptance frame (no PRD)** — the operator's ask, restated and confirmed at kickoff. Completion is *judged* against the bullets below.

Source: `OPEN.md` row 13 (2026-07-02, harness sweep) + `docs/HARNESS_REVIEW_HANDOFF_2026-07-02.md` §4.1 R-E3 — the successor book that `audits/harness-self-improvement/book.md`'s acceptance bullet 7 explicitly deferred R-E3 into. The operator's ask: *make `npm test` an honest, stack-free gate and put it in CI* — fix the B9 hermeticity bug, make the suite exit 0 without the local stack (visibly skipping what needs the stack), and gate PRs to staging/main with a minimal `npm ci && npm test` job.

Design constraints carried over from the source (reviewer vcavallo, PR #337, transcribed in row 13): **(1) stack-free suites only** — e2e/Playwright and anything relay-touching stays out of CI in this book; the hosted-throwaway-relay question belongs to a later phase. **(2) The gate surfaces flakes, never normalizes them** — no auto-retry, no rerun-on-red, no delta-baselines (the failing set churns against a half-alive stack: 36→34 across runs, `audits/verified-muters/journal.md:38`); SKIPs are visible and counted.

### Acceptance frame
- [ ] **The live-feed suite is hermetic and its degrade path is legible.** In a bare copy of the repo outside any `node_modules`-bearing ancestor (worktrees under `.claude/worktrees/` inherit the parent's modules via Node's upward resolution — verification must not run there), `test/live-feed-read-path.test.js` passes 23/23. The TA-pubkey read joins `src/api/feed/feedReadPath.js`'s documented injectable seam as a fifth dependency with a lazy, runtime-resolved default (`getOwnerAssistantPubkey` via `utils/assistantKeys` — the house TA rule stays intact, nothing hardcoded); the relay-degrade catch logs the underlying error before falling back; B10/B11 demonstrably exercise their injected mocks (today they pass vacuously — instrumentation showed their fakes are never invoked in a bare checkout).
- [ ] **`npm test` is the stack-free gate, on Linux and macOS.** On a fresh clone with `npm ci` and no stack, `npm test` exits 0: the 12 unguarded live-API suites gain the existing `controlPanelReachable()`-style whole-suite skip guard (visible, counted SKIPs; they still run when the stack is present); the session-start suite passes because `.claude/settings.json` actually ships (`.gitignore` un-ignore + tracked hook file — retires OPEN.md row 20, and harness-lint learns to flag def-path rows whose file doesn't exist on disk); the GNU-`date`-only failures on macOS are fixed (`harness-lint.sh` L9, `harness-stats.sh` durations, `scripts/lib/collect-meta.sh` ages — retires OPEN.md row 19); no wall-clock timing assertion remains in the stack-free subset (`login-failure-and-tag-collapse`'s `<100ms`/`≥120ms` asserts made deterministic).
- [ ] **A CI job gates PRs to staging and main.** `.github/workflows/test.yml` runs `npm ci && npm test` on `pull_request` → staging/main: Node 22 (matches the production Dockerfile), lockfile-keyed cache, `SCARF_ANALYTICS=false`, concurrency-cancel, a hard timeout. It composes with (never touches) the push-triggered deploy workflows, and it has run green on this book's own PRs before close.
- [ ] **The gate surfaces flakes instead of normalizing them.** No retry mechanism exists anywhere in the job or the runner; SKIP counts appear in the job output; the cited-waiver quarantine pattern (mirroring `scripts/harness-lint-waivers.txt`) is documented for the first real stack-free flake, and the waiver file deliberately does not exist at close — its first entry, if ever, *is* the surfaced flake. Making the check *required* in the GitHub rulesets is a post-book operator decision, recorded but not taken here.

*Out of frame:* e2e/Playwright in CI + the hosted-throwaway-relay question (deferred by the reviewer to a later phase); stabilizing the live `*-publish` class (poll-instead-of-sleep for `PROPAGATION_MS`, per-suite strfry state isolation, de-hardcoding the dev TA pubkey in `profile-tags-publish.test.js:24`); staging direct-push branch-protection policy; ROADMAP/OPERATIONS content refreshes beyond the new CI section (OPEN.md rows 14–15).

## Epics in this book
- `test-hermeticity-ci` — hermeticity fix (B9 seam), stack-free-green `npm test` (skip guards + portable harness suites), and the first CI test job.

## Provenance
- **Mode:** Acceptance-frame
- **Confidence at close:** high | medium | low

## Close artifacts *(filled by `/close-book`)*
- Build audit: `engineering-team/audits/test-hermeticity-ci/audit.md`
- Product feedback: `engineering-team/audits/test-hermeticity-ci/prd-seed.md`
