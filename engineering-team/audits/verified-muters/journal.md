# Decision journal — verified-muters (Direction mode)

Append-only. Every gate decision, answered question, judge verdict, and halt.

---

## 2026-06-21T14:47:53Z — Kickoff / Stage 0 preflight
**Story/Phase:** verified-muters / Stage 0
**Decision:** INFO
**Judge:** n/a
**Why:** Book armed on `origin/staging` — `Armed: Yes — 2026-06-21T14:31:30Z`, `Deadline: 2026-06-25T14:31:30Z` (not passed), `Status: Open`. Arming landed via PR #330 (merge `bee28c90`); the only delta since the recorded baseline `d1954c38` is the arming commit `ed32511b`, touching only the four Arming bullets — no co-tenant drift, no epic contamination (confirmed: no `verified-muters` stories/ADRs/decisions/reviews/source on `origin/staging`). Working branch `feat/verified-muters` created off `origin/staging` in worktree `tapestry-worktrees/feat-verified-muters` (node_modules symlinked, per the co-tenant isolation rule). Overlap scan: the matched profile/verified-reporters/note-surfaces/reputation-info-popup work is all already merged to staging (built the files this book extends), not active concurrent branches; the 🔴 OPEN handoffs are prod-promotion/protocol-design records, not live edits to the counts row. No entangling overlap.
**Next:** Establish the `npm test` baseline (Stage 0 step 6).

---

## 2026-06-21T14:47:53Z — HALT: red test baseline + shared-stack/co-tenant collision
**Story/Phase:** verified-muters / Stage 0 (preflight, before any story work)
**Decision:** HALT
**Judge:** n/a
**Why:** Two preflight conditions fail together and neither is mine to fix silently.
(1) **Red baseline.** `npm test` (`node test/test.js`, the exact Stage-0/Gate-4 command) exits 1 with **36 failures**, all integration/data-dependent — concept-graph `fetch failed`, un-seeded `tag-pinning` firmware concept, TL/pin/search fixtures absent. Every suite *relevant to this feature* passes (`profile-verified-counts-owner-pov` 12/0, `verified-reporters-list-page` 16/0, `verified-reporters-report-columns` 26/0, `profile-follows-hops` 25/0), so this is an environment/seed gap, not a code regression — but Stage 0 step 6 is explicit: a red baseline halts, and Gate 4 must rerun this identical command and find it *clean*. Redefining "clean" as "no new failures vs the 36-failure baseline" is a goalpost-class reinterpretation of the rubric, forbidden mid-run.
(2) **Shared-stack collision.** A green baseline (and Stage 2 `/cycle-local`) requires the seeded Docker stack. The running stack (`tapestry`/`tapestry-redis`/`nostr-search-api`/`nostr-search-meili`, up 5 weeks) is **bind-mounted to the shared checkout**, which an active co-tenant session is using (`staging`, dirty: `protocols/drafts/event-taggings.md`). It runs the shared checkout's code, not this worktree's — so it can neither give me a green baseline for my code nor verify my code at Stage 2 without colliding with the co-tenant. The standing directive forbids using the local Docker stack in this co-tenant situation. CI does not run the unit suite (`deploy-staging.yml` only deploys), so there is no alternate green signal. This is Stopping rule 6 (colliding sessions / environment) compounding the red-baseline halt.
**Next:** Surface to operator. The run cannot proceed with integrity until either (a) a seeded full stack is pointed at this book's code with the co-tenant paused, (b) the operator makes a goalpost decision relaxing the local green-baseline / cycle-local requirement (a re-arm, applies to a future run), or (c) the book is built via the normal human-gated flow instead. Deadline not passed; halting now pauses the run rather than failing it. Working tree committed and clean; no story work begun.

---

