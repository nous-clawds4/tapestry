# Review: Story 16 — Restore historical data visibility while fixing the TL author filter

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-05-26
**Diff:** working-tree changes vs. `738158bd` (HEAD on `feat/tracked-pinned-tags` after Story 17's commit)

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **PASS.** Every suite green. Story 16 suite: 22/22 PASS. Story 17 suites: 33/33 + 1/1 PASS. All pre-existing suites unchanged. The transient `profile-tags-publish` flake the Implementer noted is not reproducing in this run.
- [ ] _Playwright not used in this repo — skipped._
- [ ] _Lint not configured — skipped (per CLAUDE.md)._
- [ ] _Typecheck not configured — skipped (per CLAUDE.md)._
- [ ] _Build not configured at project level — UI bundle was built and deployed during cycle-local; this isn't a project-level gate._

## Spec adherence

- [x] Every acceptance criterion has a passing test.
  - AC-4 (4 tests): runtime `TA_PUBKEY` constant present at
    `src/api/profile-tags/index.js:55`; runtime `authors:` filter
    at `:1414` (`enrichRowsWithTLStatus`) and at
    `src/api/trustedList/refreshPinnedTags.js:244` (`retractStaleTLs`,
    via the unchanged `profileTags.TA_PUBKEY` re-export); endpoint
    smoke 200.
  - AC-5 (4 tests): `LEGACY_Z_TAG_PUBKEY` declared at
    `src/api/profile-tags/index.js:49` with an explanatory comment
    block (lines `:28–48`) that references ADR 0015 by name twice;
    the three z-tag constants at `:59–61` derive from
    `LEGACY_Z_TAG_PUBKEY`; the defensive anti-pattern check
    confirms no `${TA_PUBKEY}` z-tag interpolation remains.
  - AC-6 (4 tests): `LEGACY_TA_PUBKEY` declared at
    `ui/src/utils/publishTagPin.js:35`; module-level
    `TAG_PINNING_HANDLE` at `:36`; `pinTag()` signature at `:61`
    no longer accepts `taPubkey`; the validation block is gone.
  - AC-6 / R-4, R-5: `useProfileTags.js` and `publishProfileTag.js`
    untouched (verified).
  - Callers: `Tag.jsx:75` and `Pins.jsx:84` both drop the
    `taPubkey` argument; the now-unused `useConfig()` destructure
    + import are removed from both files.
  - CLAUDE.md: new paragraph at `:108` references ADR 0015 and
    names `LEGACY_Z_TAG_PUBKEY`.
- [x] No criterion is silently dropped.
- [x] No behavior added that isn't in the story/ADR. The diff is
  surgical — 7 files, +63/-35 lines, all consistent with ADR
  Implementation shape.

## ADR adherence

- [x] Files changed match the ADR's implementation notes section
      file-for-file:
  - `src/api/profile-tags/index.js` ✓
  - `ui/src/utils/publishTagPin.js` ✓
  - `ui/src/pages/Tag.jsx` (caller) ✓
  - `ui/src/pages/Pins.jsx` (caller) ✓
  - `CLAUDE.md` (named-exception paragraph) ✓
  - `src/api/trustedList/refreshPinnedTags.js` deliberately **not**
    modified (its import of `profileTags.TA_PUBKEY` still resolves
    to the runtime value via the unchanged export at
    `src/api/profile-tags/index.js:1480`).
  - `useProfileTags.js` and `publishProfileTag.js` deliberately
    **not** modified.
- [x] Layering / module boundaries respected.
  - Server `LEGACY_Z_TAG_PUBKEY` is module-scoped (not exported);
    it has no consumers outside `profile-tags/index.js`. Good — its
    scope mirrors its purpose (server-side z-tag composition only).
  - Client `LEGACY_TA_PUBKEY` is module-scoped in
    `publishTagPin.js`; mirrors the existing per-file idiom in the
    two sibling client publishers, as the ADR's Decision A
    specified.
- [x] No new dependencies the ADR didn't authorize (no
      `package.json` changes).
- [x] CLAUDE.md edit landed alongside the source changes, in the
      same scope (the ADR called this out as a same-commit
      deliverable).

### ADR Decision A — the load-bearing naming-as-safety-latch

The ADR's core insight is that `TA_PUBKEY` carrying two roles in one
name is what allowed Story 13 to silently re-introduce the broken
state. The fix:

