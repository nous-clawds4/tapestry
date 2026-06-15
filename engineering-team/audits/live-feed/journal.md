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

