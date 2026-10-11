# The two sandboxes lack some safeguards staging has gained since they branched

**Id:** 2026-10-11-sandboxes-lag-staging-safeguards
**Type:** bug
**Opened:** 2026-10-11 (story security-auth-exposure #8, sandbox ports)
**Status:** OPEN
**Done:** —

Porting story 8 to `feat/tags` and `feature-magic-carpet` showed that each sandbox lacks safeguards `staging` has
added since the branches split, and that `feature-magic-carpet`'s API reference does not document its bounties and
receiving routes. Bring the sandboxes level: diff `src/utils/` and the outbound-request paths between `staging` and
each sandbox, port what is missing with its tests, and document the magic-carpet routes (with their 401/403 rules).
Details are in the story-8 port notes; re-derive them from the diff rather than relying on those notes.

Lesson (already in ledger `2026-10-10-sandboxes-got-security-fixes`): a fix that reaches `main` does not reach the
long-lived sandboxes by itself.

**Pointer:** story `security-auth-exposure/8-admin-action-sweep.md` § Shipped; PRs #848, #849.
