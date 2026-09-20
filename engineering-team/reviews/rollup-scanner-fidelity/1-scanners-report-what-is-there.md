# Review: Story 1 — the roll-up's scanners report what is there

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-09-20
**Diff:** `git diff origin/staging...HEAD` on `fix/rollup-scanner-fidelity` — `28c48910` (story + book + epic), `b42a18b2` (ADR), `aa6692bd` (failing tests + test plan), `e8911345` (implementation). Base `a55b9631`. Nothing was pushed at review time.
**Lane:** Bug, Standard strictness, all five phases. ADR `rollup-scanner-fidelity/0001`.
**Rounds:** one. Two findings were raised and fixed before the verdict; both are recorded in the story's § Deviations and in § Findings below.

## Quality gates (run by reviewer, not trusted)

- [ ] `npm test` — **red on this host, and red in exactly the same way on `origin/staging`. Nothing this diff touches is involved.** Node v22.23.2 (the host default is v16.17.0, which silently skips the live suites), clean tree, `GATE_LABEL=rollup-scanner-final`:

  > `20260920T213101Z-40953-3bbe [rollup-scanner-final] started 2026-09-20T21:31:01.859Z on e8911345 — FAIL, exit 1, 3326 passed, 51 failed, 139 skipped, 210/210 suites; failed: tag-detail, capture-a-goal-and-see-it, structures-the-brain-can-trust, break-a-goal-into-pieces, attach-the-world, sessions-read-the-brain, the-proposal-loop, teach-it-what-matters, the-brain-survives, return-the-four-on-every-read-surface, show-the-four-on-the-goal-screens-that-already-exist, recognizable-published-ta-profile, not-yet-shared-filter, concept-count-canonical, summaries-element-count`

  A **labelled baseline was run for comparison**, not assumed: `GATE_LABEL=rollup-scanner-baseline` on a detached worktree at `origin/staging` `a55b9631`, same Node, same machine → `FAIL — 3284 passed, 51 failed, 148 skipped across 209 suites`, and the failing-suite list is **character-identical**. The failures are the live-stack class `OPEN.md` row 289 tracks; none of the 15 reads the ledger, the collector, the digest, the roll-up or `_intake.md`.

  The two runs differ in three ways, all accounted for:
  - `+1` suite and `+33` passing tests — `rollup-scanners.test.js`, this story.
  - `+9` passing / `−9` skipped — `honest-publish-reporting` (8) and `honest-publish-reporting-ci-guard` (1). **An artifact of the baseline worktree, not of this diff:** those suites skip when the resolved `nostr-tools` is not the version `ui/` pins, and only the root `node_modules` was symlinked into the worktree, so `ui/`'s pin could not resolve. Verified by reading the gate (`nostrToolsVersionGate` / `SKIP_REASON`, `test/honest-publish-reporting.test.js:101-117`). Nothing in this diff touches publishing.
  - `51` failed either way, same names, same order.

- [x] `bash scripts/harness-lint.sh` → `harness-lint: clean (0 violations)`, exit 0 — read from `$?`, not from stdout.
- [x] Re-run with this review file and the story's Status flip in the tree: still clean, identical output.
- [x] `test/rollup-scanners.test.js` alone at HEAD: **33 pass / 0 fail**, on Node v22.23.2 and on Node v16.17.0.
- [x] The same suite at `b42a18b2` (pre-implementation): **3 pass / 30 fail** — the red baseline the test plan records. The three that pass there are negative assertions that hold vacuously before the behaviour exists; the plan says so rather than claiming a cleaner red than it had.
- [x] `test/session-start.test.js` at HEAD: 32 pass / 0 fail — unchanged from before its runners moved into the shared helper.
- [ ] `npm run test:playwright` — not applicable; no browser surface.
- [ ] _Lint / typecheck / build not configured — skipped (JS-without-build, by design)._

## Spec adherence

