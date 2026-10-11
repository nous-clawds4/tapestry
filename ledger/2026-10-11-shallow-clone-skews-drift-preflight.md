# In a shallow cloud clone, the phase workflows' origin-drift preflight reports a nonsense divergence

**Id:** 2026-10-11-shallow-clone-skews-drift-preflight
**Type:** meta
**Opened:** 2026-10-11 (book `assistant-duty-cards` close, retro)
**Status:** OPEN
**Done:** —

**What was seen.** Workflows 1 and 2 open with an origin-drift preflight: run `git fetch origin staging`, and if the
base is behind `origin/staging`, report the count and ask whether to rebase. This session's container started from a
shallow clone of `staging` (`git rev-parse --is-shallow-repository` → `true`).

After the fetch, `git status -sb` read `## staging...origin/staging [ahead 586, behind 51]`, and
`git merge-base HEAD origin/staging` found no common commit. The local branch was in fact 290 commits *behind* and 0
ahead. Only `git fetch --unshallow origin staging` gave the true count. A session that trusted the first reading might:
- ask the owner about 586 local commits that do not exist;
- push;
- or re-branch from a wrong base.

This session noticed only because "ahead 586" made no sense in a fresh container.

Nearby, and closed: `2026-10-07-shallow-clone-trips-lint-l10` and `2026-10-09-lint-l10-misfires-on-shallow-clones`,
the same root cause in harness-lint L10. This row is the preflight's instance.

**Fix shape.** Any of these, in order of effort:
1. **The workflow text:** one sentence in workflows 1 and 2, step 0: "If `git rev-parse --is-shallow-repository` says
   `true`, run `git fetch --unshallow origin staging` first; on a shallow clone the counts are meaningless."
2. **The SessionStart digest** (`scripts/session-start.sh`): warn once when the clone is shallow.
3. **Both.**

**Pointer:** this session's first tool calls (2026-10-11); `engineering-team/audits/assistant-duty-cards/audit.md` §7.
