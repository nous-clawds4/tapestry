# Decision journal — router-stream-tag-filters

Append-only. Every gate decision, judge verdict, answered question, halt, and deviation. Mode: session-run gates under the standing authorization recorded in `book.md` § "Session mode" (not an armed Direction-mode experiment).

## 2026-07-16T02:01:23Z — Book opened at intake

**Story/Phase:** relay-management #2 / Phase 0 (intake)
**Decision:** INFO
**Judge:** n/a
**Why:** Kickoff message routes the triaged 2026-07-15 intake entry into a new book. Opened eagerly per OPEN.md #29 (the sibling book had to backfill). Worktree `feat/router-stream-tag-filters` created off `origin/staging` @ `58314b7c`; node_modules symlinked from the shared checkout; full-suite baseline `npm test` started (differential gate per OPEN.md #27).
**Next:** Mark the intake entry PICKED UP; file the meta-escalation harness-story proposal (session-start digest: 5 open meta rows ≥ threshold 3); commit book-open; spawn Product Owner for Phase 1.

## 2026-07-16T02:05:31Z — Delegated product answers handed to Planning
**Story/Phase:** relay-management #2 / Phase 1 (Planning)
**Decision:** ANSWER
**Judge:** n/a
**Why:** The book delegates exactly three product questions to Planning (frame bullet 4, from prd-seed §7). Answers derived smallest-that-satisfies-the-frame: (1) **per-stream scoping** — tag filters are a per-stream property edited in the stream add/edit UI (the router config is per-stream filter blocks; OPEN.md #25 targets one specific stream). (2) **Preset interplay** — presets remain kinds-only starting points; tag filters are editable on any stream regardless of preset origin; NO new tags-federation preset ships this story (a concept-bound preset would breach the epic's generic-tooling guardrail; the frame requires expressibility, not a preset). (3) **Save/restart** — existing Router Management save/apply→restart semantics unchanged; tag filters are one more field riding them. Carried-over approved defaults from story #1 ("similar feature"): uppercase P/E/A validated like lowercase; duplicate-letter merge+dedupe; bech32 accepted, normalized to hex/coordinate; hex display.
**Next:** Spawn Product Owner for Phase 1 with these answers.

## 2026-07-16T02:15:29Z — Gate 1 (Story) — APPROVE
**Story/Phase:** relay-management #2 / Gate 1
**Decision:** APPROVE
**Judge:** APPROVE (agent aa1dfe825969cab9c) — all rubric items pass; blinding intact (judge notes it read the short book.md whole; no progress/budget state was present in it). AC-1 parity diffed against story #1's ratified rules; concept handle verified against the live graph; intake's implementation hints correctly absent from the story.
**Why:** Judge APPROVE + the story discharges frame bullet 4 explicitly (three delegated questions settled in a "Product decisions" section). Nothing in the artifact contradicts the anchor inputs.
**Next:** Commit phase boundary; spawn Architect for Phase 2 (ADR 0002) with the kickoff's two design cautions (persistent-config semantics; verify live router-config schema, not memory).

## 2026-07-16T02:16:31Z — Stage-0 full-suite baseline recorded
**Story/Phase:** relay-management #2 / pre-implementation baseline
**Decision:** INFO
**Judge:** n/a
**Why:** Full `npm test` at `58314b7c` (clean worktree, symlinked node_modules): Overall FAIL exit=1, 346 PASS / 34 FAIL — the OPEN.md #27 environmental set (live-API tag/pin/TL suites against the stale bind-mounted local stack). Sorted FAIL-name digest saved (scratchpad: baseline-fails.txt) as the differential-gate reference: post-implementation full suite must show no new FAIL names.
**Next:** Phase 2 (Architecture).

## 2026-07-16T02:43:26Z — Gate 2 (ADR) — APPROVE
**Story/Phase:** relay-management #2 / Gate 2
**Decision:** APPROVE
**Judge:** APPROVE (agent a46e478a7ff3e3272) — all rubric items pass; blinding intact. Judge re-verified every file:line citation against source, re-ran the concept-graph orientation calls, swept all router-touching ADRs for conflicts (none), and independently reproduced the decisive evidence in the container (unknown filter key and multi-char tag key each hard-fail the whole router config).
**Why:** ADR 0002 (Option A) honors the kickoff's binding constraints: tagFilterValidation.js extended not forked; settled product decisions not reopened; the router-schema question answered with live-binary evidence in both directions rather than memory. The sanitizer sub-decision (whitelist = deployed parser's closed vocabulary, not UI capability) is the load-bearing design move — it satisfies AC-2's byte-compat guard AND closes a real crash-loop hole the evidence exposed. Ledger candidate noted for ship time: pre-existing unescaped urls/plugin interpolation in generateConfig (ADR Consequences).
**Next:** Commit ADR boundary; spawn Tester for Phase 3.

