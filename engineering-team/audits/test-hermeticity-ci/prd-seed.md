# PRD Seed: Test Hermeticity + Continuous Integration

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/test-hermeticity-ci/audit.md`
**Anchor:** acceptance frame in `book.md` (operator-confirmed at kickoff)
**Confidence:** high
**Date:** 2026-07-06

> Reverse-engineered baseline for a dev-infrastructure "product": the test suite and its CI gate. The users are this repo's contributors (human + Claude sessions) and the reviewers who trust "the tests pass." Successor to `audits/harness-self-improvement/prd-seed.md` — that book's carry-forward §6 named the CI job (row 13) as the loop's biggest remaining manual dependency; this book closed it. The product team adopts this seed if a future phase evolves the test/CI machinery further (e.g. admitting e2e to CI).

## 1. Product vision

`[FROM FRAME]` A test gate that means what it says on any machine, run by the platform rather than by whoever remembers. `npm test` is **hermetic** (a red result is a real defect, never a missing dependency or an absent stack), **portable** (identical outcome on a contributor's macOS laptop and a Linux CI runner), and **honest about what it didn't run** (stack-dependent suites skip visibly and counted, never silently). `[INFERRED]` The underlying problem: "the tests pass" was an unverifiable claim — the suite hard-failed without a Docker stack, drifted across platforms, and no automation ran it, so the reviewer's "npm test must be clean" gate was enforced only by discipline.

## 2. Personas

`[FROM FRAME]` **The PR author** (human or Claude) — wants a red/green verdict on the PR itself, before merge, not a post-merge surprise. `[FROM FRAME]` **The reviewer** — wants "did the tests pass?" to be a platform fact visible on the PR, not a claim they re-verify by hand. `[INFERRED]` **The stack-absent session** (fresh checkout, remote/CI, any OS) — needs the gate to run with nothing pre-provisioned and to distinguish "broken" from "no stack." `[INFERRED]` **The operator** — decides whether the advisory check becomes a *required* one, and owns the deferred e2e/relay phase.

## 3. Scope (as-built)

`[FROM FRAME]` In: hermeticity (the feed read path's hidden TA-pubkey I/O boundary made injectable + legible); a stack-free-green `npm test` (12 live suites skip-guarded, visible/counted skips); cross-platform portability (GNU/BSD date, the shipped SessionStart hook, deterministic timing asserts, lint L12); one CI gate (`npm ci && npm test` on PRs to staging/main, no retries). `[FROM FRAME]` Explicitly out: e2e/Playwright in CI and the hosted-throwaway-relay question (a later phase); making the check *required*; stabilizing the live `*-publish` class.

## 4. Domain model

`[INFERRED]` **Suite** — classified stack-free (runs anywhere, zero recorded flakes) or live-API (needs the control panel; whole-suite skips when absent, visibly + counted). **Skip** — a first-class, aggregated outcome (`Total skipped:`), distinct from pass and fail; its visibility is the anti-drift property. **The gate** — `npm test`: one command, same locally and in CI; exit code is the verdict, structurally no retry. **Flake** — a stack-free suite failing nondeterministically; its response is a *cited waiver row* (mirroring `harness-lint-waivers.txt`), not a retry — the waiver file's existence is the surfaced-flake signal, so it deliberately does not exist until the first real flake. **Injectable seam** — a module's I/O boundaries passed as dependencies with runtime-resolved defaults; a boundary outside the seam (the TA-pubkey read) is a hermeticity bug. No nostr concepts — this domain lives entirely in the repo + CI.

## 5. Design rules (as-built)

`[INFERRED]` The gate CI runs is the *same command* contributors run — no `test:ci` subset that can drift (a subset is silent skip-creep). Facts live in one place: date math in `date-epoch.sh`, skip thresholds/wording already single-sourced, the workflow's normative properties in ADR 0001. Instruments never gate but the test gate does — and only outside hooks. A green sentinel must actually execute (the R-E4 lesson): the CI run was verified to run `npm ci` + `npm test`, not no-op. Enforcement claims state what the platform enforces — the check is documented as *advisory* until an operator flips the ruleset, never as "required." Every mechanism runs stack-absent.

## 6. Carry-forward & open questions

Promoted from audit §6: the **required-check flip** (advisory→required, operator decision); **e2e/Playwright + hosted throwaway relay** (the deferred phase — the biggest remaining scope); **cross-module clones** of the silent-catch+non-injected-TA pattern (`_shared/relaySource.js`, `userNotesReadPath.js`); **stabilizing the live `*-publish` class** (poll-not-sleep, per-suite strfry isolation, de-hardcode the dev TA pubkey) as the precondition for admitting live suites to CI; low-severity harness robustness (OPEN.md rows 21, 22).

## 7. What product must validate

- [ ] `[UNKNOWN]` **Required-check policy.** Should `test / stack-free` become a *required* check — and on which branches? A required check on staging means closing its direct-push path (used by some flows/skills today). Cost/benefit is an operator call, not an engineering one.
- [ ] `[UNKNOWN]` **The e2e-in-CI phase.** Is a hosted throwaway relay worth standing up so Playwright can run in CI, or does e2e stay a local-only gate? This shapes the next book's whole scope.
- [ ] `[INFERRED]` **Flake-waiver discipline in practice.** The waiver-on-first-flake pattern is documented but unexercised (no stack-free flake has occurred). After a quarter of real PRs, check: did any stack-free suite flake, and did the response stay "cited waiver, never retry"? The zero-flake premise is what makes red = signal.
- [ ] `[INFERRED]` **CI cost/latency.** `fetch-depth: 0` + full `npm ci` per PR is cheap today (17.69 MiB pack, ~30s install). Revisit if the repo or dependency set grows enough to make it a felt cost.
