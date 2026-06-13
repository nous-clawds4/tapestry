# Book of Work: Reputation info popup (profile page)

**Slug:** reputation-info-popup
**Status:** Open
**Opened:** 2026-06-14
**Closed:** —

## Intent anchor
**Acceptance frame (no PRD)** — the operator's ask, restated and confirmed at kickoff. Completion is *judged* against the bullets below.

Source request: the intake entry **"2026-06-14 — Feature: Reputation info popup on the profile page (House vs Personalized PoV explainer)"** in [`engineering-team/stories/_intake.md`](../../stories/_intake.md). The raw ask (verbatim): *"Currently, there is an informational popup (an `i` in a circle) that explains what 'Verified' means. I would like a similar informational popup, also an `i` in a circle, associated to the word Reputation, that explains where the reputational scores come from, i.e. that they reflect either the House PoV or the Personalized PoV (whichever is selected)."* That entry's architectural background and out-of-scope list are part of this anchor.

This book is also the first **low-risk shakedown run** of the Direction-mode harness: the intent is as much to exercise the autonomous machinery end-to-end as to ship the popup.

### Acceptance frame
- [ ] On a public user profile page, the **"Reputation" section heading** carries an informational control — a circled "i" (ⓘ) — visually and behaviorally consistent with the existing "Verified" info control already on that page.
- [ ] Activating that control opens a **dismissible popup** (it closes on an explicit acknowledgement button and on dismissing the overlay), matching the existing info-popup interaction pattern.
- [ ] The popup **explains, in plain language, that the reputation scores shown in that section reflect a Web-of-Trust point of view — and that this is either the House point of view (the instance's default) or the viewer's Personalized point of view, depending on which is currently selected.** A general explanation; it need not name which point of view is active in the moment.
- [ ] The explanation is **accurate and bounded** to the reputation scores it annotates: it makes no claim about the separate Following / Verified Followers / Verified Reporters counts elsewhere on the page (which derive from different sources).
- [ ] The change is **additive and presentational only**: no change to how reputation scores are computed, fetched, namespaced by point of view, or which scores display. The Reputation grid's existing data path (the Meilisearch document fetch and the trust-metrics grid) stays untouched; with the new control removed the page behaves exactly as before. *(This is the regression boundary that keeps the run clear of the open profile-followers follow-ups on the same file — see the intake entry's out-of-scope note.)*
- [ ] Live on `staging.brainstorm.world` with the staging smoke test passing. **Tier 4 (rendered UI) evidence is mandatory** for this book's final verification, not gap-noteable: an authenticated 200 on a profile URL plus a journaled screenshot or DOM extract showing the ⓘ control beside "Reputation" and the opened popup containing both the **"House"** and **"Personalized"** point-of-view wording.

## Epics in this book
- `reputation-info-popup` — the profile-page Reputation explainer popup. (Epic file to be created at Planning.)

## Direction mode (experiment) — pre-registered

This book runs under the Director harness — [`/direct-feature`](../../../.claude/skills/direct-feature/SKILL.md) + [`engineering-team/roles/director.md`](../../roles/director.md): Claude answers the per-story phase gates under blinded gate-judge rubrics and supervises the deploy chain through staging. This section is the experiment's **pre-registration**. Once armed, nothing in it may be weakened mid-run; proposed changes go to the journal for the post-mortem. **An operator goalpost amendment mid-run voids the run** (it does not rescue it).

**Hypothesis being tested:** the harness can carry a small, frontend-only, additive UI feature end-to-end without a human at the gates. This is a deliberately low-risk first Direction-mode run chosen to exercise the machinery on a well-understood change (it clones the established `VerificationInfo` ⓘ-popup pattern and is testable via the existing `test/test.js` source-sentinel precedent, not the broken Playwright harness). Estimated at pre-registration: **~80% chance of full success**. Failure-and-rollback is an acceptable, informative outcome — the decision journal is the experiment's primary artifact either way.

### Arming (operator only — the Director may not arm)

Arming is **one commit on the `staging` branch whose diff touches only this subsection**, filling in:

- **Armed:** No *(→ `Yes — <ISO-8601 UTC datetime>`)*
- **Deadline:** — *(→ the arming instant plus a window of the operator's choosing, as an ISO-8601 UTC datetime; the arming commit's timestamp is the tiebreaker if prose and git disagree. The task-timeline precedent used +168 h; for a feature this small +48–72 h is ample while still tolerating CI waits / a sleeping laptop)*
- **Baseline:** — *(→ the `origin/staging` SHA at arming. No stories, ADRs, or source changes for the `reputation-info-popup` epic may exist at that SHA — pre-existing work voids the run. The book file and the intake entry are pre-registration setup, not epic work, and do not count as contamination)*
- **Pinned governing versions:** — *(→ the commit SHAs of `engineering-team/roles/director.md`, `.claude/skills/direct-feature/SKILL.md`, and `.claude/agents/gate-judge.md` at arming. Scoring uses the pinned versions; any mid-run diff to the rubrics, judge protocol, stopping rules, or the judge agent is a goalpost amendment by definition)*

