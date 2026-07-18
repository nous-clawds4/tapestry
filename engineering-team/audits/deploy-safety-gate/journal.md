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
