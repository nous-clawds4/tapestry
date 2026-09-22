# Build Audit: llms.txt on the tapestry fleet

**Book:** `engineering-team/audits/llms-txt/book.md`
**Date:** 2026-09-22
**Branch / commit range:** `eb08b102^..d013d37f` on `staging` (PR #740 → `staging` as `9a9230a4`, promoted to `main` via #741 as `d9e6912e`), plus direct cherry-pick + push to `feat/tags` (`e8ca6597..1d416fbb`) and `feature-magic-carpet` (`ebb941b3..0826d18d`) — no PRs, both sandboxes predate `staging`-first review conventions.
**Provenance:** Acceptance-frame
**Confidence:** high. Every frame bullet is checkable in the diff and against the live hosts, and all six were re-checked, live, on all four hosts, in this close.

> The Build Audit is the as-built record: what the product *is* now. It does not propose changes; that is the seed's job.

## 1. What shipped

- **Every tapestry-fleet host serves `llms.txt`.** `/llms.txt` (`text/plain; charset=utf-8`, [llmstxt.org](https://llmstxt.org/) format) is live on `tapestry.`, `staging.`, `tags.`, and `magic-carpet.brainstorm.world` — a curated 12-link pointer manifest for visiting AI agents, replacing the SPA shell those paths served before. — `stories/done/llms-txt/1-serve-llms-txt-on-the-fleet.md`
- **A targeted `robots.txt` exemption.** Non-production hosts keep their blanket `Disallow: /` (they still opt out of search indexing) but now carry `Allow: /llms.txt` ahead of it — a deliberate-agent affordance, not an indexing change. Production's `robots.txt` is byte-unchanged.
- **A fourth test class.** `test/llms-txt.test.js` (27 tests) adds "L-class" to the U/S/H taxonomy `site-trust-signals` established: one live fetch per required link, SKIP-per-link on network failure, FAIL only on an actual bad HTTP response.
- **The renewal ritual now covers `llms.txt` too.** OPEN.md row 172 (the `security.txt` `Expires` alarm) was extended in the same phase that shipped the feature, not left as a follow-up.

## 2. Epics & stories rolled up

### Epic: `llms-txt` — **Done**, retired 2026-09-22

| Story | Delivered | Status | Review |
|---|---|---|---|
| #1 serve-llms-txt-on-the-fleet | `buildLlmsTxt()` + `robots.txt` exemption + 27-test suite, on all four hosts | Done | `reviews/done/llms-txt/1-serve-llms-txt-on-the-fleet.md` — **PASS**, zero blocking findings |

ADR: `decisions/done/llms-txt/0001-serve-llms-txt-on-the-fleet.md`. Chose extending `src/utils/siteTrust.js` (a fourth builder + route) over a static file under `ui/public/` — the static option couldn't compose with the `robots.txt` exemption and would have split "every well-known root document" across two unrelated mechanisms. Phase path: Standard/Feature, all five phases, each at its own commit boundary (`plan`/`adr`/`test`/`impl`/`review`) — correcting a process slip from earlier in the story's own history: the first four phase commits briefly landed on local `staging` directly before being moved onto a proper feature branch (`feat/llms-txt`) partway through Implementation. No repeat of `site-trust-signals`' single-commit-for-all-five-phases problem (OPEN.md row 212's adjacent case).

## 3. As-built inventory

**User-facing / endpoints.** One new route, in `bin/control-panel.js`, registered immediately after the existing `/robots.txt` route (`:198` on `staging`/`main`) and — load-bearing, verified by calling `isBlockedProbePath('/llms.txt')` directly — before the honest-404 deny-rule middleware (`:353`), since `.txt` is a blocked probe extension and `/robots.txt` depends on the identical ordering today:

| Surface | Behavior |
|---|---|
| `GET /llms.txt` | `text/plain; charset=utf-8`, static content from `buildLlmsTxt()` |
| `GET /robots.txt` (non-production) | now `Allow: /llms.txt\nDisallow: /\n` instead of bare `Disallow: /\n` |
| `GET /robots.txt` (production) | unchanged: `Allow: /\n` |

**New module additions**, `src/utils/siteTrust.js`: `LLMS_TXT_PATH` (`'/llms.txt'`, the single source of truth referenced by both the route and the `robots.txt` exemption), `LLMS_TXT` (a 3,249-byte template literal), `buildLlmsTxt()` (no options — content has no per-host variation, unlike `security.txt`'s `Canonical`).

**Domain.** None — same as `site-trust-signals`, this sits at the HTTP layer and is deliberately outside the four architecture invariants (identical response for every viewer, states facts about the deployment and about public documents, not about any POV's view of the graph).

**Data & contracts.** One new static-content route. No event kinds, no API routes, no stored shapes.

**Tests.** `test/llms-txt.test.js`, registered `test/registry.js`: 9 U-class (content/format), 3 S-class (source sentinels — `S2` is the load-bearing placement guard), 3 H-class (live HTTP against `:7778`), 12 L-class (one per required link, live network). 27 total, all passing as of this close.

**Sandbox rollout — outside the normal story cycle, no PR:**

| Branch | Host | Commits | Mechanism |
|---|---|---|---|
| `feat/tags` | `tags.brainstorm.world` | `e8ca6597..1d416fbb` (5 cherry-picked) | direct cherry-pick + push; one conflict (`OPEN.md` row 172 — this branch never had the `site-trust-signals` book-close's `done/`-path rename, resolved to this branch's own real path) |
| `feature-magic-carpet` | `magic-carpet.brainstorm.world` | `ebb941b3..0826d18d` (5 cherry-picked) | direct cherry-pick + push; conflicts in `bin/control-panel.js` (this branch's session middleware has no Redis — resolved by inserting only the new route, leaving the branch's own session setup untouched) and three files (`OPEN.md`, `test/registry.js`, `engineering-team/stories/_intake.md`) that don't exist on this branch at all — dropped from the sync rather than force-introduced |

Both required the operator's explicit direction at each judgment point (see §4 #1, #2, #3).

## 4. Deviations from intent

| # | Specified (frame) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | "All four tapestry-fleet hosts…" / "Verified live on all four hosts" | Shipped to all four, but not in one motion: `tapestry.` and `staging.` via the normal PR → merge → deploy path; `tags.` and `magic-carpet.` via direct cherry-pick + push, done as separate operator-directed actions after Review had already passed on the story's own 2-host evidence | intentional-change (sequencing) | Review's own "On PASS" section explicitly declined to offer closing the book: "Two of its six acceptance-frame bullets are post-deploy claims… that this unmerged, undeployed diff cannot satisfy yet." The sandbox rollout happened in this session, on the operator's explicit "try it" / "push anyway" calls at each branch, before this close | None — the frame's plain reading ("all four hosts") is satisfied either way, and this close re-verified all four live itself rather than inheriting Review's narrower evidence | — |
| 2 | *(not specified — an implementation detail of reaching "all four")* | `OPEN.md`, `test/registry.js`, and `engineering-team/stories/_intake.md` were dropped from the `feature-magic-carpet` sync; that branch has none of the three | constraint-discovered | The branch predates all three systems entirely (its own `test/test.js` is still the pre-registry hand-written runner) — bringing partial ledger/registry content onto a branch with no surrounding system for it would be actively wrong, not merely incomplete. Operator confirmed "drop both, keep the rest" for the first two files; the same reasoning was applied to `_intake.md` without re-asking, since it's the identical situation | None to the shipped feature. `feature-magic-carpet` still has no ledger, registry, or intake tracking — unchanged by this book, not newly broken by it | Ledger row `2026-09-22-drifted-sandbox-lacks-harness-subsystems` |
| 3 | *(not specified)* | Pushed to `feature-magic-carpet` with no deploy-safety check — `scripts/check-safe-to-merge.sh` doesn't exist on that branch, and the live host 404s `GET /api/deploy-safety/status` | constraint-discovered | Same underlying gap OPEN.md row 73 already documented and fixed for `feat/tags` (closed 2026-09-18) — `feature-magic-carpet` never got the equivalent backport. Operator chose "push anyway," reasoning that a deployment this far behind (2,834 commits) almost certainly predates the task-queue-scheduler system the check protects against | None observed: the deploy succeeded cleanly, and the host is a development sandbox, not shared production traffic | Ledger row `2026-09-22-drifted-sandbox-lacks-harness-subsystems` (folded in — same root cause as #2) |
| 4 | *(not specified — a verification-method detail)* | A local `node test/test.js` run in the `feature-magic-carpet` worktree reported "Overall: PASS," but was silently exercising `:7778` on the **shared Docker container**, which was bound to the *main checkout* (on `staging`, already known-good) — not the worktree's own code at all | process deviation, caught before being relied on | Recognized by checking the container's actual bind-mount and the main checkout's branch immediately after the suspiciously-clean result, rather than citing it as evidence. The result was discarded; the stack-free suite (24/0/0) plus the real post-deploy smoke test are what the audit and the close actually rely on | None — caught before it reached a decision. Would have been a false "third form of verification" in the close's own evidence trail if not caught | Ledger row `2026-09-22-worktree-test-runner-false-positive` |

**Undocumented work:** none in the `staging`-diff sense — every file in `eb08b102^..d013d37f` traces to story 1, walked file by file. The sandbox-rollout commits (§3) are, by construction, identical content to the reviewed commits (cherry-picks, not new work); their *conflict resolutions* are the only genuinely new material, and they're accounted for in #2–#4 above rather than left as an unexplained gap.

## 5. Quality state at close

- **Test gate at close.** Run after the book flip and epic close-out, so it certifies the tree this close leaves behind. `npm run gate:status`:

  > `20260922T034520Z-29164-acc1 [llms-txt-book-close] started 2026-09-22T03:45:20.430Z on
  > 577be4e9+dirty — FAIL, exit 1, 3658 passed, 85 failed, 36 skipped, 222/222 suites; failed:
  > profile-tags, profile-tags-publish, tag-detail, tag-detail-publish, tag-detail-write-publish,
  > tag-index-publish, profile-tag-polish, pin-a-tag, tl-publication-from-pins,
  > tl-publication-from-pins-publish, customize-pin-curation-publish, most-pinned-tag-index-publish,
  > deploy-safety-status, event-less-create-set, capture-a-goal-and-see-it,
  > tapestry-per-concept-detail-views, structures-the-brain-can-trust, break-a-goal-into-pieces,
  > attach-the-world, sessions-read-the-brain, the-proposal-loop, teach-it-what-matters,
  > the-brain-survives, return-the-four-on-every-read-surface,
  > show-the-four-on-the-goal-screens-that-already-exist, brain-first-tapestry-authoring,
  > tl-membership-method-selector, tl-weighted-sum-method, tl-certainty-method, not-yet-shared-filter,
  > concept-count-canonical, summaries-element-count`

  **The verdict is FAIL, and this close does not round that off.** Diffed programmatically against
  the 32-suite baseline Review recorded three hours earlier (`20260922T023031Z-28769-2aea`): **the
  two sets are byte-for-byte identical** — zero new failures, zero resolved. `llms-txt` does not
  appear in the failing set; `harness-lint` is clean, confirmed both before any edit in this close
  and again after.

- **`harness-lint` at close:** clean (0 violations), confirmed on the pristine close tree before any edits and again after.
- **`test/llms-txt.test.js` standalone:** 27 passed, 0 failed, 0 skipped — re-run in this close, not just inherited from Review.
- **Live verification, all four hosts, this close** (superseding Review's narrower 2-host evidence per §4 #1):

  | Host | `/llms.txt` | Content-Type |
  |---|---|---|
  | tapestry.brainstorm.world | 200 | text/plain; charset=utf-8 |
  | staging.brainstorm.world | 200 | text/plain; charset=utf-8 |
  | tags.brainstorm.world | 200 | text/plain; charset=utf-8 |
  | magic-carpet.brainstorm.world | 200 | text/plain; charset=utf-8 |

  All four also independently confirmed serving byte-identical content to `buildLlmsTxt()`, and the three non-production hosts confirmed carrying the `robots.txt` exemption, during the sandbox-rollout smoke tests earlier in this session.
- **Known open issues / accepted:** §4 #2/#3 (the `feature-magic-carpet` harness gaps — pre-existing, not introduced by this book).
- **Debt from ADR 0001's `Consequences`:** the link-resolution renewal-ritual placement (done, OPEN.md row 172) and the "if any of the four linked repos renames its default branch" content-maintenance note (accepted, inherent to a pointer manifest).

## 6. Carry-forward register

- [ ] **`feature-magic-carpet` (and possibly other very old sandboxes) has no `OPEN.md`, `test/registry.js`, or `_intake.md`, and no deploy-safety endpoint.** No written playbook exists for "sync one feature to a branch this far behind." (§4 #2/#3 · ledger row `2026-09-22-drifted-sandbox-lacks-harness-subsystems`)
- [ ] **A worktree's own inherited test file can silently test the wrong branch's live server** through the shared Docker bind-mount, producing a confident but meaningless PASS. (§4 #4 · ledger row `2026-09-22-worktree-test-runner-false-positive`)
- [ ] **`feat/tags` still has OPEN.md row 195 open** (its `test/test.js` diverges from `staging`'s and the next sync there will conflict) — not touched by this book, since the llms-txt sync didn't modify `test/test.js` on that branch, but worth knowing it's still there for the next person who syncs anything else to `feat/tags`.
- [ ] **Relay and API fleets still have zero site-trust coverage** (carried forward from `site-trust-signals`' own audit, unchanged by this book — out of scope, different repositories).
- [ ] **Three estate host lists outside this repo still name two decommissioned hosts** (carried forward from `site-trust-signals`' audit; ledger row `2026-09-22-estate-inventory-names-dead-hosts`, unchanged by this book).

## 7. Process findings (harness)

Retro run on measurement: `scripts/harness-stats.sh` at close reads **238 reviews parsed, 236 final
PASS, 2 final CHANGES_REQUESTED (0% kick-back rate), 45 reviews with kick-back history**, and a
per-epic phase-commit count of **`llms-txt: 4`** — one short of the 5 commits this book actually
made. Chasing that discrepancy is the retro's first finding below, not a coincidence.

| Finding | Source | Terminal state |
|---|---|---|
| **An extremely-drifted long-lived sandbox branch lacks entire harness subsystems, not just diverged content** — `feature-magic-carpet` (2,834 commits behind `staging`) has no `OPEN.md`, no `test/registry.js`, no `_intake.md`, and no deploy-safety endpoint. OPEN.md row 195 already names the narrower case (a sandbox's `test/test.js` *content* differing from staging's); this is the more extreme version — entire systems absent, not just diverged. Row 73 already fixed the analogous deploy-safety gap for `feat/tags`, but nothing generalized that fix or wrote down when it's needed again. | This close's `feature-magic-carpet` sync, §4 #2/#3 | **New ledger row `2026-09-22-drifted-sandbox-lacks-harness-subsystems`** (meta) |
| **A worktree's own copy of `test/test.js` can silently test a different branch's server through the shared Docker container**, and report a clean, confident "Overall: PASS" that means nothing — worse than a skip, because it looks like real verification. Distinct from the already-known `H`-class-skips-when-stack-absent pattern: this is a full-suite false *positive*, not an honest skip. | This close's `feature-magic-carpet` sync, §4 #4 | **New ledger row `2026-09-22-worktree-test-runner-false-positive`** (meta) |
| **`harness-stats.sh`'s per-epic count reads `llms-txt: 4`, not 5** — the same class of measurement gap an open ledger row already names for the *review* form (`review(<slug>):` vs. the documented `review: <slug> — VERDICT`), but on the *story/plan* side: this book's own Planning commit, `plan(llms-txt): story 1 approved…`, follows the exact precedent `nip05-ssrf-guard` set (`plan(nip05-ssrf-guard): …`) — and neither matches `harness-stats.sh:169`'s `^story: ` pattern, so both books' Planning-phase commits are invisible to the cycle-time series. Found by running the retro's own required measurement, not by looking for it. | This close's own `harness-stats.sh` run | **Extended existing ledger row `2026-09-21-review-commit-form-breaks-cycle-time`** with a new finding (c) and a widened title, rather than opening a competing row for the same root cause |
| **The four phase commits briefly landed on local `staging` directly** before being caught and moved to a proper feature branch, mid-Implementation. | Implementer's own commit message (`d228393e`), independently re-verified by Review | **Declined as a new row.** Self-corrected before Review; Review independently confirmed no residue (`staging` == `origin/staging` exactly). Recorded in the epic's `Retired` line for provenance; no generalizable gap found beyond what a careful session already catches by checking `git branch --show-current` before committing. |
| **Sandbox conflict resolution required real semantic understanding** (the Redis-vs-no-Redis session middleware difference on `feature-magic-carpet`), not just textual patching. | This close's `feature-magic-carpet` sync | **Declined as a new row.** This is the expected, inherent difficulty of cherry-picking to a divergent branch, not a process defect — the harness gave no false confidence here; the conflict marker correctly forced a stop-and-look. |
| **Ports to the other flow?** Asked per finding. Both new rows are flow-agnostic: a Direction-mode run syncing to an old sandbox would hit the identical missing-subsystem gap, and a Direction-mode agent running a worktree's inherited test file would hit the identical false-positive risk — arguably *more* dangerous there, since there's no human in the loop to notice the suspiciously-clean result the way this close did. | Retro step 7 | **Declined** — no port needed, the findings already generalize; flagged in both new rows' text rather than a separate entry. |
