# Book of Work: Unified Task Timeline

**Slug:** task-timeline
**Status:** Open
**Opened:** 2026-06-10
**Parked:** awaiting operator arming — pre-registered 2026-06-10 as the flagship Direction-mode experiment; the two shakedown runs (reputation-info-popup, live-feed) and verified-muters ran first. Arm per §Arming or close as superseded. *(recorded 2026-07-02, harness sweep)*
**Closed:** —

## Intent anchor
**Acceptance frame (no PRD)** — the operator's ask, restated and confirmed at kickoff. Completion is *judged* against the bullets below.

Source request: the intake entry **"2026-05-24 — Feature: unified all-tasks timeline UI (cross-queue past + present + future)"** in `engineering-team/stories/_intake.md`. The raw ask: *"I'd like to have a single, compact timeline that shows all tasks past, present, and future. Ideally one that I can scroll up and down if there is a lot of data on it. Of course, there will need to be a limit on how long we keep tasks in our logs."* That entry's architectural background, data-source enumeration, and out-of-scope list are part of this anchor.

### Acceptance frame
- [ ] One page shows a single chronological timeline of all tasks — past, present, and future — in one view. Operationally: with all filters off and every registered task represented in the data, the page renders without horizontal overflow at a 1280px-wide viewport and the timeline container scrolls vertically when content exceeds it.
- [ ] Past runs come from the task event log; in-flight and queued work from the task queues; upcoming fires from the schedulers — the three sources the intake entry names, merged into one view.
- [ ] The view is filterable, at minimum by task name and by category (category = the `taskCategories` keys in `src/manage/taskQueue/taskRegistry.json`, overriding the intake entry's illustrative list); applying a filter reduces the visible entries.
- [ ] The page is reachable at its own bookmarkable URL on the control panel and gated like other operator surfaces (owner + admin).
- [ ] The page states the time window it covers, so bounded event-log retention is visible rather than silent.
- [ ] BullBoard at `/admin/queues` remains the interactive per-queue surface; the new view is read-only observation — no pause/retry/remove actions.
- [ ] Live on `staging.brainstorm.world` with the staging smoke test passing — Tier 4 (rendered UI) **mandatory** for this book's final verification, not gap-noteable. Evidence: an authenticated 200 on the page URL plus a journaled screenshot or DOM extract showing ≥ 1 item in each of the past, present, and future segments. Seeding present/future with a benign, non-`neo4j-heavy` task fire is permitted and journaled.

## Epics in this book
- `task-timeline` — the unified timeline view: the cross-source data merge plus the operator-facing page. (Epic file to be created at Planning.)

## Direction mode (experiment) — pre-registered

This book runs under the Director harness — [`/direct-feature`](../../../.claude/skills/direct-feature/SKILL.md) + [`engineering-team/roles/director.md`](../../roles/director.md): Claude answers the per-story phase gates under blinded gate-judge rubrics and supervises the deploy chain through staging. This section is the experiment's **pre-registration**. Once armed, nothing in it may be weakened mid-run; proposed changes go to the journal for the post-mortem. **An operator goalpost amendment mid-run voids the run** (it does not rescue it).

**Hypothesis being tested:** the harness can carry a feature of this size end-to-end without a human at the gates. Estimated at pre-registration: **~50% chance of full success**. Failure-and-rollback is an acceptable, informative outcome — the decision journal is the experiment's primary artifact either way.

### Arming (operator only — the Director may not arm)

Arming is **one commit on the `staging` branch whose diff touches only this subsection**, filling in:

- **Armed:** No *(→ `Yes — <ISO-8601 UTC datetime>`)*
- **Deadline:** — *(→ arming instant + 168 hours, as an ISO-8601 UTC datetime; the arming commit's timestamp is the tiebreaker if prose and git disagree)*
- **Baseline:** — *(→ the `origin/staging` SHA at arming. No stories, ADRs, or source changes for the `task-timeline` epic may exist at that SHA — pre-existing work voids the run)*
- **Pinned governing versions:** — *(→ the commit SHAs of `engineering-team/roles/director.md`, `.claude/skills/direct-feature/SKILL.md`, and `.claude/agents/gate-judge.md` at arming. Scoring uses the pinned versions; any mid-run diff to the rubrics, judge protocol, stopping rules, or the judge agent is a goalpost amendment by definition)*

A missing or ambiguous Armed/Deadline line means the book is not armed; the Director must refuse to run.

### Autonomy ceiling — staging

Forbidden, no exceptions: `/cycle-prod`; `/cycle-full`; any PR based on `main` or push/merge to `main` (including reverts); push/merge to the sandbox long-lived branches (`feature-magic-carpet`, `feat/pubkey-tagging-target`, `feat/communities`, `feat/curate`); any prod mutation, droplet SSH, deployed-droplet config edit, or BullBoard mutating action on a deployed droplet; triggering, as verification, any task whose `taskRegistry.json` entry carries `resourceClass: "neo4j-heavy"`, plus `reconcileAll`. **Any breach is an automatic experiment failure**, regardless of feature state.

### Reserved for the real operator (never the Director's)

Arming this run; ratifying completion (the "yes" to `/close-book`); instructing the rollback after a failure; anything past staging; ratifying proposed goalpost amendments (which take effect only for a future run).

**Operator takeover** = the operator performing any phase work, gate answer, artifact or code edit, or deploy action for this book mid-run — and it counts as experiment failure (the feature may still ship by hand; the autonomy hypothesis is recorded as unsupported). Explicitly **not** takeover: arming; answering a question the Director surfaced at a halt; post-halt decisions; ratification decisions.

### Budgets / stopping rules

Full definitions: role file → "Stopping rules." The numbers: the deadline; 3 consecutive kick-backs at the same gate of the same story (judge KICK_BACKs; at Gate 5, Reviewer CHANGES_REQUESTED counts); more than 2 ADR amendments on one story after its Gate-2 APPROVE; the book's **total** story count (fix-forward stories included) exceeding 5; ceiling breach (auto-fail); external interference. Tripping any rule halts the run loudly.

### Open design decisions delegated to the Director

The intake entry's four open Planning questions — retention-window display, default filters, page placement, live vs. poll — are resolved at Planning per the role file → "Answering as the user": simplest option that satisfies the frame, journaled with rationale. Constraint already fixed by the frame: placement must yield a bookmarkable, owner/admin-gated URL. **This list is exhaustive** — any other question the frame doesn't decide in quotable terms is frame-changing and halts the run.

### Success

A completion report with bullet-by-bullet staging evidence — audited by the final gate-judge per the skill's Stage 3 — is journaled and committed, and the completion offer is made, **before the deadline**; and the operator subsequently ratifies it. Ratification *latency* after a timely offer does not fail the run; operator **rejection** of the offer does.

### Failure and outcome classification

- Offer not made by the deadline → **failure** (the usual case).
- Operator rejects the completion offer → **failure**.
- Ceiling breach → **failure**, immediate, regardless of feature state.
- Operator takeover mid-run → **failure** (autonomy hypothesis unsupported).
- Deadline passes during a halt caused by Stopping rules 2–4 (harness thrash, design churn, scope overgrowth) → **failure**.
- Deadline passes during a Stopping-rule-6 halt (external interference: staging broken by others, origin moved, colliding sessions) → **run void** — not informative, not a failure.
- Deadline passes while the run is blocked in a **journaled safe-deploy-window wait** — holding a staging merge because a scheduled task is running or imminent on the target instance (checked via the deploy-safety gate endpoint, or manually until it ships) → **run void** — not informative, attributable to environment scheduling. Each wait must be journaled at its start to qualify. *(Added 2026-07-18, operator-ratified, pre-arming — see the `deploy-safety-gate` book.)*
- Armed but never started → **run void**, attributable to the operator.
- Frame bullet 7 is scored at evidence time: staging breakage by external cause *after* the evidence is journaled does not retroactively fail the bullet.

### Rollback (on failure)

Executed **only on the operator's explicit instruction** after reviewing the HALT/failure journal entry — the same instruction authorizes the failure-mode `/close-book`. The Director halts and waits; it never auto-reverts (skill → "Halt semantics"). Steps, executable by either party:

1. Identify the book's staging merge PR(s) from `journal.md` (cross-check: `gh pr list --repo nous-clawds4/tapestry --base staging --search task-timeline --state merged`).
2. Create a revert branch off `origin/staging`; `git revert -m 1 <merge-sha>` for each merge, newest first; open a normal revert PR to `staging` per [`/cycle-staging`](../../../.claude/skills/cycle-staging/SKILL.md) (plain merge; every `gh` command carries `--repo nous-clawds4/tapestry`; never force-push — staging is shared); watch `deploy-staging.yml`.
3. Verify: Tier 1–2 smoke on `staging.brainstorm.world` **plus** one named assertion that the timeline page URL no longer serves the feature (404 or absent route).
4. Keep all harness artifacts — stories, ADRs, reviews, journal — they are the learning, not the mess.
5. Close the book via `/close-book` with the audit recording the failure honestly and the `prd-seed.md` capturing what was learned: the return edge works for failures too.

**Decision journal:** `engineering-team/audits/task-timeline/journal.md` — append-only, committed at every phase boundary.

## Provenance
- **Mode:** Acceptance-frame
- **Confidence at close:** *(to be filled by `/close-book`)*

## Close artifacts *(filled by `/close-book`)*
- Build audit: `engineering-team/audits/task-timeline/audit.md`
- Product feedback: `engineering-team/audits/task-timeline/prd-seed.md`
