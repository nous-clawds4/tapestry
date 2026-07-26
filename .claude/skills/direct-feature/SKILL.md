---
name: direct-feature
description: Autonomously direct one pre-registered, Direction-mode book of work end-to-end through the engineering harness — playing the human at the per-story phase gates under blinded gate-judge rubrics, supervising the local → staging deploy chain, and keeping an auditable decision journal. Use this when the operator wants Claude to run a Direction-mode book — they say things like "direct the feature," "run the task-timeline book," "take the wheel on this book," "resume direction." Requires a book.md with an armed `## Direction mode` section. Staging is the hard ceiling — never merges to main, never invokes /cycle-prod or /cycle-full, never ratifies its own book complete. Halts and surfaces on any stopping rule.
---

# Direct: feature

Run one book of work through the Product Owner → Architect → Tester → Implementer → Reviewer cycle and the local → staging deploy chain, with the Director answering the phase gates the human normally answers. The role's behavior — gate rubrics, blinded-judge protocol, stopping rules, journal format — lives in [engineering-team/roles/director.md](../../../engineering-team/roles/director.md); this skill manages the chain and the gates. Read the role file before the first action of every run.

## When to use

- The operator explicitly starts or resumes a Direction-mode run — "direct the feature," "run the book," "resume direction."
- A `book.md` exists under `engineering-team/audits/<book-slug>/` with a `## Direction mode` section whose **Armed** line reads Yes.

## When NOT to use

- Normal feature work with the human at the gates → use `/plan-feature` and the per-phase commands. Direction mode is the documented exception, not the new default.
- The book has no `## Direction mode` section, or it isn't armed → the operator writes/arms it first. Never arm it yourself.
- Protocol-spec / docs-mode work (BIBLE + ADR ratification) → human gates only; ratified spec is socially irreversible.
- Promoting past staging → `/cycle-prod`, run by the human.

## Critical: the autonomy ceiling

Staging is the hard ceiling, and it does not move. Forbidden, no exceptions:

- `/cycle-prod`, and `/cycle-full` (it chains into prod).
- `gh pr create --base main`, merging any PR based on `main`, any push to `main` — including revert PRs against `main`.
- Push or merge to the sandbox long-lived branches (`feature-magic-carpet`, `feat/pubkey-tagging-target`, `feat/communities`, `feat/curate`) — each auto-deploys to a teammate's live droplet.
- Any mutation on `https://tapestry.brainstorm.world`, droplet SSH, in-container config edits on deployed droplets, BullBoard retry/remove/pause actions on deployed droplets, and triggering heavy tasks on staging as "verification" (forbidden set: any `taskRegistry.json` task with `resourceClass: "neo4j-heavy"`, plus `reconcileAll`).

Auto mode does NOT extend the ceiling. A breach — however small — is an automatic experiment failure (Stopping rule 5 in the role file). The cost of stopping to ask is low; the cost of an unauthorized prod-side action is high.

## Critical: gates are answered, never skipped

The harness doctrine — "the user is the gate; do not auto-advance" — still holds in shape: every phase ends at its gate. In Direction mode the Director answers the gate, and only with a blinded `gate-judge`'s APPROVE in hand (Gates 1, 2, 3, 5). A judge KICK_BACK is binding. **Every story runs all five phases and all judged gates regardless of how the request would classify** — the strictness table's bug/refactor shortcuts do not apply in Direction mode, and that includes fix-forward stories. One gate per judge spawn. Two answers are never the Director's: the "yes" that closes the book, and anything past staging. See [engineering-team/roles/director.md](../../../engineering-team/roles/director.md) → "The blinded gate-judge protocol" and "Gate rubrics."

## Procedure

This skill orchestrates Phases 1–5 per story, then `/cycle-local` → `/cycle-staging`, then the completion offer. Each role and phase keeps its own definition; this skill manages the chain and the gates.

### Stage 0 — preflight (start of every session)

