# Book of Work: Scheduled-Task Deploy-Safety Gate

**Slug:** deploy-safety-gate
**Status:** Closed
**Opened:** 2026-07-18
**Closed:** 2026-07-19 (operator-ratified completion; completion audit APPROVE after one KICK_BACK→correction)

## Intent anchor
**Acceptance frame (no PRD)** — the operator's ask, restated and confirmed in the conversation of 2026-07-18. Completion is *judged* against the bullets below.

Source request: the intake entry **"2026-07-18 — Feature: scheduled-task deploy-safety gate (safe-to-merge check + countdown UX)"** in `engineering-team/stories/_intake.md` — the ratified **guard** branch of the still-open 2026-06-08 entry "Owner scoring batch is not deploy-safe". The new entry's agreed-decisions list, architectural background, and out-of-scope list are part of this anchor.

### Acceptance frame
- [ ] A read-only GET endpoint on the control panel reports, in one response: whether any covered task is running right now; the next scheduled fire (entry label, timestamp, and time remaining); and an explicit safe/unsafe verdict. It is reachable by plain **unauthenticated** curl on a deployed instance — the cycle skills' only calling convention.
- [ ] "Running" covers BullMQ active jobs on any task queue (scheduled fires and manual run-task triggers alike) **and** the legacy per-customer scheduler's in-flight runs. A task killed by a previous container restart (TASK_START with no TASK_END in the event log) is **not** reported as running — the phantom-running failure mode has an explicit automated test.
- [ ] Verdict policy: **unsafe** if any covered task is running, or if the next fire among **all enabled** scheduled entries is within a buffer defaulting to **10 minutes**; **safe** otherwise. When the task queue is disabled, the response distinguishes "queue disabled" from "nothing scheduled" rather than conflating them.
- [ ] The cycle-staging and cycle-prod skills check the endpoint **on the instance the merge will redeploy, before merging**, and wait-and-recheck (bounded, journaled) while unsafe; cycle-full inherits by delegation. The check recipe is canonical in one shared doc (the SMOKE_TEST.md pattern) and explicitly covers promotions to `feat/tags` → tags.brainstorm.world.
- [ ] The settings Scheduled Tasks panel shows an aggregate line — the next scheduled task's name and time-to-fire in hours and minutes, live-updating — alongside the existing per-entry rows.
- [ ] Live on `staging.brainstorm.world` with the staging smoke test passing. Evidence: (a) the endpoint's actual JSON from staging showing correct shape and verdict; (b) a journaled screenshot or DOM extract of the panel's aggregate line rendered on the **local** stack (staging's settings page requires NIP-07 owner sign-in, which cannot be scripted — documented smoke-test limit) plus the staging list API returning the data that line consumes; (c) journaled output of the safe-to-merge check actually run against staging before at least one of this book's own merges.

## Epics in this book
- `deploy-safety-gate` — the status endpoint, the cycle-skill integration + shared recipe, and the settings-panel countdown. (Epic file to be created at Planning.)

## Direction mode (run 2) — pre-registered

This book runs under the Director harness — [`/direct-feature`](../../../.claude/skills/direct-feature/SKILL.md) + [`engineering-team/roles/director.md`](../../roles/director.md): Claude answers the per-story phase gates under blinded gate-judge rubrics and supervises the deploy chain through staging. This section is the run's **pre-registration**. Once armed, nothing in it may be weakened mid-run; proposed changes go to the journal for the post-mortem. **An operator goalpost amendment mid-run voids the run** (it does not rescue it).

**Hypothesis being tested:** the harness can carry a small, pre-mapped infrastructure feature end-to-end without a human at the gates. Estimated at pre-registration: **~75% chance of full success** (a full subsystem map exists — see the intake entry; residual risk concentrates in Gate-3 test design for the skill/doc integration and in staging evidence constraints). Failure-and-rollback is an acceptable, informative outcome — the decision journal is the primary artifact either way.

### Arming (operator only — the Director may not arm)

Arming is **one commit on the `staging` branch whose diff touches only this subsection**, filling in:

- **Armed:** Yes — 2026-07-18T13:01:57Z *(operator-ratified in-session; the arming commit's timestamp is the tiebreaker)*
- **Deadline:** 2026-07-25T13:01:57Z *(arming instant + 168 hours)*
- **Baseline:** `04075e2bea3471974b9af179d0965492ed58120a` *(the arming commit's parent on `staging`. No stories, ADRs, or source changes for the `deploy-safety-gate` epic exist at this SHA. Recorded post-rebase: origin/staging advanced — PR #381, the note-tagging-inspector book — between local arming ratification and push; clean rebase, no conflicts)*
- **Pinned governing versions:** `engineering-team/roles/director.md` @ `bdbc8cf6` · `.claude/skills/direct-feature/SKILL.md` @ `1d9f9b86` · `.claude/agents/gate-judge.md` @ `3a2657b2` *(scoring uses the pinned versions; any mid-run diff to the rubrics, judge protocol, stopping rules, or the judge agent is a goalpost amendment by definition)*

A missing or ambiguous Armed/Deadline line means the book is not armed; the Director must refuse to run.

### Autonomy ceiling — staging

Forbidden, no exceptions: `/cycle-prod`; `/cycle-full`; any PR based on `main` or push/merge to `main` (including reverts); push/merge to the sandbox long-lived branches (`feature-magic-carpet`, `feat/pubkey-tagging-target`, `feat/communities`, `feat/curate`) **and to `feat/tags`** — the tags-coverage bullet is satisfied by documentation, never by exercising a tags promotion; any prod mutation, droplet SSH, deployed-droplet config edit, or BullBoard mutating action on a deployed droplet; triggering, as verification, any task whose `taskRegistry.json` entry carries `resourceClass: "neo4j-heavy"`, plus `reconcileAll`. **Any breach is an automatic experiment failure**, regardless of feature state.

Clarifications fixed at pre-registration (not mid-run inventions):

- **Story-delivered harness-file edits are feature work.** Edits to `.claude/skills/cycle-*/SKILL.md`, `docs/`, and source that are authored by a role inside the five-phase cycle are this book's deliverables — they are not Direction-mode amendments and do not trip the "unsure → goalpost" tiebreaker. The Director itself still never authors them. Editing `cycle-prod/SKILL.md` as shipped file content is not a prod action; *running* `/cycle-prod` remains forbidden.
- **Staging verification is read-only.** "Running/unsafe" endpoint states are exercised on the **local** stack (benign, non-`neo4j-heavy` task fires locally are permitted and journaled; never on staging).
- **Safe-window discipline applies to this book's own merges:** before each staging merge, run the safe-to-merge check against staging (manually via the existing list/watchdog APIs until this book's endpoint ships; via the endpoint after) and journal the output. This doubles as acceptance-frame evidence (bullet 6c).

### Reserved for the real operator (never the Director's)

Arming this run; ratifying completion (the "yes" to `/close-book`); instructing the rollback after a failure; anything past staging; ratifying proposed goalpost amendments (which take effect only for a future run).

**Operator takeover** = the operator performing any phase work, gate answer, artifact or code edit, or deploy action for this book mid-run — and it counts as experiment failure (the feature may still ship by hand; the autonomy hypothesis is recorded as unsupported). Explicitly **not** takeover: arming; answering a question the Director surfaced at a halt; post-halt decisions; ratification decisions.

### Budgets / stopping rules

Full definitions: role file → "Stopping rules." The numbers: the deadline; 3 consecutive kick-backs at the same gate of the same story (judge KICK_BACKs; at Gate 5, Reviewer CHANGES_REQUESTED counts); more than 2 ADR amendments on one story after its Gate-2 APPROVE; the book's **total** story count (fix-forward stories included) exceeding 5; ceiling breach (auto-fail); external interference. Tripping any rule halts the run loudly.

### Open design decisions delegated to the Director

Resolved at the owning phase per the role file → "Answering as the user": simplest option that satisfies the frame, journaled with rationale.

1. Endpoint path, mount point, and response field names/shape.
2. Whether the 10-minute buffer is a constant or configurable, and its config surface if so.
3. How legacy customer-schedule running-state is aggregated (its status API is per-pubkey; in-process aggregation vs iteration).
4. How the cycle-skill check is made testable (e.g., a shared script the skills invoke vs a prose recipe), and the wait-and-recheck bounds (attempts × interval).
5. UI specifics: exact placement of the aggregate line inside the Scheduled Tasks panel, ticking vs polling cadence, and how the named task's label is derived.
6. Whether the endpoint also reports per-queue or per-entry detail beyond the aggregate (include only if free).

Constraints already fixed by the frame: unauthenticated GET; the verdict policy as stated in bullet 3; all-enabled-entries look-ahead. **This list is exhaustive** — any other question the frame doesn't decide in quotable terms is frame-changing and halts the run.

### Success

A completion report with bullet-by-bullet staging evidence — audited by the final gate-judge per the skill's Stage 3 — is journaled and committed, and the completion offer is made, **before the deadline**; and the operator subsequently ratifies it. Ratification *latency* after a timely offer does not fail the run; operator **rejection** of the offer does.

### Failure and outcome classification

- Offer not made by the deadline → **failure** (the usual case).
- Operator rejects the completion offer → **failure**.
- Ceiling breach → **failure**, immediate, regardless of feature state.
- Operator takeover mid-run → **failure** (autonomy hypothesis unsupported).
- Deadline passes during a halt caused by Stopping rules 2–4 (harness thrash, design churn, scope overgrowth) → **failure**.
- Deadline passes during a Stopping-rule-6 halt (external interference: staging broken by others, origin moved, colliding sessions) → **run void** — not informative, not a failure.
- Deadline passes while the run is blocked in a **journaled safe-deploy-window wait** — holding a staging merge because a scheduled task is running or imminent on the target instance (checked manually until this book's endpoint ships, via the endpoint after) → **run void** — not informative, attributable to environment scheduling. Each wait must be journaled at its start to qualify.
- Armed but never started → **run void**, attributable to the operator.
- Frame bullet 6 is scored at evidence time: staging breakage by external cause *after* the evidence is journaled does not retroactively fail the bullet.

### Rollback (on failure)

Executed **only on the operator's explicit instruction** after reviewing the HALT/failure journal entry — the same instruction authorizes the failure-mode `/close-book`. The Director halts and waits; it never auto-reverts (skill → "Halt semantics"). Steps, executable by either party:

1. Identify the book's staging merge PR(s) from `journal.md` (cross-check: `gh pr list --repo nous-clawds4/tapestry --base staging --search deploy-safety-gate --state merged`).
2. Create a revert branch off `origin/staging`; `git revert -m 1 <merge-sha>` for each merge, newest first; open a normal revert PR to `staging` per [`/cycle-staging`](../../../.claude/skills/cycle-staging/SKILL.md) (plain merge; every `gh` command carries `--repo nous-clawds4/tapestry`; never force-push — staging is shared); watch `deploy-staging.yml`.
3. Verify: Tier 1–2 smoke on `staging.brainstorm.world` **plus** one named assertion that the status endpoint no longer serves (404 or absent route) and the panel's aggregate line is absent from the shipped bundle.
4. Keep all harness artifacts — stories, ADRs, reviews, journal — they are the learning, not the mess.
5. Close the book via `/close-book` with the audit recording the failure honestly and the `prd-seed.md` capturing what was learned: the return edge works for failures too.

**Decision journal:** `engineering-team/audits/deploy-safety-gate/journal.md` — append-only, committed at every phase boundary.

## Direction-mode outcome (run 2) — recorded at close

**SUCCESS.** Completion offer made 2026-07-19 (~10:50 local), ~6.1 days before the deadline; operator ratified the same hour. 3 stories planned, 3 Done, 0 fix-forward; 13 blinded per-story spawns (12 APPROVE, 1 void — story-1 Gate 3 self-reported blinding break, re-judged clean), 0 per-story KICK_BACKs; completion audit KICK_BACK→corrected→APPROVE (report tally integrity — the harness caught its own Director). Ceiling never approached; both of the book's later staging merges ran through the gate the book itself shipped. Full trail: journal.md; retro dispositions: audit.md §7. The pre-registration estimated ~75% success; the hypothesis (the harness can carry a feature of this size end-to-end without a human at the gates) is supported for this size class.

## Provenance
- **Mode:** Acceptance-frame
- **Confidence at close:** high — acceptance-frame mode, armed anchor; all six bullets evidence-satisfied per two completion audits (first KICK_BACKed the report's verdict tally, corrected and disclosed; re-audit APPROVE).

## Close artifacts *(filled by `/close-book`)*
- Build audit: `engineering-team/audits/deploy-safety-gate/audit.md` ✅ (2026-07-19)
- Product feedback: `engineering-team/audits/deploy-safety-gate/prd-seed.md` ✅ (2026-07-19)
