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