1. Read `engineering-team/audits/<book-slug>/book.md` and **fork by mode** — the book carries one section or the other, never both:

   - **Pre-registered (armed):** `## Direction mode (experiment) — pre-registered` present, **Armed: Yes** with a concrete ISO-8601 arming datetime, **Deadline** a concrete ISO-8601 datetime, `**Status:** Open`, deadline not passed. A missing or ambiguous Armed/Deadline line means the book is **not armed** — stop; never infer or compute your own. Re-check the deadline before every gate decision and after every wakeup.
   - **Operational:** `## Direction mode (operational) — goal-derived` present. Resolve eligibility with `GET /api/brain/direction/<goal-slug>` from inside the container (`docker exec tapestry curl …` — host-side brain reads answer 403); [`/cycle-local`](../cycle-local/SKILL.md) owns the local base URL, so derive it there rather than copying a literal. `eligible: true` is required to proceed; any refusal halts — journal it verbatim and surface it. Then run the **terms-mismatch check**: compare the goal's live `deliverable` and `boundary` against the verbatim text recorded in the derived section. **Any difference is a halt** — re-derive only after the operator speaks, under a fresh ratification; never re-derive silently mid-run. Re-run this check on the same cadence the armed mode re-checks its deadline: every preflight, and before every gate decision. If the response reports `boundaryReview.required: true`, judge each step with a fresh blinded judge given **only the two boundary strings**, and halt on `widens`.

     The derived section is **generated**: regenerate it by re-derivation, never by typing into it.
