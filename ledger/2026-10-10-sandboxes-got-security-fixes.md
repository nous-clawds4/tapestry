# The two sandbox branches lacked the 2026-10-09/10 security fixes until PRs #842 and #843

**Id:** 2026-10-10-sandboxes-got-security-fixes
**Type:** bug
**Opened:** 2026-10-10 (book `negentropy-sync-access` close)
**Status:** DONE
**Done:** 2026-10-10 — PR #842 into `feat/tags` (merge `6dac1edb`, deploy succeeded) and PR #843 into `feature-magic-carpet` (merge `4265473c`, deploy succeeded); anonymous probes on both sandboxes answer 401 afterwards.

`feat/tags` (tags.brainstorm.world) and `feature-magic-carpet` (magic-carpet.brainstorm.world) last merged from
`staging` on 2026-09-27, so they lacked five security fixes that reached production on 2026-10-09/10: the negentropy-sync
shell fix (#830) and stories 4, 5, 6 (task routes; the presets-list part does not apply, those branches have no presets
module) and 7 of `security-auth-exposure` (#837, #839, #840, #841). They were cherry-picked onto each sandbox with the
owner's approval. On `feat/tags` the full suite matched the untouched branch apart from 29 new passing tests (the same
8 pre-existing failures in 5 suites before and after); on `feature-magic-carpet` the main runner matched (68/0) and the
five ported suites pass. No CI runs on PRs into sandbox branches, so these local runs were the gate.

Lesson for later fixes: a security fix that reaches `main` does not reach the long-lived sandboxes by itself; port it
or merge `staging` into them in the same round.

**Pointer:** PRs #842, #843; book `negentropy-sync-access` audit.
