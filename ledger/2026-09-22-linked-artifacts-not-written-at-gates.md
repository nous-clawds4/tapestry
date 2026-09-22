# A story's Linked artifacts lines are not written at the gates that own them, and the Review line conflicts with the Reviewer's write scope

**Id:** 2026-09-22-linked-artifacts-not-written-at-gates
**Type:** meta
**Opened:** 2026-09-22 (assistant-identification-tags #1, review § Harness friction 2)
**Status:** OPEN
**Done:** —

**What was seen.** The user-story template ends with three placeholders — ADR "(filled in after Architecture
phase)", Test plan "(filled in after Test Design phase)", Review "(filled in after Review phase)". Neither
`.claude/commands/design-architecture.md` nor `design-tests.md` nor the workflows tell their phase to fill its
line, so story 1's placeholders survived to Review. The Reviewer's briefed write scope (the review file and the
story's Status flip) does not include the Review line, so the Reviewer left it too; the main session filled all
three in the review commit.

**Fix shape.** Each phase's per-phase commit fills its own line (Architecture the ADR path, Test Design the plan
path, Review the review path, by the Reviewer, whose sanctioned writes gain that one line in `roles/reviewer.md`
step 9). A lint check could flag a `Done` story with a placeholder left.

**Pointer:** review `engineering-team/reviews/done/assistant-identification-tags/1-the-one-answer-and-the-hubs-first-real-mark.md`
§ Harness friction 2; `engineering-team/templates/user-story.md` § Linked artifacts.