## 2026-07-16T03:24:34Z — Gate 3 (Test plan + failing tests) — APPROVE
**Story/Phase:** relay-management #2 / Gate 3
**Decision:** APPROVE
**Judge:** APPROVE (agent a7fd36877791f0238) — all rubric items pass. Judge ran both the story suite ({"pass":3,"fail":18}, every failure a clean feature-missing assertion; probed exports verified absent) and the full suite (only other FAILs = the 34 documented OPEN.md #27 environmental failures, byte-matching the plan's verification block). Disclosure: judge's own Read of book.md overshot the frame section into "Epics in this book"/"Session mode".
**Why:** Standing on the APPROVE despite the disclosed over-read: the overshoot exposed no journal/deadline/budget/queue state (none exists in book.md); the only progress-adjacent fact ("single-story book") is already stated in the acceptance frame's "Done looks like" line the judge was entitled to read. Voiding is reserved for leaks of the prohibited categories; judged not met. Coverage: 21 tests, all 5 ACs mapped, ADR edge cases (byte-identity, empty-kinds, garbage keys, hand-edited-key survival, exact-key removal, insertion order) all present; two conscious trade-offs (no browser automation for AC-1 UX; no live restart for AC-3) documented with backstops — AC-1's core rides the executed sibling validation suite; AC-3's live loop lands in the Reviewer's phase.
**Next:** Commit Gate-3 boundary (the test-weakening diff anchor), then spawn Implementer for Phase 4.

## 2026-07-16T04:00:30Z — Gate-4 pre-check: sibling-suite collision — route to Architect (ADR amendment #1)
**Story/Phase:** relay-management #2 / Phase 4 (Implementation) → Architecture (amendment)
**Decision:** KICK_BACK (to Architecture, scoped)
**Judge:** n/a (mechanical pre-check, mine)
**Why:** Implementation makes the story suite green (21/21) with zero test-file changes and the 34 environmental FAILs byte-identical to baseline — but the SIBLING suite `test/sync-panel-tag-filters.test.js` regressed 20/20 → 18/2: S1 (`:242` first-match `/<TagFilterEditor[\s\S]*?\/>/` now hits StreamEditor's new `disabled={false}` instance, earlier in the file) and S3 (`:258` file-global `indexOf('Tag Filters')` now finds StreamEditor's label before the sync panel's 'Authors'). Both are single-occurrence assumptions colliding with a legitimate second usage of the shared component in the same file; the sync panel's own wiring is unchanged (its instance still `disabled={running}`, its group still between Authors and Time Range). CI's stack-free job runs this suite → no path to staging without a test/ change, which Gate 4 prohibits absent ratification. Alternatives at hand: (a) scope the sibling assertions to the owning component region (test-strengthening); (b) relocate StreamEditor below NegentropySync in the file (hoisting-inert but layout-by-regex-appeasement, leaves the landmine armed). Routed to the Architect to ratify the resolution as an ADR 0002 amendment. **Stopping-rule bookkeeping: ADR amendment #1 on this story after Gate-2 APPROVE (halt at >2).**
**Next:** Architect amendment → Tester implements it (test/ is the Tester's lane) → my Gate-4 verification with the ratified test-diff exception documented.

## 2026-07-16T04:08:03Z — ADR 0002 Amendment 1 ratified (option a: region-scope sibling assertions)
**Story/Phase:** relay-management #2 / Architecture (amendment #1)
**Decision:** APPROVE
**Judge:** n/a (amendment audited at Gate 5 with the full diff; Gate-2 judge not re-run — the amendment changes test scoping, not the design, and Gate 5's rubric covers the review of test changes)
**Why:** Architect chose region-scoping (a) over file-reorder (b): fixes the root cause (latent single-occurrence assumption invalidated by exactly the reuse ADR 0002 mandates), strengthens rather than weakens (eliminates file-global false-PASS modes; loud-fail marker checks; binding must-still-fail mutation spot-checks), and avoids making source layout load-bearing for a sibling suite's regexes. Blast radius pinned: test/sync-panel-tag-filters.test.js S1/S3 + one helper; optional ratified mirror onto router-stream suite's file-global assertions; zero source changes; ADR 0001 unaffected. Vite build independently verified clean (exit 0). Amendment count: 1 of the >2 halt threshold.
**Next:** Commit amendment; Tester implements the scoped edit per the amendment's verbatim instruction.

## 2026-07-16T04:44:24Z — Environment change mid-Gate-4: session interrupted; Docker daemon down
**Story/Phase:** relay-management #2 / Gate 4 (mechanical)
**Decision:** INFO
**Judge:** n/a
**Why:** The coordinating session was interrupted and resumed; the first Gate-4 full-suite rerun died mid-run (no EXIT sentinel), and on resume the Docker daemon itself is down (`docker ps` → daemon socket absent; `:7778` refuses) — the stack-up environmental baseline (34 OPEN.md-#27 FAILs) is no longer locally reproducible. Not restarting shared infra unbidden. Gate-4 test evidence therefore composes as: (1) implementer run2 — full suite, stack up, post-implementation: FAIL names byte-identical to the Stage-0 baseline (comm diff empty both ways, verified by the coordinator), story suite 21/21; (2) the amendment since run2 is test-only — source checksum-verified unchanged by the Tester, and the coordinator's own `git diff 6479715a..HEAD -- test/` audit shows scoping-only edits to the two ratified files; (3) post-amendment targeted runs: sibling 20/20, story 21/21, five must-still-fail mutation spot-checks; (4) the interrupted rerun's covered portion (deep into the live-API section, stack up): ZERO new FAIL names vs baseline; (5) now running the full suite stack-free — which mirrors the CI `stack-free` job exactly (plain `npm test`, live suites skip on stack absence) and must be FULLY clean, no environmental allowance; (6) vite build clean (exit 0). The kickoff's binding gates: story suite ✓, differential baseline ✓ (1+2+3+4), CI stack-free — mirrored locally by (5) and enforced again on the PR.
**Next:** Await stack-free run; if clean, Gate 4 APPROVE; then Phase 5 (Reviewer).

## 2026-07-16T04:45:07Z — Gate 4 (Implementation, mechanical) — APPROVE
**Story/Phase:** relay-management #2 / Gate 4
**Decision:** APPROVE
**Judge:** n/a (mechanical gate — coordinator verifies per rubric)
**Why:** (1) Full suite clean on the binding stack-free gate, run end-to-end by the coordinator: Overall PASS exit 0, zero FAIL lines, sibling suite 20/20, story suite 21/21, 242 skips = live-API suites skipping on stack absence (CI-mirror: plain `npm test`, same command as CI's stack-free job). (2) Stack-up differential satisfied by the prior-entry evidence chain (run2 byte-identical FAIL set + 0 new FAIL names in the interrupted rerun's covered portion). (3) `git diff 6479715a..HEAD -- test/` contains exactly ADR 0002 Amendment 1's ratified scoping — two files, helpers added, five assertions re-scoped, every predicate and message byte-identical, nothing removed or loosened (audited line-by-line). (4) No concept definitions changed — no firmware reinstall required. (5) Commit convention: `impl: router-stream-tag-filters (relay-management #2, ADR 0002)`. (6) Vite build clean (exit 0). (7) Implementer deviation handling: the sibling-suite collision was routed to the Architect (amendment #1, ratified) rather than absorbed; the read-card format choice sits within the ADR's non-normative "e.g." latitude and is recorded in the story's Deviations section for the Reviewer.
**Next:** Phase 5 — spawn Reviewer; then Gate-5 blinded judge on the review.

## 2026-07-16T05:05:32Z — Gate 5 (Review audit) — APPROVE; story Done
**Story/Phase:** relay-management #2 / Gate 5
**Decision:** APPROVE
**Judge:** APPROVE (agent a4d7ba0817316dc3b) — blinding intact; all rubric items pass. Judge independently re-ran the full stack-free gate (reproducing the Reviewer's output down to the single-FAIL-string forensic detail), spot-checked every cited file:line, verified the amendment diff byte-level, and mutation-tested the re-scoped sibling assertion (drop disabled={running} → S1 fails 19/1; revert → 20/20). Judge highlights the review's honest handling of AC-3's unexercised live restart loop (disclosed, not papered over).
**Why:** Reviewer PASS (review c2d2d539, story flipped Done in the same commit, exactly two files) + judge APPROVE on top of my own Gate-4 evidence. Kick-back tally for this story, final: Gate-5 zero; one ratified ADR amendment total. Reviewer's four non-blocking findings dispositioned: 1–3 → OPEN.md #31 (pre-existing hardening trio, one bounded story); 4 → staging smoke plan carries an explicit note on the save→restart round-trip (see next entry).
**Next:** Ship — /cycle-staging semantics from the worktree branch; then staging smoke; then final report + book-close OFFER to the operator (never self-ratified).

## 2026-07-16T05:13:00Z — Shipped to staging: PR #361 merged, deploy green, five-tier smoke clean
**Story/Phase:** relay-management #2 / staging deploy gate
**Decision:** INFO
**Judge:** n/a (operational gate — coordinator runs it; the kickoff pre-authorized /cycle-staging on review PASS)
**Why:** PR #361 (feat/router-stream-tag-filters → staging) merged at 2026-07-16T05:07:26Z, merge 48b1550e; CI stack-free green (22s); deploy-staging run 29473065662 succeeded. Smoke on staging.brainstorm.world: Tier 1 stable after 3×2s polls; Tier 2 all pages/APIs 200 + search hits non-zero; Tier 3 — served bundle index-CUstfBx5.js carries the new stream-editor hint (1 hit) and 'Tag Filters' went 1→2 (both panels), router-status 200 with the router process RUNNING post-restart and all 7 preset streams byte-intact (dcosl filter unchanged — AC-2's real-world byte-compat confirmation); Tier 4 in-app browser: /tapestry/settings/relays renders console-clean with the correct owner NIP-07 auth gate (authenticated editor visuals not exercisable without sign-in — documented smoke limit); Tier 5 — router-presets 200; sibling count endpoint echoes #z through the rebuilt filter with correct local discrimination (0 for a nonsense handle) and dcosl's known NIP-45-unsupported remote note. Deliberately NOT mutated: no stream saved/edited on staging (read-only smoke discipline; the live save→restart→round-trip exercise is offered to the operator — review Finding 4).
**Next:** Report to operator. Reserved for the operator: book-close ratification (acceptance-frame bullets look satisfied — the close is OFFERED, not run), prod promotion, tags-branch decision, optional live round-trip on staging. This journal entry + any close artifacts ride a docs-only follow-up PR (the #23-pattern); branch + worktree retained meanwhile (avoids the #12 stranded-close failure mode).
