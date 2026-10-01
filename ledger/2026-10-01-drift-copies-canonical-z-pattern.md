# The drift route repeats the canonical z-tag pattern that identities.js keeps private

**Id:** 2026-10-01-drift-copies-canonical-z-pattern
**Type:** cleanup
**Opened:** 2026-10-01 (tagging-edges #4 review, harness friction 2)
**Status:** OPEN
**Done:** —

**What was seen.** `src/api/tagging-edges/drift.js` declares its own
`CANONICAL_Z_RE = /^39998:(.*):nostr-user-tag$/s`, character for character the one at
`src/pipeline/tagging-edges/identities.js:10`, which that module does not export (its `module.exports` is
`{ resolveIdentities }`). drift.js uses its copy once: after a `local` identity refusal it takes the canonical
pubkey's 8-character prefix from the z-tag it read, since `resolveIdentities` returns only the refusal then (ADR
`tagging-edges/0004` T11). Story 4 § Deviations ("The drift route") names the copy and calls it worth exporting in a
later clean-up. Two copies of the rule that reads the canonical stamp can drift apart; today they agree.

**Fix shape.** Export `CANONICAL_Z_RE` from `identities.js` beside `resolveIdentities`, and have drift.js take it
from the `require('../../pipeline/tagging-edges/identities')` it already makes, deleting its copy. No behaviour
changes, and drift.js loads nothing new, so DR23 (it loads stack-free) is unaffected. Re-run
`test/tagging-edges-drift-route.test.js` and `test/tagging-edges-runner.test.js` (SR77 checks what `identities.js`
exports, by `resolveIdentities` only).

**Pointer:** `engineering-team/stories/tagging-edges/4-tagging-pipeline-panel.md` § Deviations, "The drift route";
`engineering-team/reviews/tagging-edges/4-tagging-pipeline-panel.md` § Harness friction 2.