- [x] Every acceptance criterion has a passing test. AC-14 (the ledger's state) is the one with no test; it is checked below by hand.
- [x] No criterion is silently dropped.
- [x] The three dispositions agreed at the intake gate are what was built: row 208's mechanical fix shape (b); the `###` warning *and* the convention; the carry-forward window *and* the tick rule.
- [x] One shape departs from the intake-gate agreement and says so in the ADR rather than quietly: the carry-forward section gained a **book budget** alongside the recency window, because a 90-day window suppresses only 8 of 55 books today — the repo's whole book history is about three and a half months old. Recorded in ADR § Decision and raised with the operator at the Architecture gate before it was built.

## Verified against the real repo, not only fixtures

Each of these was re-derived by a command during the review.

- **The trim.** `collect_meta` on the real `OPEN.md`: 130 lines, **0 invalid UTF-8**. At `a55b9631` the same command gives 1 (row 193, the line row 290 names). `utf8_trim 6 "abc—def"` → `616263e28094` (the complete em-dash kept) and `utf8_trim 5` → `616263` (the split dash dropped) — the boundary case a walk-back that fires unconditionally gets wrong.
- **Ages.** All seven open books now print `(opened YYYY-MM-DD, Nd ago)`. At `a55b9631`, none did: `date -d 2026-01-01 +%s` on this machine answers `date: illegal option -- d`.
- **The marker grammar on the real `_intake.md`.** 80 entries → 33 open, 5 partial, 42 retired. The 33 are exactly the set the anchored reader produced at `a55b9631`, so the visible intake list did not move; the 5 partials are new and are precisely the five entries whose markers carry `(partial)` ×3, `(Part A)` and `(in progress)`. `_intake.md:1847`, whose prose says "partially delivered" at character 150 inside a full pick-up, is classified `retired` — the case a keyword sniff gets wrong.
- **The `###` warning.** One retired entry qualifies (`_intake.md:2017`, three blocks) and is named with them.
- **The carry-forward section.** `55 closed books hold 359 unticked §6 items; showing the 8 most recently closed. / Not shown: 8 closed before the 90-day window, 39 beyond the 8-book budget.` 8 + 8 + 39 = 55.
- **Cost.** `collect_meta` on the real repo: **1.14s → 0.98s** (3 runs each, same machine, `origin/staging` scripts vs these). It got faster because `utf8_trim` forks nothing where `cut` forked once per row, and `intake_entries` is one `awk` where there were an `awk` and a `grep`. The full session-start digest is unchanged at ~4.77s, dominated by `harness-lint` and the stack probe.

## Things tests can't catch

- [x] No secrets, no credentials, no TA pubkey literal in the diff. `git diff origin/staging...HEAD | grep -c '82b75e47'` → 0.
- [x] No exploit detail in commits or in the PR text. The one security-adjacent fact — that a `###` block under a marked parent is invisible — is stated as the mechanism, with the affected note referred to by pointer only, as `SECURITY.md` requires.
- [x] `scripts/lib`, `scripts/whats-open.sh`, `engineering-team/workflows/` and `engineering-team/CHANGELOG.md` are harness-definition paths; the implementation commit carries the CHANGELOG row (**L10** is satisfied by committed state, and the lint agrees).
- [x] No line-budget file was touched: `CLAUDE.md` and `AGENTS.md` are unchanged, so **L11** is unaffected. `BIBLE.md` and `OPERATIONS.md` are unchanged, so **L9** freshness headers do not apply.
- [x] Nothing in the diff hardcodes a deployment-specific value. The two new environment knobs default when unset *and* when set to anything that is not a run of digits, so a typo cannot take the roll-up down under `set -u`.
- [x] Backward compatibility of the readers: a tree with no `_intake.md`, no `ledger/`, no `OPEN.md` or no `audits/` still exits 0. Four fixture repos in the suite cover those shapes, and `session-start.test.js`'s "empty, git-less directory" test still passes.
- [x] **The ledger (AC-14).** `OPEN.md` rows 290 and 208 read `DONE` with `2026-09-20 (PR #706)` and a description of what closed them; neither row was deleted or renumbered, and no row was added to the frozen table (**L15**/**L16** clean). Five new rows are files under `ledger/`, all `DONE` in this PR. Before filing, both homes were searched on `origin/staging` for each defect (`git grep -li … -- OPEN.md ledger/`) and `origin/staging` was re-fetched immediately before — 0 commits ahead of this branch's base, so the search saw the current ledger, not a stale branch point.

## Findings

### Blocking

None.

### Fixed before the verdict

**1. The carry-forward summary named the totals but not each suppressor.** ADR 0001 § Decision says the section states "the true totals and what each suppressor removed"; the first implementation printed only the totals and the shown count, leaving the reader to subtract — and subtraction cannot tell the two apart, which matters because they have different cures (wait, or raise the budget). Now: `Not shown: 8 closed before the 90-day window, 39 beyond the 8-book budget.` Pinned by an added assertion in the AC-12 test — shown plus aged-out plus over-budget must account for every book — which failed against the old line.

**2. A non-numeric `WHATS_OPEN_CARRY_DAYS` / `WHATS_OPEN_CARRY_BOOKS` would have killed the roll-up.** `carry_cutoff=$(( … CARRY_DAYS … ))` with a non-numeric value fails the assignment, and the script runs under `set -u`, so the next use of `carry_cutoff` aborts it. An operator's typo in an environment variable must not be able to take down the thing that tells a session what is open. Both now fall back to their defaults.

**3. `printf "$carry_rows"` treated data as a format string.** A path containing `%` would have been interpreted. Changed to `printf '%b'`. Latent — no audit path holds a `%` today — and cheap to remove.

### Non-blocking, not filed

**4. `test/session-start.test.js`'s header comment is still behind its own test** (lines 11–12 give the product roles' old write scope). Out of scope here, and already recorded as `OPEN.md` row `2026-09-20-rollup-reader-gap-and-stale-comment` § 2 — which also owns the other reader gap in `whats-open.sh`'s ledger section. That row's § 1 is adjacent to this diff and was deliberately left alone: same script, different defect, owned elsewhere.

**5. The five partly-picked-up entries and the one nested `###` entry are now visible and untriaged.** Surfacing them was this story; disposing of them is explicitly out of its scope (story § Out of scope). They are the next `/whats-open` triage's input, which is the point.

### Harness friction

**6. The marker vocabulary grew for four months with no written definition, and two readers of it drifted apart in plain sight.** `_intake.md` had eight marker spellings; the readers knew two. The fix that mattered was not the regex — it was writing the grammar down in one place that both readers consume. Worth carrying into any future case where two scripts read the same hand-written file: the file's format is an interface, and an interface with no written definition will grow spellings faster than its readers learn them.

**7. A defect measured at triage had moved by the time it was built.** The packet recorded 48 books / 323 carry-forward items on 2026-09-13; on 2026-09-20 it was 55 / 359. The direction of travel, not just the number, is what argued for a budget rather than a window alone — and only re-measuring showed it. Consistent with the same note in the 2026-09-13 ledger-closeout review (§ Harness friction 6): triage-time and write-time verification drift apart in days, not months.

## Verdict

**PASS**

Six defects, each measured before and after on this repo's own files rather than on fixtures alone. The three duplicated rules now have one home each, which is what stops this class recurring; the marker grammar is written down for the first time; and the carry-forward section states what it is not showing instead of hiding it. The gate is red on this host in exactly the way `origin/staging` is red, verified by a labelled baseline run rather than assumed.
