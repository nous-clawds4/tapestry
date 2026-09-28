# A review subagent printed a local-dev credential in its own tool output: its ad-hoc masking missed the variable name

**Id:** 2026-09-28-conf-secret-masking-snippet
**Type:** meta
**Opened:** 2026-09-28 (tagging-edges #2 review, harness friction 3)
**Status:** OPEN
**Done:** —

**What was seen.** A review lens read the local container's config to reach Neo4j and masked credential values with
its own regex. The pattern missed one variable name, so the local development instance's database credential appeared
once in that subagent's tool output (a session transcript, not a file). It is in no committed file. Sessions keep
re-inventing this masking step; nothing shared and tested exists.

**Fix shape.** A small shared helper (or an AGENTS.md snippet) that reads named values from the container config into
the environment without echoing them, with a test that feeds it the real variable names; briefs that need Neo4j access
point to it. Rotating the local development credential is the owner's call.

**Pointer:** `engineering-team/reviews/tagging-edges/2-gap-filling-pass-and-backfill.md` § Harness friction 3; AGENTS.md.
