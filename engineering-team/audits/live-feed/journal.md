# Decision journal — live-feed (Direction mode)

Append-only. Every gate decision, answered question, judge verdict, and halt. Committed at every phase boundary. Governing versions pinned at arming: director.md `f314bbba` · direct-feature SKILL.md `f314bbba` · gate-judge.md `3a2657b2`. Baseline SHA `42245387`. Deadline `2026-06-21T21:48:04Z`.

## 2026-06-14T23:50:30Z — Session 1 kickoff: Stage-0 preflight clean
**Story/Phase:** live-feed / Stage 0 (preflight)
**Decision:** INFO
**Judge:** n/a
**Why:** First session — no prior journal. Preflight verified end to end: (1) book armed — `Armed: Yes 2026-06-14T21:48:04Z`, `Deadline 2026-06-21T21:48:04Z` (concrete, not passed; now 2026-06-14T23:50:30Z), `Status: Open`. (2) Arming commit `15f0924c` touches only `book.md` (4 lines = the Arming subsection); baseline `42245387` exists; pinned governing versions match the working tree exactly (director.md `f314bbba`, SKILL.md `f314bbba`, gate-judge.md `3a2657b2`) — no mid-run drift in the frozen sections. (3) Contamination check clean: no pre-existing `live-feed` epic, stories, ADRs, branch, or `/feed` route in `src/` — greenfield as the book states. (4) Overlap scan: 3 `🔴 OPEN` handoffs (COMMUNITIES, B_TAG_AFFILIATION — protocol docs-mode; PROFILE_FOLLOWERS — already shipped to staging, prod-promotion held, Neo4j grapevine traversals, no file overlap with a new additive `/feed`); other Open book `task-timeline` is unarmed/no-stories/dormant. No blocking overlap. (5) Working tree clean, `git fetch` done, HEAD == origin/staging (0/0 ahead/behind) — no drift. (6) Branch `feat/live-feed` created off `origin/staging`. (7) Baseline `npm test` (`node test/test.js`) GREEN — Overall: PASS, 393 tests passed across suites. Gate 4 reruns this identical command.
**Next:** Stage 1, Story 1 — Planning. Spawn `product-owner` against the acceptance frame (no `_intake.md` entry; greenfield) to draft the first story; then Gate 1 (fresh gate-judge).

## 2026-06-14T23:55:00Z — Delegated decision 1/2: recent-window note cap
**Story/Phase:** live-feed / Planning (delegated design decision)
**Decision:** ANSWER
**Judge:** n/a
**Why:** The book's Direction-mode section delegates exactly two design decisions to me, resolved at Planning as "the simplest option that satisfies the frame." Decision 1 — the numeric cap on recent notes. The frame fixes "bounded, newest-first, recent window stated"; the number is mine. Choosing **50 notes**. Rationale: the operator's raw ask is "relatively basic, nothing fancy"; 50 is the smallest cap that still reads as a feed (not a stub), renders fast, and bounds the relay fetch. Simplest defensible choice. This is product intent only — *how* the cap is enforced (query limit, slice, etc.) stays the Architect's/Implementer's.
**Next:** Decision 2 (empty-state + heading copy), then spawn product-owner.

## 2026-06-14T23:55:30Z — Delegated decision 2/2: user-facing copy
**Story/Phase:** live-feed / Planning (delegated design decision)
**Decision:** ANSWER
**Judge:** n/a
**Why:** Decision 2 — user-facing copy for the page heading and the three empty-state indicators, "within the meanings fixed by the frame." Choosing the simplest clear wording that conveys exactly the frame's meanings (no new meaning added):
- Page heading: **"Live Feed"**.
- Empty state 1 (logged out **and** no House PoV configured): **"No House point-of-view is selected — there's no feed to show yet."** (frame: an explicit "no House point-of-view selected" indicator).
- Empty state 2 (source identity exists but its kind-3 follow list is not in local strfry): **"This identity's follow list isn't available locally yet."** (frame: the page states the follow list is not available).
- Empty state 3 (follow list exists but yields no kind-1 notes): **"No recent notes from the accounts this identity follows."** (frame: an empty-feed message).
- Recent-window indicator (frame: "the page makes clear it shows a recent window, not full history"): **"Showing the most recent 50 notes."**
These are suggested canonical strings; exact punctuation is non-binding so long as each indicator conveys its frame meaning. Copy is product/UX intent, explicitly delegated — not design, names, or code.
**Next:** Spawn product-owner with the frame + these two delegated answers; produce Story 1 under `stories/live-feed/`.