- Server: distinct constants `LEGACY_Z_TAG_PUBKEY` (literal, wire)
  and `TA_PUBKEY` (runtime, author filter). Both present at module
  top, with comments that explicitly contrast them.
- Client `publishTagPin.js`: `LEGACY_TA_PUBKEY` (literal, wire) is
  the only TA-pubkey-like constant in the file post-fix — the
  runtime variant deliberately doesn't exist here because the
  client publisher has no runtime use for it.
- CLAUDE.md's new paragraph explicitly states "A reviewer who sees
  a diff removing `LEGACY_*` constants without an accompanying
  re-parenting migration MUST reject."

Verdict on the safety latch: **correctly installed.** A future
search-and-replace through `TA_PUBKEY` references on the server
will not collapse the two roles together because the literal
target is named differently. The CLAUDE.md guard is the secondary
backstop.

### Defensive anti-check confirms d3a2640a state is undone

Test `AC-5: the three z-tag constants do NOT derive from runtime TA_PUBKEY (defensive)`
passes — confirming the d3a2640a/cbc2b8f0 leak that this story
existed to fix is closed.

## Concept-graph integrity

- [x] No firmware concept schemas changed.
- [x] Firmware reinstall NOT required (story + ADR both confirm).
- [x] All concept handles in code are composed correctly:
  - Server `TAG_Z_TAG = 39998:${LEGACY_Z_TAG_PUBKEY}:tag` ✓
  - Server `NOSTR_USER_TAG_Z_TAG = 39998:${LEGACY_Z_TAG_PUBKEY}:nostr-user-tag` ✓
  - Server `TAG_PINNING_Z_TAG = 39998:${LEGACY_Z_TAG_PUBKEY}:tag-pinning` ✓
  - Client `TAG_PINNING_HANDLE = 39998:${LEGACY_TA_PUBKEY}:tag-pinning` ✓
  - All match the historical wire format on every deployment.

## Things tests can't catch

- [x] No secrets in committed files.
- [x] No leftover debug logging or `console.log` introduced (the
      existing `console.warn` for null `TA_PUBKEY` is preserved with
      its original text).
- [x] No commented-out code (the diff replaces comment blocks
      with new comment blocks; no dead code).
- [x] Error paths handled.
  - `pinTag()` retains its NIP-07 check (`if (!window.nostr) throw`).
  - The dropped validation block (`if (!taPubkey || …) throw`) is
    correctly removed — the parameter no longer exists, so the
    check is unreachable.
- [x] Concurrency / race conditions — no new state introduced.
- [x] Security: no input validation surfaces changed. The
      `LEGACY_*` literals are compile-time constants; no user
      input ever flows into them.

## House rules check

- [x] Concept Graph API authority respected (no source-of-truth
      shift; wire format unchanged).
- [x] No new lint/typecheck/build tooling.
- [x] **Named exception correctly declared in CLAUDE.md.** This is
      the only sanctioned exception to "Per-deployment TA pubkey
      — NEVER hardcode" in the codebase, and the CLAUDE.md note
      flags it as such.
- [x] No new TA pubkey literals beyond the named exception. Story
      16's success criterion is satisfied: the `LEGACY_*` literals
      are the only new hardcodes, both wrapped in comments that
      reference ADR 0015.

## Live-deploy verification

- [x] Container has the new server module:
      `docker exec tapestry grep LEGACY_Z_TAG_PUBKEY .../profile-tags/index.js`
      returns the new lines.
- [x] Control panel returned to a healthy state after the
      `supervisorctl restart brainstorm` (the test suite's HTTP
      smoke test against `:7778` PASSES, including the new AC-4
      endpoint check).
- [x] Local dev machine unaffected by the fix because the literal
      happens to equal the on-disk TA pubkey here — every existing
      test continues to exercise the same wire paths.

## Findings

### Blocking

_None._

### Non-blocking

1. **Doc comment in `publishTagPin.js:26` mentions
   `useConfig().taPubkey`.** The reference is intentional — the
   comment contrasts `LEGACY_TA_PUBKEY` with the runtime helper to
   explain what NOT to use. This is correct as written; flagging
   it only so a future reader doing a casual grep for `taPubkey`
   sees this is documentation, not a stray use site.

