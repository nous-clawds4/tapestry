# Story 1: Live-feed read path — hermetic tests, legible degrade

**Status:** Approved
**Created:** 2026-07-05
**Type:** Bug

## Background

OPEN.md row 13(a), anchored by the `test-hermeticity-ci` book (frame bullet 1; `engineering-team/audits/test-hermeticity-ci/book.md`).

In a bare checkout — no `node_modules`, outside any modules-bearing ancestor — live-feed test B9 fails with a message about relay-set resolution (*"relaySource must be 'set'; got \"fallback\""*) when the actual cause is a missing npm dependency: the feed's relay-set resolution reaches a non-injected read of the TA-pubkey helper, whose module load fails without installed deps, and a silent catch converts that crash into "use fallback relays." Book recon (2026-07-05) reproduced this in a `git archive` copy outside the repo tree and instrumented the catch: the swallowed error is `MODULE_NOT_FOUND: Cannot find module 'nostr-tools'`, it fires identically for B9, B10, and B11 — so B10/B11 currently *pass without ever invoking their injected fakes*. Green tests proving nothing. The same silent catch also guards the Neo4j driver load, so in production a broken install is indistinguishable in the logs from "relay set empty."

Who is affected: contributors and CI sessions running tests in a fresh checkout (a red B9 misdirects them to relay logic); operators of production instances (a real install/dependency failure silently degrades the feed to fallback relays with no trace).

**Design direction (ratified at book open; Architecture phase skipped for this story — this paragraph is the durable record):** the TA-pubkey read becomes part of the feed module's existing injectable-dependency seam alongside its four peers, with a lazy, runtime-resolved default so production behavior and the TA-pubkey house rule (never hardcode; resolve at runtime) are untouched; the degrade catch logs the underlying error before falling back.

## User-facing description

As a contributor (or CI job) running `npm test` in a fresh checkout, I want the live-feed suite to pass hermetically and fail only for real reasons, so that a red test points at an actual defect instead of a missing module.

As an operator reading server logs, I want the feed's fallback-to-default-relays decision to name its cause, so that a broken install is distinguishable from an empty relay set.

## Acceptance criteria

- [ ] Given a bare copy of the repo (no `node_modules`, located outside any `node_modules`-bearing ancestor — explicitly not a `.claude/worktrees/` worktree, which inherits the parent's modules), when the live-feed read-path suite runs, then the suite reports **zero failures** — B9 **passes** (it does not skip), and only tests whose fixtures require installed npm packages may skip, each visibly and with a reason. *(Amended at Test Design 2026-07-05: the suite empirically has 30 tests, not the recon's 23; five are fixture-bound to `nostr-tools` and can never pass bare — see the test plan's bare-copy verification.)*
- [ ] Given the suite's injected test doubles, when B9, B10, and B11 run, then each double is observably exercised — the suite fails, rather than passes, if a double is bypassed (no more vacuous green).
- [ ] Given a production-shaped call (no injected dependencies) in which relay-set resolution fails for any reason (missing module, driver load failure, query error), when the feed degrades to fallback relays, then the server log carries the underlying error's message/code alongside the fallback decision — never a silent degrade.
- [ ] Given a normal installed checkout (deps present; stack absent or present), when the full suite runs, then live-feed results are unchanged from today (still stack-free, still green), and the live-feed suite's output no longer contains host-config fallback noise (today it prints "Config file /etc/brainstorm.conf not found … Using default value for BRAINSTORM_RELAY_PUBKEY: null" — evidence the tests currently read host paths).
- [ ] Given the shipped diff, when reviewed, then no literal TA pubkey appears anywhere in it, and the production path still resolves the TA pubkey at runtime through the sanctioned helper chain (env → `brainstorm.conf` → secure-key storage) — the house rule stays intact.

## Concepts touched

None — no concept-graph entities are created, renamed, or re-parented; no event kinds, API routes, or wire formats change. The change is confined to test hermeticity and the legibility of an internal degrade path. (Stack not required for this story.)

## Out of scope

- The 12 unguarded live-API suites and their skip guards — story 2 (`stack-free-npm-test`).
- Harness-suite portability (hook-file shipping, BSD-date fallbacks, timing asserts) — story 3; the CI job — story 4.
- The two sibling silent catches in the same module (settings-read failure → "no House PoV"; author-enrichment failure → "author has no profile") — same hazard class, flagged in book recon; defer to a future legibility pass unless one directly blocks the criteria above.
- The live `*-publish` suites' nondeterminism and the dev-TA-pubkey hardcode in `profile-tags-publish.test.js:24` — on the book's out-of-frame list.

## Open questions

None — the fix direction was ratified at book open; the remaining choices (exact log shape; how "double exercised" is asserted) belong to Test Design and Implementation.

## Linked artifacts

- ADR: — (Architecture skipped per the ratified book plan; the durable design record is this story's Background + book frame bullet 1)
- Test plan: `engineering-team/stories/test-hermeticity-ci/1-feed-hermeticity.test-plan.md`
- Review: (filled in after Review phase)