## 2026-06-15T00:05:00Z — Gate 1 (Planning) — Story 1 feed-read-path
**Story/Phase:** live-feed #1 (feed-read-path) / Gate 1 (Story, after Planning)
**Decision:** APPROVE
**Judge:** First `gate-judge` spawn died on a transient API socket error after 6 tool calls — **no verdict produced** (infrastructure failure, not a judgment; does not count as a KICK_BACK). Re-spawned a **fresh** judge (not a follow-up — a verdict after a follow-up would be void) with the identical prompt. Second judge: **APPROVE**, blinding intact ("spawn prompt handed only paths plus concept-graph credentials; no progress/deadline/budget/stakes leaked"); all 6 rubric items pass with file:line evidence — 5 externally-testable criteria, one subsystem (read path), no solutioning, all four concept handles verified live against the local Concept Graph (incl. the `the-set-of-general-purpose-relays` Set node), per-epic numbering + Status lines present, every criterion traces to a frame bullet and out-of-scope respects the frame + epic.
**Why:** I concur with the judge. The Product Owner decomposed the frame into **2 stories** (epic ceiling 5; book estimated 1–2): #1 the backend read path (this story), #2 the `/feed` page (scope-only in the epic, drafted at its own Planning). The split is a clean subsystem boundary; #1+#2 together cover all 8 frame bullets. The story is well-bounded and testable from outside; nothing to kick back. **Status-flip note:** story remains `**Status:** Draft` as authored — editing the story file is outside the Director's lane (role file: "The Director never edits the story file"), and the only harness-mandated Status transition is the Reviewer's flip to `Done` at Gate 5; the Gate-1 approval is recorded here authoritatively. No later gate depends on a Draft→Approved intermediate.
**Next:** Story 1, Architecture phase — spawn `architect` against the approved story; then Gate 2 (judged).

## 2026-06-15T00:30:00Z — Gate 2 (Architecture) — ADR 0001 feed-read-path-endpoint
**Story/Phase:** live-feed #1 (feed-read-path) / Gate 2 (ADR, after Architecture)
**Decision:** APPROVE
**Judge:** First `architect` spawn died on a transient API socket error after 31 tool calls — **wrote nothing** (working tree verified clean); re-spawned fresh; second spawn produced the ADR. Gate-2 `gate-judge`: **APPROVE**, blinding intact; all 7 rubric items pass with file:line evidence. The judge independently verified every named file/function exists in source (`runCypher` neo4j-driver.js:53, `handleStrfryScan` scan.js:11, `SimplePool.querySync`+`Promise.race` fetchEvents.js:45-49, `getSettings` settings.js:76, `searchPreferences.povPubkey` grapevinePrefApi.js:24-25, `req.session.pubkey` auth.js:120), confirmed live-graph orientation accurate (relay set resolves at kind **39999**; the 39998 form 404s), confirmed no new deps (nostr-tools/ws/express-session/neo4j-driver already in package.json), no concept/firmware change, per-epic numbering correct (0001), and that ADR 0001 *cites* ADR 0033 (three-PoV standard) in support — using `povPubkey` as House *identity*, not a trust-metric source — rather than contradicting it (no supersession needed).
**Why:** I concur. ADR 0001 chose Option A (one self-contained `src/api/feed/feedReadPath.js` + public `GET /api/feed`, returning a discriminated `status` union {OK,EMPTY,NO_SOURCE,FOLLOW_LIST_UNAVAILABLE} + `relaySource` {set,fallback}), reusing four existing primitives, with two genuine named alternatives (B: browser-side compose — rejected, collapses the story split + reads profiles from external relays; C: shared social-read service — rejected, touches `fetchProfiles.js` which the frame protects). Specific, additive, read-only, reversible. **Documentation note:** the architect flagged a "nit" that the story lists the relay set under 39998 — on verification this is *incorrect*: story line 68 already lists it as `39999:...:the-set-of-general-purpose-relays`, and the criterion's "under the `nostr-relay` concept" (39998) is also correct since the 39999 Set sits under the 39998 concept. No story error; nothing to fix; immaterial to the gate.
**Next:** Story 1, Test Design — spawn `tester` against the approved story + ADR 0001; demand actual failing `npm test` output; then Gate 3 (judged).

