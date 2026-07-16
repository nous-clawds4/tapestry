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
