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