## 2026-06-15T01:00:00Z — Test Design produced; routing an ADR-seam decision to the Architect (pre-Gate-3)
**Story/Phase:** live-feed #1 (feed-read-path) / Test Design → Architecture (amendment routing)
**Decision:** INFO
**Judge:** n/a (Gate 3 NOT yet judged)
**Why:** `tester` produced the test plan (`stories/live-feed/1-feed-read-path.test-plan.md`) + 23 failing tests (`test/live-feed-read-path.test.js`, wired into `test/test.js`), with verbatim `npm test` output: new suite **FAIL 0/23** (legible reason — module/feature absent, not a typo/import crash), all 34 pre-existing suites still **PASS**. AC→test mapping covers every AC + all three edge outcomes + ordering + 50-cap + kind-1-only (kind-6/7 + non-followed excluded) + set-vs-fallback discriminator. **One substantive finding:** the behavioral tests drive the four I/O boundaries (strfry scan, `runCypher`, `SimplePool.querySync`, local kind-0) by injecting in-memory fakes through `buildFeed`'s options object; the ADR's `buildFeed({ sessionPubkey })` is *compatible* but doesn't *name* this injectable-deps seam. Whether to ratify that seam in the ADR is an **Architecture decision** — not the Director's (role isolation), and the tester correctly declined to decide it. Routing to the Architect for a scoped amendment so the seam is a visible primary-source artifact the blinded Gate-3 judge can trace the tests to. If the Architect amends ADR 0001, that counts as **ADR amendment #1** (budget: 2 before Stopping rule 3 halts) and I will **re-judge Gate 2** on the amended ADR before proceeding to Gate 3. Tests remain uncommitted until Gate 3 passes.
**Next:** Spawn `architect` to decide/ratify the injectable-deps seam in ADR 0001; then re-judge Gate 2; then Gate 3 on the tests.

## 2026-06-15T01:30:00Z — ADR amendment #1 + Gate 2 re-judge (amended ADR 0001)
**Story/Phase:** live-feed #1 (feed-read-path) / Architecture amendment → Gate 2 (re-judge)
**Decision:** APPROVE
**Judge:** Fresh Gate-2 `gate-judge` on the amended ADR: **APPROVE**, blinding intact; all 7 rubric items pass; independently re-verified every named source function exists and live-graph handles resolve, and confirmed the amendment is "a pure wiring change that touches no Gate-2 rubric item." (No prior findings to carry — the original Gate-2 verdict was a clean APPROVE.)
**Why:** The `architect` decided to **amend** (not decline): a blinded reviewer reading only the ADR text could not require the Implementer to honor injected deps, so the seam must be explicit. Amendment is purely additive — **29 insertions, 0 deletions**, ADR-only (verified via `git diff`): two clearly-labeled blocks naming the four injectable boundaries (`getSettings`, `scanStrfry`, `runCypher`, `querySync`), each defaulting to the real helper, with `handleGetFeed` calling `buildFeed({ sessionPubkey })` deps-free in production. Changes no behavior, option, contract, item shape, relay logic, or read-only posture; no new dep/tooling/concept/firmware. Authored by the `architect` role via `Write` (it lacks Edit) — the Director did not author it. **This is ADR amendment #1** (Stopping rule 3 halts after >2 on one story post-Gate-2). I concur with the re-judge. *(Process note for the post-mortem: my amendment-label instruction included "post-Gate-2, pre-Gate-3" — a mild process-position signal now embedded in the artifact; the judge confirmed blinding intact regardless. Future amendment labels should be process-neutral.)*
**Next:** Gate 3 on the tests — spawn fresh `gate-judge` against story + amended ADR + test plan + test files; it reruns `npm test` itself.

