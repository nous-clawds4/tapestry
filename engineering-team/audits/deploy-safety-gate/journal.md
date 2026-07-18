# Decision Journal — deploy-safety-gate (Direction mode, run 2)

Append-only. Entry format: [engineering-team/roles/director.md](../../roles/director.md) → "The decision journal".

## 2026-07-18T13:01:57Z — Book armed; run opens
**Story/Phase:** — / Stage 0 (preflight)
**Decision:** INFO
**Judge:** n/a
**Why:** Operator ratified arming in-session (explicit "Arm it — start the run") at 2026-07-18T13:01:57Z. Baseline `04075e2b`; deadline 2026-07-25T13:01:57Z (the arming commit's timestamp is the tiebreaker per the book — it lands minutes after the ratification instant because origin/staging moved and the batch was rebased; see the rebase entry below). Pre-arming work landed in the same session, before arming, by the session assistant (not the Director): test-repair commit `39936028` restoring the `npm test` baseline to green (Overall PASS, 0 failures, 47 documented skips — the failures were environmental: POV-filter and TA-drift coincidences, OPEN.md #50–#53), ops commit `f4053b8a`, book/intake commit `04075e2b` (SHAs post-rebase). Baseline contamination check: no stories, ADRs, or source for the `deploy-safety-gate` epic exist at the baseline SHA. Handoff scan: four 🔴 OPEN handoffs (communities/B-tag/harness-review/profile-followers) — none touch the scheduler, cycle skills, or settings UI; no overlap. Stage-0 baseline command recorded: `npm test` (Gate 4 reruns it identically).
**Next:** Pre-push safe-window check → push `staging` → watch `deploy-staging.yml` → branch `feat/deploy-safety-gate` → Stage 1 Planning.

## 2026-07-18T13:04:00Z — Pre-push safe-deploy-window check (manual; the gate this book builds does not exist yet)
**Story/Phase:** — / Stage 0
**Decision:** INFO
**Judge:** n/a
**Why:** Per the book's "Safe-window discipline applies to this book's own merges": checked staging.brainstorm.world before the arming push. `GET /api/scheduled-tasks/list` → 0 enabled entries, 0 active timers; `GET /api/task-watchdog/status` → activeTasks: 0. The push-triggered deploy can interrupt nothing. (Doubles as the evidence pattern for acceptance-frame bullet 6c.)
**Next:** Push; watch CI; smoke.

## 2026-07-18T13:12:00Z — origin/staging moved pre-push; clean rebase; arming re-recorded
**Story/Phase:** — / Stage 0
**Decision:** INFO
**Judge:** n/a
**Why:** First push rejected non-fast-forward: PR #381 (the note-tagging-inspector Direction book, tag-event-inspector story #3) merged to staging while this session worked — 10 commits touching src/api/event-tags + profile-tags, its own tests, and UI components; file overlap with this batch was `_intake.md` only (both append; auto-merged clean). Rebased the batch; the arming + journal commits were re-made so the recorded Baseline matches the rebased parent (`04075e2b`) — the ratified Armed instant and deadline are unchanged; pinned governing files were untouched by the incoming commits (SHAs still valid). Before pushing: local stack refreshed with the incoming changes and the full `npm test` baseline re-verified on the combined tree, and the safe-window check re-run.
**Next:** dev-refresh → combined-tree `npm test` → safe-window re-check → push → watch deploy-staging.yml → branch `feat/deploy-safety-gate` → Stage 1 Planning.

## 2026-07-18T13:22:00Z — Stage 0 complete: batch pushed, staging deployed clean, branch created
**Story/Phase:** — / Stage 0 → Stage 1
**Decision:** INFO
**Judge:** n/a
**Why:** Combined-tree `npm test` green post-rebase (Overall PASS, 0 failures — log `baseline-test-6` in session scratchpad). Safe-window re-check immediately pre-push: 0 enabled entries, 0 active tasks. Pushed `8cccfd33..438d34f5` (5 commits: test repairs, OPEN.md #50–#53, book open, arming `ce347488`, journal). `deploy-staging.yml` run 29645858525 exit 0; Tier-1 stability reached in 3 attempts (3×200 after the documented post-deploy 502 window); `GET /api/scheduled-tasks/list` 200 on staging. Branch `feat/deploy-safety-gate` created off `origin/staging` at `438d34f5`.
**Next:** Stage 1, story #1 — spawn `product-owner` against the 2026-07-18 intake entry + acceptance frame (endpoint story first: frame bullets 1–3); then Gate 1 with a fresh blinded judge.

## 2026-07-18T13:40:00Z — Gate 1 APPROVE — story #1 (deploy-safety-status-endpoint)
**Story/Phase:** deploy-safety-gate #1 / Gate 1 (Story)
**Decision:** APPROVE
**Judge:** APPROVE, blinding intact — all rubric items pass; judge independently verified the empty concept footprint against the live graph and the AC↔frame-bullet mapping (bullets 1–3 fully covered, out-of-scope respected).
**Why:** My own read concurs: five externally-testable ACs, one subsystem, implementation vocabulary correctly abstracted (BullMQ/customer-schedule named only in the cited intake entry), ratified decisions carried as requirements. PO raised zero questions — the frame + intake answered everything, as designed.
**Next:** Commit story + epic + intake markers; Phase 2 — spawn architect for ADR 0001 of the deploy-safety-gate epic.

## 2026-07-18T14:00:00Z — Gate 2 APPROVE — ADR 0001 (deploy-safety-status-endpoint)
**Story/Phase:** deploy-safety-gate #1 / Gate 2 (ADR)
**Decision:** APPROVE
**Judge:** APPROVE, blinding intact — all rubric items pass; judge verified ~20 file:line claims against source, independently cleared the closest unlisted ADR (0016 BullBoard gating) for conflict, and confirmed the unauthenticated-by-fall-through and legacy-runs-while-queue-disabled claims in code. One non-blocking defect: the Implementation-notes precedent cite says T17/T18 where the cited file's guards are T3/T4 — carried to the Tester to correct.
**Why:** I concur: Option A (new src/api/deploy-safety/ module, pure computeVerdict core, three live in-process sources, fail-closed introspection) satisfies AC-2's two-source coverage and AC-3's phantom exclusion structurally; the payload contract cleanly feeds stories 2–3; Consequences records real debt (legacy-Map coupling, unauthenticated task names, caller-tunable buffer) instead of hiding it.
**Next:** Commit ADR; Phase 3 — spawn tester (carry the T3/T4 correction and the OPEN.md #43 live-chain registration trap into the brief).

## 2026-07-18T15:05:00Z — Gate 3 verdict VOID — judge self-reported broken blinding
**Story/Phase:** deploy-safety-gate #1 / Gate 3 (Test plan + failing tests)
**Decision:** INFO (verdict void; no gate decision taken)
**Judge:** APPROVE on the merits, self-voided — the judge's read window on book.md overran the acceptance frame into the Direction-mode pre-registration (deadline, hypothesis, ceiling). Spawn prompt was protocol-clean ("read the acceptance frame section only"); the over-read was the judge's own. Per director.md → "Verdict semantics": a broken-blinding APPROVE is void (a KICK_BACK would still bind). Counted toward no stopping rule (not a KICK_BACK).
**Why:** Protocol over convenience — the merits audit was thorough (judge independently reproduced the 23 feature-missing failures and verified live-chain gating), but an APPROVE seen through broken blinding cannot stand. Re-spawning fresh with the book read bounded to the frame's exact lines; no prior findings injected (this is a void re-spawn, not a kick-back re-judge).
**Next:** Fresh Gate-3 judge, corrected prompt.

## 2026-07-18T15:25:00Z — Gate 3 APPROVE (re-spawned judge) — test plan + failing tests, story #1
**Story/Phase:** deploy-safety-gate #1 / Gate 3
**Decision:** APPROVE
**Judge:** APPROVE, blinding intact (bounded frame read worked). Judge reran the suite itself: 23/23 failures, every one feature-missing (module/export/route absent, live 404s), none environmental; independently verified the live-chain gating (term terminates the chain at test/test.js:862), the H6 trigger-safety claim (no resourceClass on refreshApplicabilityLists), and the honest coverage-limit disclosures.
**Why:** I concur. The pure-core seam gives AC-3/AC-4 deterministic coverage; the structural sentinels are all ADR-pinned; the two live-unreachable halves are documented with Reviewer recipes instead of pretended at. The prior void verdict is recorded above; this fresh verdict is the binding one.
**Next:** Commit test design (this commit = the Gate-3 reference for Gate 4's test-diff check); Phase 4 — spawn implementer.

## 2026-07-18T18:20:00Z — Gate 4 PASS (mechanical, Director-verified) — implementation, story #1
**Story/Phase:** deploy-safety-gate #1 / Gate 4 (Implementation)
**Decision:** APPROVE (mechanical gate — no judge, per rubric)
**Judge:** n/a (Gate 4 is Director-verified by design)
**Why:** Verified myself, not from the Implementer's claim: (1) full `npm test` with the identical Stage-0 command — exit 0, zero FAIL lines, deploy-safety-status 23/23, Overall PASS (log gate4-npm-test in session scratchpad); (2) `git diff a570bae2..HEAD -- test/` and the working-tree test/ diff both empty — no test weakened in any intermediate state; (3) firmware n/a (no concept changes, per ADR). Implementer logged four judgment calls in the story's `## Deviations` (fractional bufferMinutes un-rounded; label→taskId fallback; stateKnown:false field omission mirroring the disabled case; enabledEntryCount from config regardless of queue state) — none forced an ADR amendment; the Reviewer audits them. Implementer restarted the local backend to load the module (bind-mount + supervisorctl; journal-noted, local only).
**Next:** Commit impl; Phase 5 — spawn reviewer (fresh context, never the Implementer's).

## 2026-07-18T19:15:00Z — Review PASS — story #1; review committed; Gate 5 judge next
**Story/Phase:** deploy-safety-gate #1 / Phase 5 (Review)
**Decision:** INFO (Reviewer verdict PASS; Gate 5 judgment pending)
**Judge:** pending (fresh judge audits the review artifact next)
**Why:** Reviewer (fresh context) demonstrated every AC with its own commands — including a host-side stack-free exercise of the real AC-5 queue-disabled handler branch, the bufferMinutes 400 matrix, and byte-identical schedule state across repeated calls — ran the full suite three times (23/23 story suite every time; runs 1–2 red from environmental flakes it attributed precisely: the summary-less-chain-suite gap sibling to OPEN.md #43, and Meili/ETL congestion already ledgered as OPEN.md #51), audited all four Implementer deviations as within the ADR (no amendment), and flipped the story Status to Done as its close-out. Two low-severity non-blocking hardening notes recorded in the review. Meta finding for the book-close harvest: ~18 chain-gating suites print no summary line (test/test.js:838-859), so their failure yields all-PASS lines with Overall FAIL — propose an OPEN.md row at close (Director lane keeps me out of OPEN.md mid-run).
**Next:** Commit review + story close-out; spawn Gate-5 judge (bounded frame read).

## 2026-07-18T20:10:00Z — Gate 5 APPROVE — story #1 complete through Review
**Story/Phase:** deploy-safety-gate #1 / Gate 5 (Review audit)
**Decision:** APPROVE
**Judge:** APPROVE, blinding intact (bounded frame read). Judge independently reproduced: 23/23 story suite, the live payload contract, the full bufferMinutes validation matrix, the host-side queue-disabled branch, the secrets/scope/test-diff sweeps, and even the Reviewer's documented environmental flake (same suite, same test, story suite green in the same run). Status-Done flip confirmed in the Reviewer's commit b950fd03. One non-blocking hygiene finding: several citations into the new module drift 3–14 lines (claims all true in code); carry as a fix-note for any future edit to that review, not a kick-back.
**Why:** The review demonstrates rather than asserts, corroborated to an unusual degree. Story #1 (deploy-safety status endpoint) is Done: frame bullets 1–3 satisfied at the local level; staging evidence lands with the Stage-2 merge.
**Next:** Stage 2 — local cycle semantics already satisfied for this server-only story (bind-mounted stack, backend restarted, endpoint live-verified by Reviewer and two judges; no UI to build). Push feat/deploy-safety-gate → PR to staging → manual safe-window check (journaled; bullet-6c evidence) → merge → watch deploy-staging.yml → smoke incl. the endpoint's first staging JSON (bullet-6a evidence). Then story #2 Planning (cycle-skill integration + shared recipe).

## 2026-07-18T16:45:00Z — Stage 2 complete for story #1: merged, deployed, endpoint live on staging
**Story/Phase:** deploy-safety-gate #1 / Stage 2 (deploy)
**Decision:** INFO
**Judge:** n/a
**Why:** Pre-merge safe-window check (journaled evidence, bullet 6c): 0 enabled entries, 0 active tasks. PR #384 merged (d56f9758); deploy-staging.yml run 29652078853 exit 0; Tier-1 stability twice (initial + post-burst, per SMOKE_TEST.md's documented second 502 window). **Bullet 6a evidence:** first staging call of GET /api/deploy-safety/status returned the full ADR contract — {"success":true,"safeToDeploy":true,"verdict":"safe","reasons":[],"bufferMs":600000,"queue":{"enabled":true,"stateKnown":true,"activeCount":0,"activeTasks":[],"schedulerHalted":false},"legacy":{"inFlightCount":0},"schedule":{"enabledEntryCount":0,"nextFire":null}} at 2026-07-18T16:31:40Z. Tier-2: owner/pubkey, relays, auth/status, search 200; get-user-data 504 after 5+ min of retries — **verified pre-existing/external, not a regression: tapestry.brainstorm.world (untouched by this book) 504s identically on the same request**, and this diff's surface (deploy-safety module, customer-schedule export, route registration) does not intersect that path. tags-for-profile for the same very-heavy pubkey also slow post-restart (cold caches at prod scale). Surfacing to the operator in the next report rather than halting: staging is serving, the failure is shared with prod, and Stopping rule 6 does not apply (staging is not broken by external cause — one heavy endpoint is slow on both instances).
**Next:** Story #2 Planning — cycle-skill safe-to-merge integration + canonical shared recipe (frame bullet 4).

## 2026-07-18T21:05:00Z — Gate 1 APPROVE — story #2 (cycle-safe-to-merge-check)
**Story/Phase:** deploy-safety-gate #2 / Gate 1 (Story)
**Decision:** APPROVE
**Judge:** APPROVE, blinding intact (bounded frame read; re-verified the concept-graph claim live). All rubric items pass; judge confirmed the requirement/delegation boundary sits exactly where the pre-registration's delegated decision 4 puts it.
**Why:** I concur — the five ACs pin the consuming behavior (check-before-merge on the right instance, bounded journaled wait, loud stop with operator handoff, delegation-inheritance, single canonical recipe covering tags) without solutioning; sandbox branches correctly out of scope.
**Next:** Commit story + epic slate; Phase 2 — spawn architect for ADR 0002.

## 2026-07-18T22:10:00Z — Gate 2 APPROVE — ADR 0002 (safe-to-merge check script + shared recipe)
**Story/Phase:** deploy-safety-gate #2 / Gate 2 (ADR)
**Decision:** APPROVE
**Judge:** APPROVE, blinding intact. Judge independently verified: the AC quotes against the story, the live concept graph (48 — matching), cycle-staging/prod merge-step claims, cycle-full's inline lists, L5's actual grep surface (localhost-only — public URLs clean), def-paths (skills yes, docs no → L10 CHANGELOG row required on the impl commit), the 30-min kill-timeout grounding, and ADR-0001 contract continuity (bufferMinutes pin-or-state satisfied by stating). Two non-blocking notes: concept-count growth 46→48 same-day (real growth), and a legacy-timeout citation imprecision that the bound sizing doesn't lean on.
**Why:** I concur — Option A makes AC-2/AC-3 properties of tested code rather than per-run transcription, keeps AC-5's single canonical doc, and the 60s×45 bound is sized to the common case with AC-3 as the escape. The approval-stands rule for cycle-prod resolves the interaction I flagged at spawn.
**Next:** Commit ADR; Phase 3 — spawn tester (script behavior via controllable endpoint fixture; doc/skill content assertions; cycle-full negative assertion; live-chain registration; L10 row noted for the impl commit).

## 2026-07-18T23:30:00Z — Gate 3 APPROVE — test plan + failing tests, story #2
**Story/Phase:** deploy-safety-gate #2 / Gate 3
**Decision:** APPROVE
**Judge:** APPROVE, blinding intact (bounded frame read; judge disclosed an incidental `git log -3` exposure — three commit subjects for this epic's prior phases, no deadline/stakes content; disclosure noted, verdict stands). Judge's own standalone run: 0 passed / 16 failed, every failure feature-missing; live-chain term verified in the diff; the AC-1 re-derivation bait (B8) and strike-counter interleaving (B6) singled out as exactly the right traps.
**Why:** I concur. The Tester also proved harness soundness with a throwaway prototype (9 B-tests + C7 green against it, C1–C6 still red on absent doc/skill edits) and filed OPEN.md #58 for a pre-existing summary-display defect found in passing (SKIP misprint can mask fail>0 in older suites' summary lines; gating unaffected).
**Next:** Commit test design (Gate-3 reference commit for story #2's Gate-4 diff check); Phase 4 — spawn implementer (script + doc + three skill edits + L10 CHANGELOG row).

## 2026-07-18T22:05:00Z (local) — Gate 4 (story #2) blocked by a pre-existing zombie test; forensics + baseline repair dispatched
**Story/Phase:** deploy-safety-gate #2 / Gate 4 (mechanical verification)
**Decision:** INFO (gate paused, not failed — blocker is pre-existing baseline debt, not the diff)
**Judge:** n/a
**Why:** Session interrupt killed the Implementer's confirmation run; on resume the Docker VM (colima) was down with a stale disk lock (unclean shutdown), cleared via stop -f. Gate-4 mechanical checks passed clean: test-diff empty since cb85c264, harness-lint clean, L10 CHANGELOG row present, both story suites green (23/23, 16/16). Full suite: exit 1, two failures, both in profile-tags-publish (zero file overlap with the diff — story #2 ships no server code). Forensic chain: (1) overwrite-test failure recovered on standalone rerun — post-boot propagation lag, environmental. (2) typeahead failure is NOT environmental and NOT new: the unclean shutdown rolled Meili back (pool docs vanished; ensureRankedPool self-heal verified working when invoked; target docs verified ranked; def+assertion events verified in strfry), which exposed the real cause — the per-result-type settings gate (854df80c, 2026-06-10) defaults search.resultTypes.tags=false, structurally disabling the tag-match path the test asserts. Since June 10 the test could only skip (Meili congested — every recent green baseline including Stage 0's masked it this way) or fail (Meili healthy, as now). Same conditional-contract class as the four profile-tag-polish tests recast pre-arming; this fifth escaped that sweep because it skipped in the verification runs.
**Handling:** test files are Tester-lane — Tester spawned for a scoped baseline repair (recast to the ratified skip-when-gated pattern; OPEN.md row for the zombie-test class). Commit ordering for auditability: the Tester's repair commits FIRST as `test: baseline repair — …` (new SHA R); story #2's no-test-edits check is then proven as `git diff cb85c264..R^ -- test/` empty at the pre-repair tree plus `git diff R..HEAD -- test/` empty at impl-commit time — the only test/ change between Gate 3 and the impl commit is the attributable Tester-role repair, not Implementer work. Full-suite green (with the documented skip) then becomes the Gate-4 evidence.
**Next:** Tester repair → commit R → full npm test green → impl commit → Gate 4 recorded → Phase 5 Reviewer.

## 2026-07-18T22:40:00Z (local) — Second baseline defect found at Gate 4: NIP-01 tie-break lottery in the overwrite test
**Story/Phase:** deploy-safety-gate #2 / Gate 4 (still paused on baseline)
**Decision:** INFO
**Judge:** n/a
**Why:** Typeahead recast landed (7d6960fd) and skips cleanly; the Gate-4 rerun then failed on exactly one test: profile-tags-publish "overwriting the same d-tag with flipped polarity." Strfry forensics: the surviving event for the latest run's d-tag is the FIRST publish (polarity 1) — the replacement lost. Cause: the test signs both events without explicit created_at ~600ms apart; same-second landings tie on created_at and NIP-01's lowest-id tie-break decides — a coin flip. Explains the fail-in-full-runs/pass-standalone pattern observed across sessions (also failed in yesterday's pre-repair baselines). Unrelated to story #2's diff (no server code). Tester resumed for scoped repair: explicit created_at+1 on the replacement — makes the test's own "later replaces earlier" premise structural instead of a lottery.
**Next:** Repair commit → full npm test green → impl commit → Gate 4 recorded.

## 2026-07-18T23:20:00Z (local) — Gate 4 PASS — story #2 implementation verified
**Story/Phase:** deploy-safety-gate #2 / Gate 4 (Green tests + implementation)
**Decision:** PASS (mechanical, Director-verified)
**Judge:** n/a (Gate 4 is mechanical)
**Why:** Full `npm test` green on my own run (identical Stage-0 command; exit 0, zero FAIL lines, Overall PASS; deploy-safety-status 23/23, safe-to-merge-check 16/16; profile-tags-publish 6/0/1 with the documented conditional-contract skip). Test-integrity proof: the only test/ commits since Gate-3 (cb85c264) are the two attributable Tester-role baseline repairs (7d6960fd typeahead conditional-contract; 387fc8ec created_at tie-break) — `git diff 387fc8ec..HEAD -- test/` empty at impl-commit time; the Implementer touched no tests. harness-lint clean including the L10 CHANGELOG row for the .claude/skills/** edits. The interrupted-then-recovered verification chain (colima stale-lock recovery, Meili rollback forensics, two zombie-test repairs) is journaled in the three preceding entries; both repairs made the baseline MORE deterministic, not looser.
**Next:** Commit impl; Phase 5 — spawn reviewer (fresh context; brief includes auditing the baseline-repair commit separation).

## 2026-07-19T00:15:00Z (local) — Review PASS — story #2; Gate 5 judge next
**Story/Phase:** deploy-safety-gate #2 / Phase 5 (Review)
**Decision:** INFO (Reviewer verdict PASS; Gate 5 pending)
**Judge:** pending
**Why:** Fresh-context Reviewer demonstrated everything: own standalone (16/16) + full suite (exit 0, zero FAIL lines, no flakes this run), own script exercises (safe→exit 0 attempt 1/45; dead port→exactly 3 no-answer strikes→exit 2; bad args→exit 3+usage, three variants), all five ACs verified against the files on disk, ADR sub-decisions 1–9 conformant, both story Deviations audited and accepted, lane separation proven (`git diff 387fc8ec..ffcf0f8a -- test/` empty), harness-lint clean, L10 row well-formed. One non-blocking comment-accuracy note (script line 96 "404 body" — real 404s route through the curl -f branch; behavior identical). Completion detection: bullets 5 (countdown UI) and 6 (staging evidence) remain — no close offer.
**Next:** Commit review + close-out; Gate-5 judge (bounded frame read).

## 2026-07-19T01:05:00Z (local) — Gate 5 APPROVE — story #2 complete through Review
**Story/Phase:** deploy-safety-gate #2 / Gate 5 (Review audit)
**Decision:** APPROVE
**Judge:** APPROVE, blinding intact. Judge reproduced: both test runs (16/16, full suite exit 0 with identical tails), all three script exit-code demonstrations (0 / 3-strike 2 / 3+usage), the grep negatives, lint, the L10 row at CHANGELOG.md:51, the lane-separation diffs, and every cited file:line down to cycle-staging/SKILL.md:147. The review's non-blocking 404-comment finding corroborated as a genuine only-visible-by-reading subtlety.
**Why:** The review demonstrates rather than asserts; nothing diverged under reproduction. Story #2 Done. Frame bullet 4 satisfied at the tree level; staging evidence (bullet 6, incl. 6c's journaled safe-to-merge run) lands at Stage 2 now.
**Next:** Stage 2 — push, PR to staging, then THE FIRST GATED MERGE: run scripts/check-safe-to-merge.sh against staging.brainstorm.world per the new cycle-staging step 4 (the endpoint is live there from story #1); its journal output is bullet-6c evidence. Merge on exit 0, watch deploy, smoke. Then story #3 Planning (settings countdown, frame bullet 5).
