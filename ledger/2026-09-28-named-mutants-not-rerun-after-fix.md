# A test adopted to kill a review's named mutant can stop killing it after the fix, and nothing re-runs the mutant

**Id:** 2026-09-28-named-mutants-not-rerun-after-fix
**Type:** meta
**Opened:** 2026-09-28 (tagging-edges #2 re-review, harness friction 2)
**Status:** OPEN
**Done:** —

**What was seen.** In story `tagging-edges` #2 the round-1 review handed Test Design a candidate test (CAND-R5, adopted as
SR64) that killed a named mutant (the redactor's URI and IPv4 rules removed) at the reviewed commit. The round-2 fix
sent that test's input down a new fixed-text path, so SR64 no longer reached the redactor; with both rules removed
every suite stayed green. Nothing in Test Design or Implementation re-runs the review's named mutants after the fix;
the re-review's own mutant pass caught it, and round 3 added SS29, SS30, SR73 and SR74.

**Fix shape.** When a review names mutants for Test Design, the Implementer's after-gate (or the re-review) re-runs
them on the fixed tree and records the kills beside the test plan's round entry.

**Pointer:** `engineering-team/reviews/tagging-edges/2-gap-filling-pass-and-backfill.md` § "Re-review" → Harness
friction 2; test plan § "Round 3".
