# An ADR described how a feature flag is read without citing the code that reads it, and got it backwards

**Id:** 2026-10-12-adr-flag-reading-not-cited
**Type:** meta
**Opened:** 2026-10-12 (book `assistant-self-map`, review of story 1, harness friction 1)
**Status:** OPEN
**Done:** —

**What happened.** ADR `assistant-self-map/0001` sub-decision 6 said BullMQ schedule entries count "when
`TASK_QUEUE_ENABLED` isn't `false`". Every reader of the flag in the code compares `=== 'true'` with a default of
`'false'`: `bin/control-panel.js:333`, `src/api/index.js:555`, `src/api/manage/commands/runTask.js:417` and
`src/api/deploy-safety/index.js:100`. The Implementer followed the ADR, and the check counted schedules the instance
never runs when the line is missing from `brainstorm.conf`. The fixtures' Docker config sets the flag to `'true'`, so no
test could notice. The review caught it (finding B2).

**Fix shape.**
- An Architecture pitfall in `workflows/2-architecture.md`: when a decision depends on a flag or setting, quote the line
  that reads it, including its comparison and default.
- A Test Design pitfall beside the one in row `2026-10-12-test-configs-not-from-deployments`: for each flag a story
  reads, one test with the setting absent.

**Pointer:** `engineering-team/reviews/assistant-self-map/1-the-self-map-page-and-its-check.md` § Harness friction.
