# Book of Work: Verified Muters

**Slug:** verified-muters
**Status:** Open
**Opened:** 2026-06-21
**Closed:** —

## Intent anchor
**Acceptance frame (no PRD)** — the operator's ask, restated and confirmed at kickoff. Completion is *judged* against the bullets below.

Source request: the intake entry **"2026-06-21 — Feature: Verified Muters profile metric (mirror of Verified Followers)"** in `engineering-team/stories/_intake.md`. That entry's architectural background (the mute data layer already exists end-to-end), its confirmed design decisions, and its out-of-scope list are part of this anchor.

The feature: add a fifth point-of-view-filtered metric — **"Verified Muters"** — to the user profile counts row (alongside Following / Verified Followers / Hops / Verified Reporters), positioned **after Hops and before Verified Reporters**, with a **visual line break** separating the "good" indicators (Following, Verified Followers, Hops) from the "bad" ones (Verified Muters, Verified Reporters). It links to a list page (parallel to `/user/:pubkey/followers`) showing which verified users have muted the observed account, with the **same columns as the Verified Followers list** (no report-specific columns). Modeled on Verified Followers: same verification bar, neutral badge styling (no alarm).

### Acceptance frame
- [ ] (1) The profile counts row shows a new **"Verified Muters"** metric positioned **after Hops and before Verified Reporters**. Operationally: on a profile with ≥1 verified muter, the counts row renders a "Verified Muters" item between the Hops item and the Verified Reporters item.
- [ ] (2) The "Verified Muters" count is determined by the **same verification bar** used for Verified Followers/Reporters (the existing GrapeRank influence cutoff for muters); the badge number equals the number of rows on its linked list page.
- [ ] (3) The metric is a **clickable link** to a list page at its own bookmarkable URL (parallel to `/user/:pubkey/followers` and `/user/:pubkey/reporters`) showing which verified users have muted the observed account.
- [ ] (4) The list page shows the **same columns as the Verified Followers list page** — it does **not** carry the report-specific columns (no "Report Type", no "Reported" timestamp).
- [ ] (5) The badge renders **neutrally, like Verified Followers** — always a clickable link, with no red alarm icon and no negative/red styling. (Its "bad indicator" status is conveyed only by the line break, not by alarm styling.)
- [ ] (6) A **visual line break** sits between Hops and Verified Muters in the counts row, so the good indicators sit on one line and the bad indicators (Verified Muters, Verified Reporters) wrap to the next. Operationally: at a desktop viewport width where all five would otherwise fit on one line, Verified Muters and Verified Reporters render on a row below Following / Verified Followers / Hops.
- [ ] (7) Owner/House-POV only, matching the existing Verified Followers/Reporters behavior — the `?pov=` param does not alter these counts in this book (same known v1 limitation as the sibling metrics).
- [ ] (8) Live on **staging.brainstorm.world** with the staging smoke test passing — **Tier 4 (rendered UI) mandatory** for this book's final verification, not gap-noteable. Evidence: an authenticated 200 on a profile page showing the "Verified Muters" metric in position (after Hops, before Verified Reporters, with the line break), the metric linking through to a list page that returns rows carrying the **same columns as the followers page** (and NOT the Report Type / Reported columns). Choosing an observed pubkey that actually has ≥1 verified muter for the evidence shot is permitted and journaled.

## Epics in this book
- `verified-muters` — the count (profile badge), the list page + its read path, and the line-break grouping. (Epic file to be created at Planning.)

## Direction mode (experiment) — pre-registered

This book runs under the Director harness — [`/direct-feature`](../../../.claude/skills/direct-feature/SKILL.md) + [`engineering-team/roles/director.md`](../../roles/director.md): Claude answers the per-story phase gates under blinded gate-judge rubrics and supervises the deploy chain through staging. This section is the experiment's **pre-registration**. Once armed, nothing in it may be weakened mid-run; proposed changes go to the journal for the post-mortem. **An operator goalpost amendment mid-run voids the run** (it does not rescue it).

**Hypothesis being tested:** the harness can carry a small, pattern-mirroring feature — one whose data layer already exists and whose closest sibling (Verified Reporters) is already in the tree — end-to-end without a human at the gates. Estimated at pre-registration: **~75% chance of full success** (higher than a from-scratch feature: the mute data pipeline, the `verifiedMuterCount` precompute, and the followers/reporters page template all pre-exist; the work is surfacing + wiring). Failure-and-rollback is an acceptable, informative outcome — the decision journal is the experiment's primary artifact either way.

### Arming (operator only — the Director may not arm)

Arming is **one commit on the `staging` branch whose diff touches only this subsection**, filling in:

