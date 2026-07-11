# Review: NoteCard + enrichNotes extraction refactor — PASS (with SHOULD_FIX addressed)

**Scope:** behavior-preserving refactor extracting (a) the shared client component
`ui/src/components/NoteCard.jsx` from the feed's inline `FeedItem`, and (b) the shared
server module `src/api/_shared/noteEnrichment.js` (`enrichNotes`) from `feedReadPath`'s
`enrichAuthors`. Conversational (non-harness) change; no story/ADR/test-plan.

**Method:** 4-lens adversarial review run as a multi-agent workflow (each lens an
independent agent returning structured findings): behavior-preservation, seam quality /
future-readiness, test adequacy, architecture-fit. Reviewed commit `7f5279b8`; the
SHOULD_FIX + cheap nice-to-haves were then applied in `6164b9a6`.

## Verdicts

| Lens | Verdict |
|---|---|
| Behavior preservation | **clean** — moved code is byte-identical (FeedItem→NoteCard differs only in the signature line; enrichAuthors→enrichNotes only in one comment). Every className/conditional/prop preserved; removed imports genuinely dead; both suites pass. |
| Seam quality / future-readiness | **concerns** → resolved. The only real issue: `bsp-feed-*` class names on the shared card (SHOULD_FIX, below). |
| Test adequacy | **clean** — no coverage lost (verified by mutation that re-pointed T5/T6/T19/T24/T25 still fail when the moved code breaks); page→NoteCard delegation asserted; enrichNotes still fully covered via M1–M5 + E1. |
| Architecture fit | **clean** — display-name resolution correctly global (self-asserted kind-0, non-POV), POV extension point honored, decentralized-first held, no TA-pubkey hardcode, `_shared` is the right home (alongside `pov.js`), no new deps/tooling. |

## Findings & resolution

- **BLOCKER / SHOULD_FIX before merge:** none outstanding.
- **SHOULD_FIX (addressed in `6164b9a6`):** shared `NoteCard` wore feed-namespaced classes
  → renamed to surface-neutral `bsp-note-card-*` (+ CSS), so the two upcoming non-feed
  pages reuse it without inheriting feed styling or forking. Cheapest moment (1 edit now
  vs 3 after they ship). Behavior-preserving (computed styles verified identical).
- **NICE_TO_HAVE (addressed):** E2 locks the direct-import contract
  (`extractMentionPubkeys`, `PROFILE_LOOKUP_CAP`, direct `enrichNotes` resolution) the two
  new read paths will depend on; `noteEnrichment` header now states the cap CALLER CONTRACT.
- **NICE_TO_HAVE / NIT (deferred to the two new-location sessions — see OPEN.md / intake):**
  add a `NoteCard` layout-variant prop when the first variant is needed (don't fork);
  consider a trailing-options arg on `enrichNotes` for the first POV-aware decoration
  (additive, non-breaking — can wait); a NoteCard execution/render test (the node harness
  can't transpile JSX, so card edges stay source-text + browser-verified — pre-existing).
- **Explicitly NOT changed:** the per-module `NOSTR_TOOLS_PATH` constant is duplicated by
  codebase convention (6+ modules); consolidation would be a separate cross-cutting refactor.

## Gates (run, not trusted)
- live-feed-read-path **30/30**, live-feed-feed-page **27/27**; full `vite build` green.
- Feed browser-verified rendering identically before and after both commits (author link,
  relative time + hover title, actions menu, nostr: entity links, resolved @mention),
  zero console errors. Overall `npm test` FAILs are pre-existing unrelated backend suites.

**Verdict: PASS** — mergeable.