## 2026-06-21T15:20:13Z — Resume attempt (operator chose "free up the stack"); stack recovery + seeding
**Story/Phase:** verified-muters / Stage 0 (re-baseline)
**Decision:** INFO
**Judge:** n/a
**Why:** Operator confirmed the co-tenant session paused and chose "free up the stack & resume." Relocated `feat/verified-muters` from the isolated worktree into the shared checkout (`git worktree remove`; `git switch feat/verified-muters`) so the bind-mounted Docker stack serves this book's code; the co-tenant's untracked `protocols/drafts/event-taggings.md` was byte-identical to `origin/staging`'s tracked copy (blob `7e377890`) and was restored losslessly by the switch (backup at `/tmp/event-taggings.md.cotenant-bak`). Restarting the control panel to load current code surfaced `MODULE_NOT_FOUND: connect-redis` (`bin/control-panel.js:156`) — current `origin/staging` added `connect-redis@^7.1.1` in the ~51 commits since the container last loaded code 4 days ago; the `node_modules` volume was stale. Fixed by `npm install` in the container (added 48 pkgs; restored incidental lockfile drift so the branch stays docs-only). Control panel now RUNNING on current code (200 on `/api/concept-graph/summaries`); firmware reinstalled (HTTP 200; `tag`/`nostr-user-tag`/`tag-pinning` seeded; pre-existing `nostr-relay` schema error noted). NOTE: I caused a brief control-panel outage during this recovery; it is now healthier than found (current code + synced deps + fresh firmware). `strfry-router` remains FATAL (pre-existing first-boot bug, down before this session).
**Next:** Re-run the `npm test` baseline.

## 2026-06-21T15:20:13Z — HALT (2nd): green baseline unreachable; residual failures are unrelated infra
**Story/Phase:** verified-muters / Stage 0 (re-baseline, before any story work)
**Decision:** HALT
**Judge:** n/a
**Why:** Even with current code served + deps synced + firmware seeded, `npm test` still exits 1 with **34 failures**, and **every failing suite is in the tag/pin/TL/search family** — `profile-tags`, `tag-detail-publish`, `tag-index-publish`, `pin-a-tag-publish`, `tl-publication-from-pins(-publish)`, `customize-pin-curation-publish`, `most-pinned-tag-index-publish`, `tag-detail-curated-view-and-pin-polish-publish`, `profile-tag-polish`. Their failures ("TL must exist… no POV configured", "pins must contain… got []", concept-graph "fetch failed") trace to `strfry-router` being FATAL (a separate known first-boot bug) plus an un-configured House POV / absent pin-TL-search fixtures — none of which this book touches. **Every suite this book extends is GREEN**: `profile-verified-followers-count` 6/0, `profile-followers-list` 27/0, `profile-verified-reporters-count` 11/0, `verified-reporters-membership-data` 12/0, `verified-reporters-list-page` 16/0, `profile-verified-counts-owner-pov` 12/0, `verified-reporters-report-columns` 26/0, `profile-follows-hops` 25/0, `profile-hops-path` 27/0. The failing set is also unstable (36→34 across runs), so a "no new failures" delta baseline would be unreliable. Seeding firmware (the operator's premise) did not green the suite; reaching true green needs unrelated infra remediation (fix strfry-router, configure POV, seed fixtures) that is out of this book's scope and risky on a shared box — and I will not reinterpret Gate 4's "clean full suite" to exclude these (goalpost-class). 
**Next:** Surface to operator with three honest paths — (A) amend the baseline definition to the documented pre-existing failure set and re-arm; (B) remediate the env to true green, then resume; (C) build the feature via the normal human-gated flow. Shared checkout left on `feat/verified-muters` (stack serving current code) for an immediate resume; can restore to `staging` on request. No story work begun.

---

## 2026-06-21T15:34:00Z — Operator decision: amend test baseline & re-arm (path A)
**Story/Phase:** verified-muters / Stage 0 (goalpost amendment, drafted)
**Decision:** ANSWER (operator) → INFO
**Judge:** n/a
**Why:** Operator chose path A. Drafted a book-specific **Test baseline** subsection in `book.md`'s Direction-mode section: it documents the 11 pre-existing tag/pin/TL/search failing suites (root cause `strfry-router` FATAL + un-configured House POV, unrelated to this book) as excluded, defines this book's green baseline as "every other suite passes" (all verified-muters siblings green), and sets the Gate-4 check to **suite-level no-regression** over the deterministically-passing suites (a previously-green suite going red fails Gate 4; a flake inside the documented set does not). Also reset the Arming subsection to **un-armed** so the operator's re-arm is a clean, deliberate ratification of the amended pre-registration. Per the amendment rules this is a goalpost change that takes effect for the **re-armed** run, not the prior (now-superseded) arming PR #330. Drafted, not self-ratified: I do not arm.
**Next:** Land the amendment on `staging` via PR (carries this journal + the amended `book.md`); operator merges, then re-arms (fresh Armed/Deadline/Baseline/Pinned). On re-arm I resume from Stage 0 and record the passing-suite snapshot as the book baseline before Planning.
