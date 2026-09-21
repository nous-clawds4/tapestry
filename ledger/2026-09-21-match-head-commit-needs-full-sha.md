# `gh pr merge --match-head-commit` rejects a short SHA, and the refusal lands after the safe-to-merge verdict is already spent

**Id:** 2026-09-21-match-head-commit-needs-full-sha
**Type:** meta
**Opened:** 2026-09-21 (assistant-profile #2, staging PR #717 and promotion #718)
**Status:** OPEN
**Done:** —

OPEN.md row 256's fix candidate for `/cycle-prod` (and `/cycle-staging`) is to pin the merge to the
approved tip — `gh pr merge <n> --merge --match-head-commit <approved tip>` — so a push during the
wait cannot widen what the approval covered. It does not say which form of the SHA, and the short
form is refused by the API:

```
GraphQL: Variable $input of type MergePullRequestInput! was provided invalid value for
expectedHeadOid (Could not coerce value "ff8fd0d0" to GitObjectID)
```

The cost is not the failed command; it is where the failure lands. The gate chain is: required checks
green → **safe-to-merge verdict** → merge immediately. The refusal happens *after* the verdict, so the
verdict is spent while the operator works out what an opaque coercion error means, and
`docs/SAFE_TO_MERGE.md`'s "re-run the check if more than 5 minutes elapse" is already running. Seen on
the staging merge of #717: the retry had to re-check the head and CI and take a second safe verdict
before merging. The promotion (#718) passed `git rev-parse origin/staging` and merged first time.

**Fix shape.** When row 256's `--match-head-commit` guidance lands in the cycle skills, write the
full-SHA requirement into it (`git rev-parse HEAD`, never `--short`, and never a `%h` from a log
format). If the skills grow a helper for the chain, check the value is 40 hex characters *before* the
safe-to-merge step, so a malformed pin fails while the verdict is still cheap to get.

**Pointer:** `.claude/skills/cycle-prod/SKILL.md` and `.claude/skills/cycle-staging/SKILL.md` (step 5,
the merge), alongside OPEN.md row 256; `docs/SAFE_TO_MERGE.md` for the 5-minute rule this wastes.
