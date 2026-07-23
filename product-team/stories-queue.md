# Stories Queue: Second Brain

**Slug:** second-brain
**Date:** 2026-07-21
**Source PRD:** `product-team/prd/second-brain.md`
**Companion guides:** `product-team/guides/second-brain-design-guide.md`, `product-team/guides/second-brain-style-guide.md` (+ `second-brain-wireframes.html`)
**Status:** Ready for promotion

8 stories across 1 block, in dependency order. Engineering should be able to demo capture-to-view after Story 1, and the full propose/decide loop after Story 6.

**Handoff note (for the engineering Product Owner):** create one epic umbrella `engineering-team/epics/second-brain.md` and a folder `engineering-team/stories/second-brain/`, then promote each story below via `/plan-feature`, referencing the PRD and guides. The queue order is the pickup order. Owner-facing copy comes **verbatim** from the style guide; the PRD's §7 Policy Constitution binds every story. Two in-flight engineering books are declared dependencies where noted and are **referenced, never re-specified**: `relationship-primitives` (armed Direction-mode run) and the future firmware clobber-protection work.

---

## Block 1 — Second Brain MVP: Capture, Decompose, Propose
*Suggested epic-slug: `second-brain`*

The delegation loop minus autonomous launch: goals live in the brain, sessions orient from them, the system proposes, the owner decides and launches.

---

## Story 1: Capture a goal and see it

**PRD section(s):** §5.1, §5.8, §6, §7.7–7.8
**Persona(s):** The Delegating Owner
**Block:** Second Brain MVP
**Suggested epic-slug:** `second-brain`

**Description:** The owner states a goal in plain words and it exists in the brain — visible in the Goals view — proving the capture-to-view path end-to-end.

