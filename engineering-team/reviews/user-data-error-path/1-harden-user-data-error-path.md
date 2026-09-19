# Review: Story 1 — Harden an error path in a user-data handler

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-09-19
**Diff:** `git diff 58505ae6..HEAD` (three commits: `3195b0d1` book-open, `62ffa055` failing tests, `9b00dc45` impl) + a round-2 prose-only working-tree edit (uncommitted).
**Verdict history:** Round 1 (2026-09-19) — **CHANGES_REQUESTED** (one disclosure-discipline blocker). Round 2 (2026-09-19) — **PASS** (blocker remedied and independently re-verified). See the two Verdict sections below; round 1 is retained as history.

> **Pointer-level (SECURITY.md; the book's disclosure discipline).** This review names the behaviour, not
> the mechanism, the endpoint-as-trigger, the identifiers, or the repro. Line citations that the diff
> already carries are used only to anchor findings. No exploit/trigger prose here.

---

# Round 1 (CHANGES_REQUESTED)

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **PASS**. Run via the faithful stack-free CI method (Node 22, `--network none`, the
      populated `node_modules` volume, `git` present), i.e. what the `stack-free` required check runs.
      `gate:status` line:
      `20260919T041557Z-22-a36b [reviewer-udep] started 2026-09-19T04:15:57.732Z on 9b00dc45 — PASS, exit 0, 2852 passed, 0 failed, 522 skipped, 205/205 suites`.
      The new suite reported `harden-user-data-error-path: PASS (2 passed, 0 failed, 0 skipped)`.
- [x] `npm run test:playwright` — N/A (server-side change, no browser/UI surface). Skipped.
- [x] _Lint not configured — skipped as a gate._ (Reviewer separately ran an **ad-hoc** `no-undef` sweep
      using the UI's already-installed ESLint 9 purely to verify the scope claims below — no tooling was
      added to the repo or the gate; the temporary config was created outside the tree and removed.)
- [x] _Typecheck not configured — skipped._
- [x] _Build not configured — skipped._

## Spec adherence

- [x] **AC-1 (500 JSON on datastore-unreachable)** — `sends a 500 JSON response when the datastore is
      unreachable` asserts a response was sent, `statusCode === 500`, and a JSON object body. Green post-fix.
- [x] **AC-2 (process survives)** — `the process survives the datastore-unreachable failure` asserts the
      child exits 0 and reports `survived`. The child-process design (real handler, no rejection handler
      installed) is what makes survival observable. Green post-fix.
- [x] **AC-3 (red pre-fix for the right reason, green post-fix)** — verified independently, not taken on
      trust. With the three source files reverted to their pre-fix state (`62ffa055`) the suite is **0
      passed / 2 failed**, and the child's own error output shows it reaches the datastore-unreachable
      failure branch and then the failure escapes and crashes the process (exit 1, no result line) — i.e.
      red for the behaviour under test, not an import/typo error. Restored to HEAD: **2 passed / 0 failed**.
- [x] **AC-4 (three neighbouring tidies, no behaviour change on a reachable path)** — verified by a
      `no-undef` sweep plus reachability analysis (see Findings for the one honest caveat):
  - `src/api/export/users/queries/userdata.js:192` — corrected identifier sits on a **dead** branch
    (guarded unreachable by the earlier empty-result return above it); the substituted value is in scope.
  - `src/api/service-management/queries/control.js:34` — declaration hoisted above the `try` so the
    `catch` can reference it; the failing path is **caller-guarded** and **owner-only** (route is in the
    owner-only set — `src/middleware/auth.js:414`). See non-blocking finding 1 for the honest caveat.
  - `src/api/export/pagerank_deprecating/commands/generateForApi.js:9` — missing `require` added; the
    module is loaded by **nothing** (grep across the repo finds no importer; the live twin
    `src/api/algos/pagerank/commands/generateForApi.js`, registered at `src/api/index.js:236`, is a
    separate deferred item and is **not** touched by this diff).
- [x] **AC-5 (gate clean after the change)** — PASS (see Quality gates).

Scope confirmed by an independent `no-undef` sweep under `src`: **exactly four** matching sites existed
under `src/api` pre-fix (the three files above, with `userdata.js` carrying two) and **zero** remain
post-fix. The remaining out-of-scope matches under `src` (two `calculateGrapeRank.js`, two in
`createAllCustomerRelays.js`) and the pre-existing parse error in `src/pipeline/reconcile/…` are
**not touched** — consistent with the story's deferral.

## ADR adherence
- [x] No ADR — Architecture skipped as obvious (Bug lane, Standard; `workflows/0-intake.md` step 3). Correct.
- [x] Layering / module boundaries respected. Changes are confined to the failing branches named in the story.
- [x] **No new dependencies.** The only added import is `require('fs')` — a Node built-in, not a package.

## Concept-graph integrity
- [x] N/A — story declares "Concepts touched: None." No handles, schema, or firmware in the diff. Confirmed.
- [x] Firmware reinstall not required (no concept definitions changed).
- [x] No BIBLE re-derivation; no concept orientation needed.

## Things tests can't catch
- [x] No secrets in the diff.
- [x] TA-pubkey rule not implicated; owner pubkey is read at runtime via `getConfigFromFile`, not hardcoded.
- [x] No new debug logging; pre-existing `console.error`/`console.log` unchanged.
- [x] No new commented-out code (the pre-existing commented line at `userdata.js:257` is untouched).
- [x] Error path is exactly what was hardened; behaves correctly under the datastore-unreachable case.
- [x] Concurrency: N/A.
- [x] Security: the changed paths are dead, owner-gated, or in an unloaded module. Pre-existing query
      construction in the handler is **out of scope** for this story (a separate, more-serious finding is
      tracked privately per the story's Out-of-scope) and is not introduced or altered here.
- [ ] **Disclosure discipline — NOT clean (round 1).** See round-1 blocking finding 1 (remedied in round 2).

## House rules check
- [x] Concept Graph API authority respected (N/A this change).
- [x] No new lint/typecheck/build tooling added.

## Findings (round 1)

### Blocking
1. **`engineering-team/epics/user-data-error-path.md:31`, `engineering-team/stories/user-data-error-path/1-harden-user-data-error-path.md:53`, `engineering-team/audits/user-data-error-path/book.md:22`** —
   these three pointer-level artifacts name a **specific OPEN.md ledger-row number** (the public row for
   the observed *symptom*) as follow-on work, alongside specific documentation-section citations. That row
   number is a durable correlation key tying this fix — whose diff and regression test necessarily encode
   the mechanism — to the public symptom incident, which is precisely what the book's disclosure
   discipline (SECURITY.md; the pointer-level rule the story/book/epic all foreground) exists to withhold
   while the defect is live and unpatched. The mechanism prose itself (endpoint-as-trigger, identifiers,
   datastore name, status code, stack) is correctly **absent** from these files — so this is a correlation
   breadcrumb, not a raw mechanism dump — but the explicit ledger-row number should not appear in these
   files under that rule.
   **Asked change:** remove the explicit ledger-row number (refer generically to "the corresponding
   OPEN.md ledger row"), and let the specific documentation-section citations be carried only by the
   post-deploy doc-lane task the story already defers. → **Remedied in round 2.**

### Non-blocking
1. **`src/api/service-management/queries/control.js:34` / `:82`** — the story files this under AC-4's
   "no behaviour change on any reachable path (… caller-guarded …)." Strictly, the (owner-only) failure
   path's response **body** does change: pre-fix the `catch` itself faulted and the caller's guard
   returned a generic error; post-fix the `catch` returns the intended **structured** error and the
   caller emits it. Both outcomes are the same HTTP status, on an error-only, owner-gated path, and the
   change is an improvement (it restores what the code was written to do). Worth recording that this is a
   beneficial behaviour change rather than a literal no-op — no action required.
2. **Deferred out-of-scope items untouched (confirmed).** The remaining undeclared-identifier sites
   (`src/algos/**/calculateGrapeRank.js`, `src/manage/customers/createAllCustomerRelays.js`, `bin/*`) and
   the pre-existing parse error in `src/pipeline/reconcile/createReconciliationQueue.js:81` are correctly
   **not** modified by this diff, matching the story's "Out of scope." Recording that the deferral holds.

### Harness friction
1. The task brief described the review range as "four commits"; `git rev-list --count 58505ae6..HEAD`
   is **three** (book-open, failing tests, impl). Minor mismatch in the brief; the range itself is correct.

## Verdict — Round 1
**CHANGES_REQUESTED** — single blocker: disclosure-discipline breadcrumb (blocking finding 1). Code,
tests, and gate were otherwise PASS-quality.

---

# Round 2 (PASS)

The round-1 blocker was remedied with a **prose-only** working-tree edit (uncommitted). Each change was
re-derived from commands — not recognised as my own suggested wording and waved through (reviewer role
step 10).

## Re-verification (round 2)

- [x] **The three prose edits are as scoped.** `git diff HEAD` on the three files shows only the
      correlation-bearing follow-on notes replaced with generic phrasing; nothing new introduced:
  - `book.md:22`, `epics/user-data-error-path.md:31–32`, and
    `stories/user-data-error-path/1-harden-user-data-error-path.md:53–54` now refer generically to "the
    corresponding OPEN.md ledger row" and "the related smoke-test / operations docs (all identified
    out-of-band)."
- [x] **Correlation tokens gone.** Grepped all four prose artifacts (story, test-plan, book, epic):
      case-sensitive for the file/section citations and case-insensitive for the rest — **none remain**
      (the specific ledger-row number, the endpoint name, the status code, the datastore name, the doc
      filenames, the doc section, the dated intake entry, and any raw-stack fragment are all absent).
      The intentional lowercase pointer-level word "operations" and the disclosure-*policy* meta rows in
      the header are retained by design.
- [x] **Code and tests unchanged since the round-1 PASS.** `git diff HEAD --stat -- src/ test/` is
      empty — `src/` and `test/` are byte-identical to `9b00dc45`. `git diff HEAD --name-only` shows only
      the three prose files. No code changed, so the gate result from round 1 still stands (not re-run,
      by design — nothing under test changed).
- [x] **Harness-lint clean.** `bash scripts/harness-lint.sh` → `harness-lint: clean (0 violations)`,
      exit 0. The prose files edited are content, not harness-definition paths, so no CHANGELOG row is due.

## Verdict — Round 2
**PASS**

The single round-1 blocker is remedied and independently re-verified; the fix and its regression suite
remain correct (round-1 gate stands, no code changed), the three neighbouring tidies are safe, no new
dependencies or tooling, no concept-graph impact, and the pointer-level disclosure discipline now holds
across all tracked prose artifacts. The non-blocking observations from round 1 stand as recorded.

## On PASS
- [ ] Story `**Status:**` **intentionally NOT flipped**, and this review **intentionally NOT committed**,
      per the coordinator's round-2 instruction — the operator owns the commit and the status/ship
      sequence for this security-sensitive, still-local branch.
- [x] Completion detection performed; result reported to the coordinator (kept out of this file per the
      template). The book is **not** complete — the ship-cycle and post-deploy doc-lane acceptance-frame
      bullets remain outstanding — so no book-close is offered.