- **Armed:** No *(→ `Yes — <ISO-8601 UTC datetime>`)*
- **Deadline:** — *(→ arming instant + 96 hours, as an ISO-8601 UTC datetime; the arming commit's timestamp is the tiebreaker if prose and git disagree. 96h is the recommended window for a feature this small; the operator may set another value at arming.)*
- **Baseline:** — *(→ the `origin/staging` SHA at arming. No stories, ADRs, or source changes for the `verified-muters` epic may exist at that SHA — pre-existing work voids the run. This `book.md` and its `_intake.md` entry are anchor inputs, not epic work, and are expected to be present at the baseline.)*
- **Pinned governing versions:** — *(→ the commit SHAs of `engineering-team/roles/director.md`, `.claude/skills/direct-feature/SKILL.md`, and `.claude/agents/gate-judge.md` at arming. Scoring uses the pinned versions; any mid-run diff to the rubrics, judge protocol, stopping rules, or the judge agent is a goalpost amendment by definition.)*

A missing or ambiguous Armed/Deadline line means the book is not armed; the Director must refuse to run.

### Autonomy ceiling — staging

Forbidden, no exceptions: `/cycle-prod`; `/cycle-full`; any PR based on `main` or push/merge to `main` (including reverts); push/merge to the sandbox long-lived branches (`feature-magic-carpet`, `feat/pubkey-tagging-target`, `feat/communities`, `feat/curate`); any prod mutation, droplet SSH, deployed-droplet config edit, or BullBoard mutating action on a deployed droplet; triggering, as verification, any task whose `taskRegistry.json` entry carries `resourceClass: "neo4j-heavy"`, plus `reconcileAll`. **Any breach is an automatic experiment failure**, regardless of feature state.

Note for the run: the profile counts endpoint's verified-muter live-fallback is a count-only Neo4j query bounded by the existing query deadline; surfacing the badge must not introduce or trigger any heavy/batch recompute as "verification." Staging smoke is read-only page loads.

### Reserved for the real operator (never the Director's)

Arming this run; ratifying completion (the "yes" to `/close-book`); instructing the rollback after a failure; anything past staging.

**Operator takeover** = the operator performing any phase work, gate answer, artifact or code edit, or deploy action for this book mid-run — and it counts as experiment failure (the feature may still ship by hand; the autonomy hypothesis is recorded as unsupported). Explicitly **not** takeover: arming; answering a question the Director surfaced at a halt; post-halt decisions; ratification decisions.

### Budgets / stopping rules

Full definitions: role file → "Stopping rules." The numbers: the deadline; 3 consecutive kick-backs at the same gate of the same story (judge KICK_BACKs; at Gate 5, Reviewer CHANGES_REQUESTED counts); more than 2 ADR amendments on one story after its Gate-2 APPROVE; the book's **total** story count (fix-forward stories included) exceeding 5; ceiling breach (auto-fail); external interference. Tripping any rule halts the run loudly. (Expected decomposition is ~2 stories — a backend read-path/count story and a frontend page/badge/line-break story; the cap of 5 leaves headroom for fix-forward, not for scope growth.)

### Open design decisions delegated to the Director

The acceptance frame fixes the product behavior tightly (mirror Verified Followers; neutral badge, no alarm; line break between Hops and Verified Muters; the same columns as the Verified Followers list with no report-specific columns; owner/House-POV only). The only items delegated to the Director, resolved at Planning per the role file → "Answering as the user" (simplest option that satisfies the frame; **extend the existing Verified Followers page/pattern rather than invent a new one**; journaled with rationale):

- The new list page's **title text, empty-state and loading copy**, and its **default-visible columns + default sort** — chosen to mirror the Verified Followers list page.
- The **URL path segment** for the list page (the frame requires only that it be bookmarkable and parallel to the followers/reporters sub-pages).

**This list is exhaustive** — any other question the frame doesn't decide in quotable terms (e.g. adding a per-POV muter count, adding a muter alarm threshold, changing the existing followers/reporters pages, or any change to mute ingestion) is frame-changing and halts the run.

### Success

A completion report with bullet-by-bullet staging evidence — audited by the final gate-judge per the skill's Stage 3 — is journaled and committed, and the completion offer is made, **before the deadline**; and the operator subsequently ratifies it. Ratification *latency* after a timely offer does not fail the run; operator **rejection** of the offer does.

### Failure and outcome classification

- Offer not made by the deadline → **failure** (the usual case).
- Operator rejects the completion offer → **failure**.
- Ceiling breach → **failure**, immediate, regardless of feature state.
- Operator takeover mid-run → **failure** (autonomy hypothesis unsupported).
- Deadline passes during a halt caused by Stopping rules 2–4 (harness thrash, design churn, scope overgrowth) → **failure**.
- Deadline passes during a Stopping-rule-6 halt (external interference: staging broken by others, origin moved, colliding sessions) → **run void** — not informative, not a failure.
- Armed but never started → **run void**, attributable to the operator.
- Frame bullet 8 is scored at evidence time: staging breakage by external cause *after* the evidence is journaled does not retroactively fail the bullet.

### Rollback (on failure)

Executed **only on the operator's explicit instruction** after reviewing the HALT/failure journal entry — the same instruction authorizes the failure-mode `/close-book`. The Director halts and waits; it never auto-reverts (skill → "Halt semantics"). Steps, executable by either party:

1. Identify the book's staging merge PR(s) from `journal.md` (cross-check: `gh pr list --repo nous-clawds4/tapestry --base staging --search verified-muters --state merged`).
2. Create a revert branch off `origin/staging`; `git revert -m 1 <merge-sha>` for each merge, newest first; open a normal revert PR to `staging` per [`/cycle-staging`](../../../.claude/skills/cycle-staging/SKILL.md) (plain merge; every `gh` command carries `--repo nous-clawds4/tapestry`; never force-push — staging is shared); watch `deploy-staging.yml`.
3. Verify: Tier 1–2 smoke on `staging.brainstorm.world` **plus** one named assertion that the profile page no longer shows the "Verified Muters" metric and its list-page route no longer serves the feature (404 or absent route).
4. Keep all harness artifacts — stories, ADRs, reviews, journal — they are the learning, not the mess.
5. Close the book via `/close-book` with the audit recording the failure honestly and the `prd-seed.md` capturing what was learned: the return edge works for failures too.

**Decision journal:** `engineering-team/audits/verified-muters/journal.md` — append-only, committed at every phase boundary.

## Provenance
- **Mode:** Acceptance-frame
- **Confidence at close:** *(to be filled by `/close-book`)*

## Close artifacts *(filled by `/close-book`)*
- Build audit: `engineering-team/audits/verified-muters/audit.md`
- Product feedback: `engineering-team/audits/verified-muters/prd-seed.md`