2. Read the tail of `engineering-team/audits/<book-slug>/journal.md` → resume point. First session: verify the arming baseline (the book records the `origin/staging` SHA at arming; confirm no stories, ADRs, or source changes for this book's epic predate it — contamination → halt, run void per the book), then journal a kickoff INFO entry.
3. `git status` clean; `git fetch`; check drift vs `origin/staging`. Cleanly rebasable → rebase; anything else → halt (role file, Stopping rule 6).
4. Scan [docs/](../../../docs/) `*HANDOFF*.md` for `🔴 OPEN` handoffs and `engineering-team/` for in-flight epics touching the same files. Overlap → halt and surface; never entangle.
5. Branch: work on `feat/<book-slug>` off `origin/staging` (create on first session).
6. Baseline: `npm test` green before any new work — record the exact command; Gate 4 reruns it identically. Red baseline → halt; that's not yours to fix silently.

### Stage 1 — per-story cycle (repeat for each story)

Follow the phase workflows in [engineering-team/workflows/](../../../engineering-team/workflows/); spawn each role as its subagent. If a role returns questions instead of its artifact, answer per the role file → "Answering as the user" (journal every answer; product intent only — never designs, names, or code) and continue the *same* agent — don't restart it. Judges are the opposite: one spawn, one reply, never a follow-up.

1. **Planning** — spawn `product-owner` against the intake entry + acceptance frame. **Gate 1:** fresh `gate-judge`; on APPROVE and your own concurrence, approve, commit (`story: <slug>`), journal.
2. **Architecture** — spawn `architect`. **Gate 2:** judged. Commit the ADR, journal.
3. **Test Design** — spawn `tester`; demand the actual failing `npm test` output. **Gate 3:** judged. Commit (`test: failing tests for <slug> (story #<n>)`), journal.
4. **Implementation** — spawn `implementer`. **Gate 4 (mechanical):** run the full Stage-0 baseline command yourself; confirm `git diff <Gate-3 commit>..HEAD -- test/` is empty. Commit (`impl: <slug> (story #<n>, ADR <NNNN>)`), journal.
5. **Review** — spawn `reviewer` (fresh context — never the Implementer's). On PASS the Reviewer flips the story's `**Status:** Done` in the review commit as its standard close-out (`workflows/5-review.md`) — **don't instruct it otherwise.** Commit the review file **regardless of verdict** (workflow 5 rule), journal. CHANGES_REQUESTED → route back to the Implementer (counts as a Gate-5 kick-back). PASS → **Gate 5:** judge audits the review artifact; on APPROVE, **verify the Reviewer's `**Status:** Done` flip is present** in the review commit (a missing flip is a Gate-5 kick-back to the Reviewer — the Director never edits the story file), journal.

### Stage 2 — deploy

1. Local: follow [`/cycle-local`](../cycle-local/SKILL.md) — it owns the local base URL; derive worktree paths, don’t copy literals.
2. Staging: follow [`/cycle-staging`](../cycle-staging/SKILL.md) — push `feat/<book-slug>`, PR to `staging`, plain merge, watch `deploy-staging.yml`, five-tier smoke on `staging.brainstorm.world`. Every `gh` command includes `--repo nous-clawds4/tapestry`.
3. On failure at any point: surface, journal, and fix forward through the per-story cycle — a fix is a story or a kick-back, never a hot patch outside the harness. **Any code change after a story's Gate-5 PASS reopens that story at Implementation: Gate 4 and a fresh Gate-5 review + judge before any redeploy.** Your own commits never author anything outside `engineering-team/audits/<book-slug>/` — CI and deploy config included; those changes come from a role, inside the cycle. Reverts to staging go through a normal revert PR, journaled; never force-push.

### Stage 3 — completion: offer up, never ratify

When every acceptance-frame bullet looks satisfied and verified on staging:

1. Write a completion report: bullet-by-bullet evidence with links — raw smoke outputs, CI run URLs, screenshots/DOM extracts where the frame demands them. **Evidence only — no deadline, budget, or experiment-stakes language anywhere in operator-facing output.**
2. **Final judge:** spawn one last fresh `gate-judge` to audit the completion report bullet-by-bullet against the acceptance frame (inputs: the report, the frame, the raw evidence paths/URLs — no summaries). Its KICK_BACK is binding on making the offer.
3. Journal, commit, then **stop and present to the operator**, verbatim:

> The <book-slug> book looks complete — every acceptance-frame bullet is checked and verified on staging. Ratify and close? (`/close-book`)

Mid-run, you may answer "not yet" to the Reviewer's completion-detection offers — meaning only that bullets remain unsatisfied; a Direction-mode "not yet" **never extends the acceptance frame**. Only the operator ever says "yes." Epic close-out (the `done/` folder moves) is likewise deferred to the operator at book close — the Director never retires epic folders mid-run.

### Halt semantics

Any stopping rule or escalation trigger (role file) → write a HALT journal entry, leave the working tree committed and clean, report the state honestly, stop directing. Don't auto-revert; don't sneak in "one more fix." Rollback after a failure is executed only on the operator's explicit instruction (the book's rollback procedure names the steps).

## Self-pacing (runs span sessions)

Within a session, spawned roles notify on completion — don't poll. Schedule wakeups (dynamic `/loop`) only for genuinely external waits: `deploy-staging.yml` finishes in ~90s once started, so first check ~2 min after merge; idle or overnight blocks, 1200s+. Always journal before sleeping so any future session can resume cold from Stage 0.

## Report

End every working block with:

```
## Direction report — <book-slug>
**Run state:** active | halted | awaiting ratification
**Stories:** <done>/<planned>
**Gates:** <judged> judged, <kick-backs> kick-backs (by gate)
**Deploys:** local <✅|❌|—>, staging PR #<n> <✅|❌|—>
**Frame:** <bullets checked>/<total>
**Budgets:** <deadline remaining; consecutive kick-back counters>
**Next:** <next action, or the decision the operator owns>
```

## Amendments

Operational fixes (a broken command, a missing resume step in this skill's procedural sections) may be made mid-run — commit as `chore: direction amendment — <what>` and journal as INFO. Goalpost changes (criteria, deadline, budgets, ceiling; the role file's rubrics, judge protocol, and stopping rules; `gate-judge.md` — including "clarifications" to any of these) are forbidden mid-run — journal as *proposed*, for the next run, after the operator ratifies. Unsure which it is → it's a goalpost. The book pins the governing SHAs at arming. Full rule: role file → "Amendments — two classes."

## Reference

- [engineering-team/roles/director.md](../../../engineering-team/roles/director.md) — rubrics, judge protocol, stopping rules, journal format
- [.claude/agents/gate-judge.md](../../agents/gate-judge.md) — the blinded judge
- [engineering-team/workflows/](../../../engineering-team/workflows/) — phase definitions (0-intake … 6-book-close)
- [`/cycle-local`](../cycle-local/SKILL.md), [`/cycle-staging`](../cycle-staging/SKILL.md) — the permitted deploy chain
- [docs/SMOKE_TEST.md](../../../docs/SMOKE_TEST.md) — canonical smoke test
- [OPERATIONS.md](../../../OPERATIONS.md) — branches, CI/CD, gotchas
