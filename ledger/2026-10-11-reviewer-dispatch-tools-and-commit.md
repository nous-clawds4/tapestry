# Reviewer dispatches name a tool the Reviewer agent lacks, and say not to commit

**Id:** 2026-10-11-reviewer-dispatch-tools-and-commit
**Type:** meta
**Opened:** 2026-10-11 (`duty-menus-and-self-maps` #2, review round 2, Harness friction 2 and 3)
**Status:** OPEN
**Done:** —

Two orchestrator-side defects in how this session dispatched the Reviewer subagent. Both recurred across rounds.

- **WebFetch.** The dispatch told the Reviewer to load WebFetch through ToolSearch to read NIP-85. The Reviewer agent's
  tool list (`.claude/agents/reviewer.md`, frontmatter `tools: Read, Write, Bash, Glob, Grep`) has neither tool. It
  fetched the spec with curl through the proxy instead, which worked. A docs-mode review checks external specs often
  (NIPs), so either the dispatch should say "curl through the proxy", or the agent should get WebFetch, as the Architect
  agent already has.
- **Commit.** The dispatch said not to commit. `engineering-team/workflows/5-review.md` § Per-phase commits says the
  Reviewer commits the review whatever the verdict. Story 1's review and both rounds of story 2's review were left
  uncommitted for the orchestrator. Round 1's friction item 2 said to note it if it recurred; it did.

Fix shape: either add WebFetch to `.claude/agents/reviewer.md` (a tool-whitelist change, so judge it against the role's
"no Edit" intent; WebFetch is read-only), or keep the whitelist and stop naming WebFetch in dispatches. For the commit,
either drop "don't commit" from dispatches, or say in `5-review.md` that an orchestrator may hold the commit when it runs
the lint and safe-to-merge checks itself.


**A third orchestrator-side defect, 2026-10-12 (`assistant-duties-settings` #1, review round 2).** The dispatch asked
the Reviewer to say in the review file whether the book's acceptance frame looked satisfied. The review template says
the completion-detection result is never recorded in the review. The Reviewer complied with one line and flagged the
conflict.

Fix shape: dispatches leave completion detection out (it is the orchestrator's step), or the template allows one
line.

**Pointer:** `engineering-team/reviews/done/duty-menus-and-self-maps/2-duty-menus-pre-nip.md` § Round 2 → Harness friction;
`.claude/agents/reviewer.md`; `engineering-team/workflows/5-review.md` § Per-phase commits.

**Recurrences in book `duty-menus-and-self-maps`, 2026-10-10 to 2026-10-13 (book close, audit §7 P2–P4).** The book's
reviews recorded these as known and added no note, so the close records them here.
- **Commit.** Every review was dispatched with the commit held: story 1 (the orchestrator flipped the story and
  committed), story 2's three rounds, story 3's two, story 4, and story 5's first dispatch (its finalizing dispatch
  committed). From story 2's round 3 on, the stated reason was an independent checker reading the review first (row
  `2026-10-13-review-independent-check-uncodified`).
- **WebFetch.** Named once (story 2, round 2). Later reviews fetched NIPs with curl through the proxy, with no friction.
  `.claude/agents/reviewer.md` still lists `tools: Read, Write, Bash, Glob, Grep`.
- **Completion detection.** Story 1's review and story 3's round-2 review recorded it in the review file; story 2's
  round 3 and stories 4 and 5 kept it in the chat, as the template says. So one book's reviews disagree with each
  other, not only with the dispatches.

Does it port to the other flow? Yes: Direction-mode books dispatch the same Reviewer agent.

**Note, 2026-10-13 (harness commit `22948d45`, audit `duty-menus-and-self-maps` §7 P13).** `workflows/5-review.md`
§ Per-phase commits now has an optional independent check, and it orders the check before the review commit: the
checker runs first, then the Reviewer folds in what holds and commits. So for a review that runs the check, holding
the commit until the check is done follows the workflow, and the commit stays the Reviewer's. That settles the commit
question only for that case. The row stays OPEN for its other defects: WebFetch named in dispatches, a commit held
for any other reason (story 1's orchestrator commit, for one), and where completion detection is recorded.
