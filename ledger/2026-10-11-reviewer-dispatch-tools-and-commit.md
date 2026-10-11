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

**Pointer:** `engineering-team/reviews/duty-menus-and-self-maps/2-duty-menus-pre-nip.md` § Round 2 → Harness friction;
`.claude/agents/reviewer.md`; `engineering-team/workflows/5-review.md` § Per-phase commits.