**Acceptance criteria:**
- [ ] When the owner states a goal in conversation, a goal is recorded with its name, statement, origin, and capture date, and the confirmation is one plain sentence.
- [ ] The Goals view shows the goal in the tree with the standing word "captured" and its metadata, per the design guide.
- [ ] Goals recorded before this product shipped (the existing goal concept's elements) appear in the same view — the brain adopts the existing concept rather than creating a parallel one.
- [ ] With no goals, the view shows the canonical cold-start empty state, and it offers exactly one action.
- [ ] The view carries the privacy indicator line verbatim from the style guide, as an indicator, not a control.
- [ ] No owner-facing string uses a banned jargon word; standing words are the canonical set.

**Dependencies:** None.

**Notes for engineering:** The brain adopts `39998:<TA>:tapestry-owner-goal` (PRD §6) — the assistant identity is always resolved at runtime, never hardcoded (house rule; PRD §7.8). Abandonment is a dated fact, not a deletion (§7.2). The read view lives in the existing owner-gated control panel and inherits its tokens (design guide: mirror, don't invent).

---

## Story 2: Structures the brain can trust

**PRD section(s):** §5.7 (hygiene), §7.8
**Persona(s):** The Delegating Owner; The Fresh-Context Session (a session must be able to trust what it reads — traces to owner journey 4 via the read loop)
**Block:** Second Brain MVP
**Suggested epic-slug:** `second-brain`

**Description:** A hygiene check validates the goal structures against the graph's own class discipline, and the two known live defects are cleaned.

**Acceptance criteria:**
- [ ] A repeatable check inspects the goal structures and reports zero structure problems when the structures are sound.
- [ ] The two known stray membership edges (on the goal concept and its engineering-project sibling) are gone after cleanup.
- [ ] If a structure defect of the known kinds recurs, the check reports it specifically (which structure, what kind of problem), not generically.
- [ ] The cleanup does not lose any existing goal: every goal element present before cleanup is present after.

**Dependencies:** May depend on the in-flight `relationship-primitives` engineering book for single-edge cleanup operations — declare and wait; never re-implement its endpoints.

**Notes for engineering:** The defects were verified live 2026-07-21 (stray header-to-`concept-header-superset` membership edges on both work-item concepts; irregular element wiring on the goal concept). Firmware-reinstall behavior is out of scope here (operator decision, 2026-07-18) — this story cleans and detects; it does not change the installer.

---

## Story 3: Break a goal into pieces

**PRD section(s):** §5.2, §5.8, §6
**Persona(s):** The Delegating Owner
**Block:** Second Brain MVP
**Suggested epic-slug:** `second-brain`

**Description:** In conversation, a goal acquires session-sized child goals, each viable only when it has a stated deliverable and boundary.

**Acceptance criteria:**
- [ ] The owner can add child goals to a goal in conversation; each child records its own name and statement; a goal has at most one parent.
- [ ] A leaf goal with both a deliverable ("done means") and a boundary ("stays inside") shows the standing word "viable"; a leaf missing either shows "captured" with the inline hint from the design guide.
- [ ] A goal with children shows "captured" (or "achieved"/"abandoned" as recorded) — never "viable" — and is never eligible for proposals.
- [ ] The Goals view renders the nesting with disclosure, per the design guide.
- [ ] The Goal detail shows the deliverable and boundary in the owner's words, labelled "Done means" and "Stays inside".

**Dependencies:** Story 1 must ship first (goals must exist and render).

**Notes for engineering:** Decomposition position is durable intent (PRD §6): the child's parent reference is part of the goal's own record, so the structure survives regardless of how edges are materialized. If edge materialization is wanted, it depends on the `relationship-primitives` book (declared dependency; a net-new relationship type is that book's documented post-book whitelist extension — do not extend the whitelist inside this story).

---

## Story 4: Attach the world — pointers and the goal's page

**PRD section(s):** §5.3, §5.8, §6
**Persona(s):** The Delegating Owner; The Fresh-Context Session
**Block:** Second Brain MVP
**Suggested epic-slug:** `second-brain`

**Description:** Goals point at external resources — files, vault notes, nostr events, repositories, web addresses — and the Goal detail shows intent, pointers, and record on one spine.

**Acceptance criteria:**
- [ ] The owner can attach a resource to a goal with a kind, a locator, and a title; why-kept and keywords are optional.
- [ ] The pointer card renders kind, title, locator preview, and a freshness line whose wording follows the style guide ("verified N days ago" / stale / unreachable), per the design guide.
- [ ] Opening a pointer opens the resource in its native home; nothing is embedded or copied into the brain.
- [ ] Freshness standing is derived from the last-verified date; verifying a resource updates it.
- [ ] The Goal detail presents intent (statement, done-means, stays-inside), pointers, and the goal's record entries as one chronological spine, per the design guide.
- [ ] Record entries render append-only: no edit affordance exists on any record entry.

**Dependencies:** Story 1 must ship first. Story 3 is not required (a childless goal can carry pointers).

**Notes for engineering:** External Resource is a new concept following the graph's established pointer-element pattern (PRD §6). Content never migrates into the brain (§5.3); the pointer card is the whole surface.

---

## Story 5: Sessions read the brain

**PRD section(s):** §5.4, §6, §7.1–7.3
**Persona(s):** The Fresh-Context Session (traceability guard satisfied: serves owner journey steps 4–5 — the record is what the owner reviews, and what retrieval finds)
**Block:** Second Brain MVP
**Suggested epic-slug:** `second-brain`

**Description:** Every agent session orients from the brain within a bounded budget, references the goal it serves, and leaves an append-only work record on that goal.

**Acceptance criteria:**
- [ ] A fresh session can state which goals exist and which goal it is serving after a bounded orientation — without reading every goal in the brain, and at a cost that does not grow with the number of goals.
- [ ] The session's output names the goal it served.
- [ ] After a session, the goal's spine shows a work record: the session, a one-sentence standing summary, any produced resources as pointers, and at most two plain-English questions.
- [ ] Work records are dated, attributed, and append-only.
- [ ] A goal idea arising inside a session is recorded as a capture attributed to the session — it never launches anything (Policy Constitution §7.3).

**Dependencies:** Stories 1 and 4 must ship first (goals and pointers must exist for records to reference).

**Notes for engineering:** The bounded orientation is the machine persona's load-bearing tolerance — the design intent is that orientation cost stays flat as the corpus grows. The session-read loop is what makes the frozen legacy checklist stay frozen (success metric); the work record is the raw material of the future morning review (Phase 3 — do not build the digest now).

---

## Story 6: The proposal loop

**PRD section(s):** §5.5, §5.8, §7.1–7.2, §7.7
**Persona(s):** The Delegating Owner
**Block:** Second Brain MVP
**Suggested epic-slug:** `second-brain`

**Description:** The system periodically nominates exactly one viable goal with comparative rationale; the owner approves (and launches) or skips with a reason; every decision is recorded.

**Acceptance criteria:**
- [ ] A proposal nominates exactly one viable goal, with a why-now readable in ten seconds and the named runners-up it passed over, each with a one-line why-not, in the canonical register.
- [ ] The Proposal queue renders open proposals as the design guide's emphasis cards with equal-weight Approve and Skip actions.
- [ ] Approve records an approved decision with its date; the owner launches the session themselves; the proposal leaves the queue and appears on the goal's record.
- [ ] Skip requires a one-line reason before it can complete, records the skip and reason, and confirms with the canonical sentence.
- [ ] No proposal is ever decided silently: every proposal is open, approved, or skipped, and its state is visible on the nominated goal's spine.
- [ ] No numeric score appears in any owner-facing proposal copy.

**Dependencies:** Stories 3 and 5 must ship first (viable goals must exist; decisions and records share the spine).

**Notes for engineering:** The proposer's cadence and selection heuristic are deliberately unspecified product-side beyond "nominates one viable goal with comparative rationale" — the Architect chooses the simplest honest mechanism; the accumulated decisions are the calibration corpus the Phase-3 entry metric counts (agreement ≥50% over ≥15 decisions), so the decision record's completeness is the point. Proposal auto-expiry is Phase 2 — do not build it.

---

## Story 7: Teach it what matters — priority signals

**PRD section(s):** §5.6, §6, §7.6
**Persona(s):** The Delegating Owner
**Block:** Second Brain MVP
**Suggested epic-slug:** `second-brain`

**Description:** The owner records pairwise choices between goals — dated, attributed, framing-tagged — which proposals may cite but which never launch anything.

**Acceptance criteria:**
- [ ] The owner can record a choice between two goals ("solve one today: which?") with an optional one-line reason.
- [ ] Each signal records who judged, when, and the framing that produced it.
- [ ] Signals are append-only and visible on the goals they touch.
- [ ] A proposal's why-now may cite recorded signals in plain words; signals alone never cause a launch or a decision.
- [ ] Replacing the framing later leaves earlier signals interpretable (their framing tag still identifies how they were produced).

**Dependencies:** Story 1 must ship first; pairs naturally after Story 6 but does not require it.

**Notes for engineering:** The framing is a replaceable slot by design (PRD §7.6; the operator's stated epistemology). V1 ships pairwise only; no score aggregation, no ranking display — the signals are data for the future, not a feature surface now.

---

## Story 8: The brain survives — export and restore

**PRD section(s):** §5.7, §7.4
**Persona(s):** The Delegating Owner; The Second Operator (the export is also the portability seed)
**Block:** Second Brain MVP
**Suggested epic-slug:** `second-brain`

**Description:** The owner can export the brain's owner-authored content and has proven, once, that a restore reproduces it.

**Acceptance criteria:**
- [ ] An export produces a dated artifact containing the owner-authored brain content: goals (with decomposition positions), resources, signals, proposals and decisions, and work records.
- [ ] A restore drill against a scratch target reproduces the exported goals, pointers, and records, and the drill's result is journaled.
- [ ] The export completes without touching or publishing anything outward (Policy Constitution §7.4).
- [ ] Running export twice with no changes in between produces equivalent content.

**Dependencies:** Story 1 must ship first (there must be something to export). Fuller protection against reinstall-clobber is the separate firmware-protection engineering work — referenced, not re-specified; until it lands, this export **is** the protection.

**Notes for engineering:** Scope is the owner-authored second-brain content, not a whole-database backup. "Scratch target" means any environment that is not the live brain — the drill must not risk the thing it protects.

---

## Sequence summary
1. **Story 1 — Capture and see** (end-to-end proof; demoable immediately).
2. **Story 2 — Hygiene** (clean before building on the structures; may wait on relationship-primitives).
3. **Story 3 — Decomposition** (viability = deliverable + boundary).
4. **Story 4 — Pointers + Goal detail** (the one-spine page).
5. **Story 5 — Session read loop** (ends session amnesia; work records).
6. **Story 6 — Proposal loop** (the product's heart; the calibration corpus begins).
7. **Story 7 — Priority signals** (the replaceable framing, recorded only).
8. **Story 8 — Export + restore drill** (the trust floor).

**Deferred to later phases (not in this queue):** lifecycle/acceptance, review gates, tiers, expiry, launch answer, claim/lease, private mode, engineering-project merge (Phase 2); autonomous launch, charter, digest, observability (Phase 3, observability via the task-timeline book); brain search index and rounds (Phase 4); self-improvement wiring (Phase 5); local models, semantic recall (Phase 6); sharing (Phase 7).

---
---

# Stories Queue: Verified Reporters *(consumed — retained for history)*

**Slug:** verified-reporters
**Date:** 2026-06-07
**Source PRD:** `product-team/prd/verified-reporters.md`
**Companion guides:** `product-team/guides/verified-reporters-design-guide.md`, `product-team/guides/verified-reporters-style-guide.md` (+ `verified-reporters-wireframes.html`)
**Status:** Consumed — Promoted 2026-06-07 → `engineering-team/epics/verified-reporters.md`; all 3 stories shipped (book closed 2026-06-07; story 4 followed 2026-06-15). *(stamp backfilled 2026-07-02, harness sweep)*

3 stories across 1 block, in dependency order. Engineering should be able to demo the count after Story 1, and the full investigation path after Story 3.

**Handoff note (for the engineering Product Owner):** create one epic umbrella `engineering-team/epics/verified-reporters.md` and a folder `engineering-team/stories/verified-reporters/`, then promote each story below via `/plan-feature`, referencing the PRD and guides. The queue order is the pickup order. User-facing copy must use the style guide's canonical copy table verbatim.

---

## Block 1 — Verified Reporters
*Suggested epic-slug: `verified-reporters`*

The credible negative trust signal: a point-of-view-filtered count of verified users who reported the observed account, and a list of exactly who they are.

---

## Story 1: Verified Reporters count on the profile

**PRD section(s):** §5.1, §5.3
**Persona(s):** The Vetting Observer (primary); The Cautious Newcomer (House fallback behavior)
**Block:** Verified Reporters
**Suggested epic-slug:** `verified-reporters`

**Description:** Surface the point-of-view-filtered Verified Reporters count in the profile's counts row, parallel to Following / Verified Followers, as a negative-signal entry point to the reporters list.

**Acceptance criteria:**
- [ ] On a profile with one or more verified reporters under the active point of view, the counts row shows a value labelled "Verified Reporters", placed parallel to Following and Verified Followers.
- [ ] When the count is greater than zero, the value reads as a negative signal (visually distinct from the positive/neutral counts) and the whole count links to `/user/:pubkey/reporters`.
- [ ] When the count is zero, the value is shown neutrally (not as a warning) and is not a link.
- [ ] When the count is unavailable / not yet computed, a placeholder ("—") is shown, not a link, and is visually distinct from a real zero.
- [ ] While the count is loading, a dimmed/placeholder value is shown (no bare spinner).
- [ ] The count's accessible name states the number and that it opens the list (for example, "3 verified reporters. View list.").
- [ ] The count is computed under the viewer's effective point of view (personal if available, else House), the same point of view used by the other counts on the page.

**Dependencies:** None — uses the verified-reporter count that already exists in the data layer. (The link target page is delivered in Story 3; until then the link may resolve to an unbuilt/empty page. Acceptable within the epic sequence.)

**Notes for engineering:** The per-point-of-view count already exists (it is read today as `verifiedReporterCount`, point-of-view-namespaced, and already rendered as a trust card in `ui/src/pages/BrainstormProfile.jsx`). This story *elevates* it to a count-link in the existing `.bsp-counts` row, mirroring the Following count-link pattern. Negative signal = the existing `--red` token (the app already encodes "report" as red, e.g. the Report action button). Place it to match Verified Followers' treatment **as it exists at build time** (PRD §11 decision 1: match the staging reference, a count-link). No per-count point-of-view marker — that is deferred (PRD §8.3 / §11 decision 5). Route target is `/user/:pubkey/reporters` (PRD §11 decision 2).

---

## Story 2: Verified reporters membership data

**PRD section(s):** §5.2, §6, §7
**Persona(s):** The Vetting Observer
**Block:** Verified Reporters
**Suggested epic-slug:** `verified-reporters`

**Description:** Provide the set of verified users who reported a given account, resolved under the viewer's point of view, so the list and count agree.

**Acceptance criteria:**
- [ ] Given an account and a point of view, the capability returns the set of users who filed a NIP-56 report against that account and are verified within that point of view.
- [ ] Reporters who are not verified within the point of view are excluded (unverified / sybil reporters do not appear).
- [ ] Each returned reporter includes enough identity to display and weigh them: an identifier and the credibility (Rank) metric.
- [ ] The size of the returned set equals the verified-reporter count shown for that account under the same point of view.
- [ ] When the viewer has no calculated point of view, the set is resolved under the House (default) point of view.
- [ ] When the account has no verified reporters under the point of view, an empty set is returned (not an error).

**Dependencies:** None strictly (it is the data capability), but it must ship before Story 3, which consumes it.

**Notes for engineering:** This is the net-new data need identified in PRD §7 — the *count* exists already, but the *membership* (the identities behind it) does not yet. It must use the **same** verified / point-of-view definition that produces the existing count, so count equals list length (AC4 and PRD success metric 1). Mirror how the follows / verified data is computed and exposed (see `src/api/grapevineInteractions/` and the `useGrapevineFollows` hook the follows list uses). All NIP-56 report types are counted together (single pot — no type filtering this release). Reporter identities are public NIP-56 events; no privacy special-casing (PRD §7).

---

## Story 3: Verified Reporters list page

**PRD section(s):** §5.2, §5.3
**Persona(s):** The Vetting Observer (primary); The Cautious Newcomer (point-of-view attribution)
**Block:** Verified Reporters
**Suggested epic-slug:** `verified-reporters`

**Description:** A dedicated page at `/user/:pubkey/reporters` listing which verified users reported the account, ordered by credibility, with explicit point-of-view attribution.

**Acceptance criteria:**
- [ ] Navigating to `/user/:pubkey/reporters` shows a page titled "Verified Reporters", with a back link to the profile and the description "Verified users who have reported this account."
- [ ] The page lists the verified reporters for that account under the viewer's point of view, with default columns picture, name, and Rank, sorted by Rank descending.
- [ ] Selecting a reporter navigates to that reporter's profile.
- [ ] The list length equals the count shown on the profile for the same account and point of view.
- [ ] The page always states whose point of view is in effect — "Relative to your web of trust." (personal) or the House line (fallback) — and an "About this data" control explains the data is computed locally and that counts are personal, with no single global number.
- [ ] When there are no verified reporters, the page shows the designed empty state ("No verified reporters. No one in this web of trust has reported this account."), not a blank and not an error.
- [ ] While loading, a skeleton of the table is shown; on failure, a helpful message with a retry control is shown (never "Something went wrong").

**Dependencies:** Story 2 must ship first — the page renders the membership data that Story 2 provides. Pairs with Story 1 (the count links here), but does not require Story 1 to function.

**Notes for engineering:** Mirror `ui/src/pages/BrainstormFollows.jsx` (the `DataTable`, the search field, the Columns toggle, the `InfoPopover`). Register the route in `ui/src/App.jsx` parallel to `/user/:pubkey/follows` (PRD §11 decision 2: `/reporters`). **Default sort is Rank descending** — deliberately different from the follows list's sort — so the most credible reporters surface first. Search by name / npub. Optional hidden-by-default columns may include npub and Hops. Use the "Rank" label (PRD §11 decision 4). All user-facing strings come **verbatim** from the style guide's canonical copy table. The flag / information / lock glyphs are inherited UI iconography, not copy (PRD §11 decision 3). Extend the "About this data" popover with the no-global-view sentence. *Stretch (PRD §8.2):* a reporter's report timestamp as an optional, hidden-by-default column — only if cheap; not required.

---

## Sequence summary
1. **Story 1 — Verified Reporters count** (independent; demoable immediately on existing data).
2. **Story 2 — Membership data** (the net-new data capability; unblocks Story 3).
3. **Story 3 — List page** (consumes Story 2; completes the investigation path and the count's link target).

**Deferred to later phases (not in this queue):** report-type breakdown (Phase 2); pile-on resistance (Phase 3); self-view privacy controls, web-of-trust education, and the shared counts-row point-of-view indicator (Phase 4); moderator / transaction-vetting surfaces (Phase 5).
