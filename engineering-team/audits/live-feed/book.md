# Book of Work: Live feed (kind-1 notes from follows)

**Slug:** live-feed
**Status:** Closed
**Opened:** 2026-06-14
**Closed:** 2026-06-15

## Intent anchor
**Acceptance frame (no PRD)** — the operator's ask, restated and confirmed at kickoff. Completion is *judged* against the bullets below.

Source request: the operator's request in the planning session of 2026-06-14 (no prior `_intake.md` entry — greenfield). The raw ask (verbatim): *"Let's build a 'live feed' feature that will show kind 1 events from the users I follow. It should be relatively basic, nothing fancy, because the reason we're doing it is so that we can then add the ability to Tag any given event with any of the existing Tags ... using the follow list of the logged in user (if there is a logged in user), or the House PoV if there is no logged in user ... The kind 3 follows list should be obtained from local strfry; if not available, just say the follow list is not available ... If there is no House PoV, then for now we simply won't see a feed (but rather an indicator that there is no House PoV selected)."* This book builds **only** the feed (the host surface). Tagging feed items is a deliberately separate, later book that depends on the `nostr-event-tag` wire spec.

### Acceptance frame
- [ ] A page is **publicly reachable** (no login required) at its own bookmarkable URL — `/feed` — on the site. Operationally: an anonymous `GET /feed` returns 200 and renders the feed surface (or one of the defined empty states), without horizontal overflow at a 1280px-wide viewport.
- [ ] The feed is built from the **kind-3 follow list of a single source identity**: the **logged-in user** when one is logged in, otherwise the instance's **House point-of-view identity**. (No source selector — that is out of scope; see below.)
- [ ] The **kind-3 follow list** of the source identity is read from **local strfry** (the instance's profile/follow-graph store).
- [ ] The followed authors' **kind-1 notes** are fetched from the **general-purpose relays** defined in the Concept Graph — the `the-set-of-general-purpose-relays` node under the `nostr-relay` concept, resolved by slug **relative to this instance's own Tapestry Assistant** (never a hardcoded deployment UUID). If that set cannot be resolved or is empty (firmware not installed, set renamed, no members, etc.), the feed falls back to a hardcoded relay list: `wss://relay.damus.io`, `wss://relay.primal.net`, `wss://nos.lol`.
- [ ] The feed shows **kind-1 notes authored by the source's follows, newest first**, bounded to a recent window (a fixed cap; the page makes clear it shows a recent window, not full history). Reposts (kind 6) and reactions (kind 7) are excluded. Each note renders the author's display name and avatar — taken from the instance's existing **local profile data (kind-0 in strfry / Meilisearch)**, not fetched from the external relays — plus the note's timestamp and text.
- [ ] All three **empty/edge states** are handled with a clear on-page indicator (not a blank page or an error):
  1. No source identity available — logged out **and** no House PoV configured → an explicit *"no House point-of-view selected"* indicator instead of a feed.
  2. A source identity exists but its kind-3 follow list is **not present in local strfry** → the page states the follow list is not available.
  3. The follow list exists but yields **no kind-1 notes** → an empty-feed message.
- [ ] The change is **additive and read-only**: it adds the `/feed` route and its supporting endpoint(s), which read from local strfry, the local Concept Graph, and the configured general-purpose relays. It performs **no writes/publishes** and does not modify the existing search page, profile pages, ranking/scoring, or firmware. With the `/feed` route removed, the rest of the app behaves exactly as before.
- [ ] Live on `staging.brainstorm.world/feed` with the staging smoke test passing. **Tier 4 (rendered UI) evidence is mandatory** for final verification, not gap-noteable: an anonymous `GET /feed` returning 200 plus a journaled screenshot or DOM extract showing **≥ 3 rendered notes** (each with author + text + timestamp) for the House PoV's follows, with the notes fetched from the general-purpose relay set. If staging's House PoV has no follows, or the general-purpose relays are unreachable at evidence time, that is surfaced at a halt — relay unreachability by external cause is **external interference (run void)**, not a feature failure; an empty/renamed relay set that triggers the hardcoded fallback is *not* an excuse and must still produce notes.

## Epics in this book
- `live-feed` — the public `/feed` page plus the read-only backend that merges kind-3 follows (local strfry) → kind-1 notes (general-purpose relays) → author profiles (local). (Epic file to be created at Planning.)

## Direction mode (experiment) — pre-registered

This book runs under the Director harness — [`/direct-feature`](../../../.claude/skills/direct-feature/SKILL.md) + [`engineering-team/roles/director.md`](../../roles/director.md): Claude answers the per-story phase gates under blinded gate-judge rubrics and supervises the deploy chain through staging. This section is the experiment's **pre-registration**. Once armed, nothing in it may be weakened mid-run; proposed changes go to the journal for the post-mortem. **An operator goalpost amendment mid-run voids the run** (it does not rescue it).

**Hypothesis being tested:** the harness can carry a small, public-facing, read-only feature end-to-end without a human at the gates, where the data path spans three sources — kind-3 from local strfry, the general-purpose relay set from the local Concept Graph (with a hardcoded fallback), and kind-1 notes fetched from those external relays — joined to local kind-0 profiles. Estimated at pre-registration: **~60% chance of full success**; expected **1–2 stories**.

### Arming (operator only — the Director may not arm)

Arming is **one commit on the `staging` branch whose diff touches only this subsection**, filling in:

- **Armed:** Yes — 2026-06-14T21:48:04Z
- **Deadline:** 2026-06-21T21:48:04Z
- **Baseline:** 42245387e5946bbd9bd1d973c18397ea43faaa64
- **Pinned governing versions:** director.md f314bbba · direct-feature SKILL.md f314bbba · gate-judge.md 3a2657b2

A missing or ambiguous Armed/Deadline line means the book is not armed; the Director must refuse to run.

### Autonomy ceiling — staging

Forbidden, no exceptions: `/cycle-prod`; `/cycle-full`; any PR based on `main` or push/merge to `main` (including reverts); push/merge to the sandbox long-lived branches (`feature-magic-carpet`, `feat/pubkey-tagging-target`, `feat/communities`, `feat/curate`); any prod mutation, droplet SSH, deployed-droplet config edit, or BullBoard mutating action on a deployed droplet; triggering, as verification, any task whose `taskRegistry.json` entry carries `resourceClass: "neo4j-heavy"`, plus `reconcileAll`. **Any breach is an automatic experiment failure**, regardless of feature state.

### Reserved for the real operator (never the Director's)

Arming this run; ratifying completion (the "yes" to `/close-book`); instructing the rollback after a failure; anything past staging; ratifying proposed goalpost amendments (which take effect only for a future run).

**Operator takeover** = the operator performing any phase work, gate answer, artifact or code edit, or deploy action for this book mid-run — and it counts as experiment failure (the feature may still ship by hand; the autonomy hypothesis is recorded as unsupported). Explicitly **not** takeover: arming; answering a question the Director surfaced at a halt; post-halt decisions; ratification decisions.

### Budgets / stopping rules

Full definitions: role file → "Stopping rules." The numbers: the deadline; 3 consecutive kick-backs at the same gate of the same story (judge KICK_BACKs; at Gate 5, Reviewer CHANGES_REQUESTED counts); more than 2 ADR amendments on one story after its Gate-2 APPROVE; the book's **total** story count (fix-forward stories included) exceeding 5; ceiling breach (auto-fail); external interference. Tripping any rule halts the run loudly.

### Open design decisions delegated to the Director

Resolved at Planning per the role file → "Answering as the user": the simplest option that satisfies the frame, journaled with rationale.
1. The exact **numeric cap** on how many recent notes the feed shows (the frame fixes "bounded, newest-first, recent window stated"; the number is the Director's simplest choice).
2. The exact **user-facing copy** for the three empty-state indicators and any feed page heading/title — within the meanings fixed by the frame.

**This list is exhaustive** — any other question the frame does not decide in quotable terms is frame-changing and halts the run. In particular, **all implementation choices** — the author-profile data source (local strfry vs. Meilisearch), the endpoint shape, how the House point-of-view pubkey is resolved, component structure, CSS reuse — are the Architect's/Implementer's inside the cycle, never the Director's to answer.

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
- Frame bullet 7 is scored at evidence time: staging breakage by external cause *after* the evidence is journaled does not retroactively fail the bullet.

### Rollback (on failure)

Executed **only on the operator's explicit instruction** after reviewing the HALT/failure journal entry — the same instruction authorizes the failure-mode `/close-book`. The Director halts and waits; it never auto-reverts (skill → "Halt semantics"). Steps, executable by either party:

1. Identify the book's staging merge PR(s) from `journal.md` (cross-check: `gh pr list --repo nous-clawds4/tapestry --base staging --search live-feed --state merged`).
2. Create a revert branch off `origin/staging`; `git revert -m 1 <merge-sha>` for each merge, newest first; open a normal revert PR to `staging` per [`/cycle-staging`](../../../.claude/skills/cycle-staging/SKILL.md) (plain merge; every `gh` command carries `--repo nous-clawds4/tapestry`; never force-push — staging is shared); watch `deploy-staging.yml`.
3. Verify: Tier 1–2 smoke on `staging.brainstorm.world` **plus** one named assertion that `/feed` no longer serves the feature (404 or absent route).
4. Keep all harness artifacts — stories, ADRs, reviews, journal — they are the learning, not the mess.
5. Close the book via `/close-book` with the audit recording the failure honestly and the `prd-seed.md` capturing what was learned: the return edge works for failures too.

**Decision journal:** `engineering-team/audits/live-feed/journal.md` — append-only, committed at every phase boundary.

## Provenance
- **Mode:** Acceptance-frame
- **Confidence at close:** **high** — all 8 acceptance-frame bullets met and independently re-verified on staging (final blinded gate-judge APPROVE; PR #296 / deploy `27518919488`). Built end-to-end through the per-story harness under Direction mode: 2 stories, 11 judged-gate APPROVEs + 2 mechanical PASSes, 1 gate-judge KICK_BACK (Gate 2 story #2 — resolved on re-judge), 1 ADR amendment (story #1 testability seam), 0 ceiling breaches; deadline not reached.

## Close artifacts *(filled by `/close-book`)*
- Build audit: `engineering-team/audits/live-feed/audit.md`
- Product feedback: `engineering-team/audits/live-feed/prd-seed.md`