## 2026-06-15T01:45:00Z — Gate 3 (Test Design) — failing tests for feed-read-path
**Story/Phase:** live-feed #1 (feed-read-path) / Gate 3 (Test plan + failing tests)
**Decision:** APPROVE
**Judge:** Gate-3 `gate-judge`: **APPROVE**, blinding intact; all 6 rubric items pass. The judge **ran `npm test` itself** (not the quoted output): new `live-feed-read-path` suite **FAIL 0/23**, every failure legible as feature-absent ("feature is not implemented yet" / module "does not exist"), `src/api/feed/feedReadPath.js` confirmed absent via `ls`, guarded `loadModule()` so the missing require doesn't crash the harness; **all 34 pre-existing suites PASS**; new suite genuinely aggregated into `overallOk` (test.js:60/171/279/318). Test plan at the correct path from template; every AC→≥1 test with full edge coverage (3 edge outcomes + ordering + 50-cap + kind-1-only + non-followed-excluded + set-vs-fallback + relay error/empty + missing-profile); behavioral test names; the injectable-deps seam the tests use is the ADR-ratified amendment, not an un-pinned probe; env prereqs documented (no live services, no firmware).
**Why:** I concur. The tests pin the story's externally-observable contract and fail for exactly the right reason. **This Gate-3 commit is the baseline for the Gate-4 mechanical check** — `git diff <this-commit>..HEAD -- test/` must be empty after Implementation (no test weakening). SHA recorded immediately below.
**Next:** Story 1, Implementation — spawn `implementer` to make the 23 tests pass with minimum code honoring the story + amended ADR; then Gate 4 (mechanical: I rerun the full `npm test` + verify the test-dir diff is empty).

## 2026-06-15T02:05:00Z — Gate 4 (Implementation) — mechanical, verified by Director
**Story/Phase:** live-feed #1 (feed-read-path) / Gate 4 (Implementation — mechanical)
**Decision:** APPROVE
**Judge:** n/a (Gate 4 is mechanical — no judge; the Director verifies).
**Why:** I ran every check myself. **4.1** Full `npm test` (identical Stage-0 baseline command) → **Overall PASS**, **416 tests** (393 baseline + 23 new); `live-feed-read-path` PASS 23/23, all 34 pre-existing suites still PASS. **4.2** `git diff 9c5a0035..HEAD -- test/` (Gate-3 baseline `9c5a0035`) and the working-tree `test/` diff are **both empty** — no test weakened in any intermediate commit. **4.3** No concept definitions changed (source diff is only `src/api/index.js` + new `src/api/feed/feedReadPath.js`) → **no firmware reinstall** needed; `package.json`/`package-lock.json` untouched → **no new dependency**. **4.5** Implementer reported **no ADR deviation** (design satisfied all 23 tests as specified; nothing to route back to the Architect → no contribution to Stopping rule 3). Implementation is minimal and additive: `buildFeed`/`handleGetFeed` honoring the four-outcome union + `relaySource` discriminator + injectable-deps seam, route registered alongside `/api/profiles` and `/api/relay/external`; read-only, reversible.
**Next:** Story 1, Review — spawn `reviewer` (fresh context, never the Implementer's) to audit the diff against story + amended ADR + test plan and run the quality gates; on PASS the Reviewer flips the story `**Status:** Done` in the review commit. Then Gate 5 (judged).