A missing or ambiguous Armed/Deadline line means the book is not armed; the Director must refuse to run.

### Autonomy ceiling — staging

Forbidden, no exceptions: `/cycle-prod`; `/cycle-full`; any PR based on `main` or push/merge to `main` (including reverts); push/merge to the sandbox long-lived branches (`feature-magic-carpet`, `feat/pubkey-tagging-target`, `feat/communities`, `feat/curate`); any prod mutation, droplet SSH, deployed-droplet config edit, or BullBoard mutating action on a deployed droplet; triggering, as verification, any task whose `taskRegistry.json` entry carries `resourceClass: "neo4j-heavy"`, plus `reconcileAll`. **Any breach is an automatic experiment failure**, regardless of feature state. (This feature touches no backend tasks at all, so the heavy-task clause should never come into play; it is restated here for completeness.)

### Reserved for the real operator (never the Director's)

Arming this run; ratifying completion (the "yes" to `/close-book`); instructing the rollback after a failure; anything past staging; ratifying proposed goalpost amendments (which take effect only for a future run).

**Operator takeover** = the operator performing any phase work, gate answer, artifact or code edit, or deploy action for this book mid-run — and it counts as experiment failure (the feature may still ship by hand; the autonomy hypothesis is recorded as unsupported). Explicitly **not** takeover: arming; answering a question the Director surfaced at a halt; post-halt decisions; ratification decisions.

### Budgets / stopping rules

Full definitions: role file → "Stopping rules." The numbers: the deadline; 3 consecutive kick-backs at the same gate of the same story (judge KICK_BACKs; at Gate 5, Reviewer CHANGES_REQUESTED counts); more than 2 ADR amendments on one story after its Gate-2 APPROVE; the book's **total** story count (fix-forward stories included) exceeding 5 (this feature is expected to be a single story); ceiling breach (auto-fail); external interference. Tripping any rule halts the run loudly.

### Open design decisions delegated to the Director

The exact **user-facing wording of the popup** (its title and body sentence(s)), within the accuracy constraints fixed by the acceptance frame above — it must convey that the scores reflect either the House or the Personalized point of view depending on which is selected, and it must **not** assert a point of view for the top-of-page Following / Verified Followers / Verified Reporters counts. Resolved at Planning per the role file → "Answering as the user": the simplest copy that satisfies the frame, journaled with rationale. **This list is exhaustive** — any other question the frame does not decide in quotable terms is frame-changing and halts the run. (In particular, *all implementation choices* — whether to extend the existing `VerificationInfo` component or add a sibling, file layout, CSS reuse — are the Architect's inside the cycle, never the Director's to answer.)

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
- Frame bullet 6 is scored at evidence time: staging breakage by external cause *after* the evidence is journaled does not retroactively fail the bullet.

### Rollback (on failure)

Executed **only on the operator's explicit instruction** after reviewing the HALT/failure journal entry — the same instruction authorizes the failure-mode `/close-book`. The Director halts and waits; it never auto-reverts (skill → "Halt semantics"). Steps, executable by either party:

1. Identify the book's staging merge PR(s) from `journal.md` (cross-check: `gh pr list --repo nous-clawds4/tapestry --base staging --search reputation-info-popup --state merged`).
2. Create a revert branch off `origin/staging`; `git revert -m 1 <merge-sha>` for each merge, newest first; open a normal revert PR to `staging` per [`/cycle-staging`](../../../.claude/skills/cycle-staging/SKILL.md) (plain merge; every `gh` command carries `--repo nous-clawds4/tapestry`; never force-push — staging is shared); watch `deploy-staging.yml`.
3. Verify: Tier 1–2 smoke on `staging.brainstorm.world` **plus** one named assertion that the profile page no longer renders the Reputation ⓘ control (DOM extract shows it absent).
4. Keep all harness artifacts — stories, ADRs, reviews, journal — they are the learning, not the mess.
5. Close the book via `/close-book` with the audit recording the failure honestly and the `prd-seed.md` capturing what was learned: the return edge works for failures too.

**Decision journal:** `engineering-team/audits/reputation-info-popup/journal.md` — append-only, committed at every phase boundary.

## Provenance
- **Mode:** Acceptance-frame
- **Confidence at close:** *(to be filled by `/close-book`)*

## Close artifacts *(filled by `/close-book`)*
- Build audit: `engineering-team/audits/reputation-info-popup/audit.md`
- Product feedback: `engineering-team/audits/reputation-info-popup/prd-seed.md`
