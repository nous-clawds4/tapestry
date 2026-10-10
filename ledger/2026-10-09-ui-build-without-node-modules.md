# Implementers and Reviewers skip `vite build` for UI changes when the checkout has no `ui/node_modules`, though a one-minute fallback exists

**Id:** 2026-10-09-ui-build-without-node-modules
**Type:** meta
**Opened:** 2026-10-09 (relay-stream-gaps #3 review, harness friction 2)
**Status:** OPEN
**Done:** —

In a cloud session the checkout has no `ui/node_modules`. The relay-stream-gaps #3 Implementer could only transpile
the edited JSX. The Reviewer exported the tree to scratch with `git archive HEAD ui src/lib`, then ran
`npm ci --ignore-scripts` and `npx vite build` there: about a minute, and the working tree is untouched. Name this
fallback in the Implementer and Reviewer guidance for UI changes (`engineering-team/workflows/4-implementation.md`,
`5-review.md`), so a UI diff is never shipped on a parse check alone.

**Pointer:** `engineering-team/reviews/relay-stream-gaps/3-scheduled-negentropy-sync-presets.md` § Harness friction 2.