2. **Commit hygiene flag (carried over from Story 17's review,
   NB-7).** The working tree still carries untracked artifacts
   unrelated to Story 16: `concept-sharing-plan.md`,
   `engineering-team/decisions/0013-treasure-map-pin-integration.md`,
   `engineering-team/stories/14-treasure-map-pin-integration.md`.
   These are paused Story-14 deliverables. The per-phase commit
   for Story 16 should stage **only** Story 16 artifacts:
   - 5 modified source / doc files (server, client publisher,
     two callers, CLAUDE.md)
   - 1 modified test/test.js (suite registration)
   - 1 new test file
   - Story 16 story + ADR-0015 + test plan + this review
   Leave Story 14 artifacts and `concept-sharing-plan.md`
   untracked; they get their own commit when/if Story 14 thaws.

3. **`refreshPinnedTags.js` left untouched is correct, but
   conceptually noteworthy.** Its `authors: [TA_PUBKEY]` filter at
   `:244` works correctly post-fix only because
   `profile-tags/index.js` still exports `TA_PUBKEY` (the runtime
   value) at `:1480`. If a future refactor renames that export or
   stops exporting it, `refreshPinnedTags.js` will silently break
   the same way Story 13 silently broke things. Adding a one-line
   comment at `refreshPinnedTags.js:28` clarifying "this import is
   the runtime value, used for the kind-30392 author filter" would
   be small protective insurance. Non-blocking; the Implementer
   may add this opportunistically.

4. **The d3a2640a `git revert` chain trap remains theoretically
   exploitable.** Story 13's pattern — branching off a
   should-have-been-reverted commit and silently inheriting the
   broken state — could happen again. The proper guard against
   this is workflow (PRs target the post-revert branch state, not
   the pre-revert state). Story 16 doesn't address this directly;
   the CLAUDE.md "Named exception" paragraph + the
   `LEGACY_Z_TAG_PUBKEY` constant name are the secondary defenses.
   Non-blocking; flagged for awareness.

5. **The full retirement path (ADR-0015's "Eventual full
   retirement" section) is excellent documentation but is not
   captured anywhere outside the ADR.** When the team is ready to
   start the retirement epic, that section's 11-step sequence
   becomes the seed for a new story. Recommend linking ADR-0015
   from `engineering-team/follow-ups.md` so it surfaces during
   future planning sweeps. Non-blocking; optional.

6. **AC-2 and AC-3 (non-dev verification) are intentionally
   manual.** They require a staging or production deploy with
   real `tags.brainstorm.world` data to verify. The user has been
   explicit that staging promotion happens off this dev machine,
   so the cycle-staging step belongs to the operator. The
   single-line load-bearing change for production (the
   `authors: [TA_PUBKEY]` filter at `:1414` already using the
   runtime value, which the branch already had) means staging
   should "just work" — but the human smoke is the final gate.
   This review can't substitute for it.

## Verdict

**PASS.**

The diff is exactly what ADR 0015 specified. Every AC has a passing
test; every test passes; the full suite is green. The naming-as-
safety-latch (`LEGACY_Z_TAG_PUBKEY` on the server, `LEGACY_TA_PUBKEY`
in the client publisher) is correctly installed with explicit
comment blocks pointing to ADR 0015. CLAUDE.md gains the
named-exception paragraph the ADR contracted for.

The 6 non-blocking findings are housekeeping (commit hygiene,
optional small comments, optional documentation cross-references).
None gate the ship.

The deploy story is the small one this story aimed for: against
the post-revert production state, the load-bearing change is
**one line** — the `authors:` filter on `enrichRowsWithTLStatus`
already using the runtime value (which this branch already had).
Every other change in the diff is undoing the silent d3a2640a/Story-13
leak so the branch can ship to production safely.

**Recommended next steps (in this order):**

1. (Implementer) Commit Story 16 artifacts cleanly per
   Finding NB-2.
2. (Operator, off this dev machine) `cycle-staging` —
   user has memory recorded that staging deploys happen
   elsewhere; the dev-machine constraint stays in force.
3. (Operator) Manual smoke on `staging.brainstorm.world`:
   - `/tags` renders historical tags
   - opening a representative tag-detail page shows historical
     applies/disputes
   - `/pins` renders historical pin rows
   - any pinned tag's row carries an `ok` / `never` / `retracted`
     TL status (not "No TL yet")
   - a fresh user can pin a new tag and see its TL appear after
     refresh
4. (Operator) On staging-smoke PASS, promote to production via
   the team's promotion flow.
5. (Future, no urgency) Open the retirement epic per ADR-0015's
   "Eventual full retirement" section when there's product
   appetite for retiring the literal from the wire.
