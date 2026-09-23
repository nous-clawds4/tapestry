# Epic: feat-tags-modernization

**Created:** 2026-09-17
**Status:** Done (closed 2026-09-23 with the book; story folders left in place, matching the `contextual-pins` precedent — retirement to `done/` is deferred while the sibling `dlist-item-tagging` book shares this branch)
**Book:** `engineering-team/audits/feat-tags-modernization/book.md` (acceptance-frame, Standard)
**Provenance:** Operator decision 2026-09-17, mid-session, after a replay of the
`dlist-item-tagging` epic onto `feat/tags` required a divergent nav implementation and four
adapted sentinels. Operator: "getting feat/tags back up to speed with staging might be the most
important work. and then we integrate our work here with that."

## Goal
`feat/tags` — the deploy branch for tags.brainstorm.world — contains staging's content, with every
one-sided feature either carried across or explicitly dropped on the record, a written branch
policy that prevents the drift recurring, and security parity verified. Ordinary feature work then
lands on it by plain merge.

## Stories
`stories/feat-tags-modernization/` — to be planned. Expected shape, in dependency order:
1. **Census and destination ruling** — enumerate the 54 feat/tags-only commits and the one-sided
   features; the operator rules each promote-to-staging vs tags-only. Decides whether the pin
   stack is integrated once or twice. Docs-mode.
2. **The pin-stack integration** — `contextual-pins` × membership-methods/weighted-certainty in
   `refreshPinnedTags.js` + `publishTagPin.js`. Both shipped and live; needs an ADR and operator
   co-drive. The book's hardest story.
3. **The pinned-panel refresh decision** — client publish vs server recompute.
4. **The bulk merge** — the remaining supersets and cosmetic conflicts, behind a full-suite gate.
5. **Branch policy** — restore, amend, or replace the 2026-07-16 downstream-only rule; record it
   where the next session will find it.
6. **Land `dlist-item-tagging`** by ordinary merge; retire the parked `tags/dlist-item-tagging`.

## Decisions
`decisions/feat-tags-modernization/` — none yet. At least one ADR expected (story 2).
