# Review: Story 17 — Tag-detail Curated view + Pin curation menu simplification

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-05-26
**Diff:** working-tree changes vs. `156bc671` (HEAD on `feat/tracked-pinned-tags`)

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **PASS.** Every suite green. New Story-17 suites: contract
      33/33 PASS; publish 1/1 PASS. Pre-existing suites unchanged.
- [ ] _Playwright not used in this repo — skipped._
- [ ] _Lint not configured — skipped (per CLAUDE.md)._
- [ ] _Typecheck not configured — skipped (per CLAUDE.md)._
- [ ] _Build not configured — verified UI bundle builds cleanly during
      cycle-local; not a project-level gate._

## Spec adherence

- [x] Every acceptance criterion has a passing test (23 ACs + 4
      regression sentinels — see test plan coverage map).
- [x] No criterion is silently dropped.
- [x] No behavior added that isn't in the story:
  - Tag.jsx removes "View all my pinned tags" link (AC-1) and
    "Created by …" line (AC-2) — diff `ui/src/pages/Tag.jsx:130–143,
    154–156` (deletions).
  - `shortNpub` helper and `nip19` import removed from Tag.jsx; no
    other surfaces broken (PoV-cascade test PASS).
  - The cleanup deletes the previously-existing
    `useTagDetail` destructure of `author` from Tag.jsx but leaves
    the hook's return shape intact — no other consumers affected.

## ADR adherence

- [x] Files changed match the ADR's implementation notes section
      verbatim:
  - Created `ui/src/components/TagViewControls.jsx`
  - Created `ui/src/components/TagSomeoneModal.jsx`
  - Created `ui/src/utils/wotScore.js`
  - Modified `ui/src/pages/Tag.jsx`
  - Modified `ui/src/components/TagPageRow.jsx`
  - Modified `ui/src/components/CurationMethodDialog.jsx`
  - Modified `ui/src/components/TagPinAffordance.jsx`
  - Modified `ui/src/utils/publishTagPin.js`
  - Modified `ui/src/pages/BrainstormSearch.jsx`
  - Modified `src/api/profile-tags/index.js`
  - CSS rules added/modified in `ui/src/styles.css`
- [x] Layering / module boundaries respected:
  - Row layout follows ADR Decision 2 (three flex slots; scores
    move outside the navigable link).
  - Hover/touch reveal follows ADR Decision 3 (CSS `:hover` +
    explicit `pointerType==='touch'` reveal state); the Implementer
    did NOT extract a `useRowReveal` hook — that was an "optional"
    in the ADR; inline state in `TagPageRow.jsx` is consistent.
  - Server enrichment passthrough (Decision 12) is a 3-line
    addition inside the existing enrichment loop — no parallel
    code paths introduced.
  - Hide-don't-delete (Decision 8) uses `{false && (<>…</>)}`
    guards with single-line comments naming Story 17 — exactly
    the shape the ADR specified.
- [x] No new dependencies the ADR didn't authorize (no `package.json`
      changes).
- [x] No new lint/typecheck/build infra (CLAUDE.md).

## Concept-graph integrity

- [x] No firmware concepts changed; ADR confirms "No firmware
      reinstall." Confirmed `tag-pinning` schema unchanged — only
      a default *value* of `cutoff` and `includeScoreInTL` flipped.
- [x] No new TA pubkey literals introduced. Verified by grep:
      Story-17 added files (`TagViewControls.jsx`,
      `TagSomeoneModal.jsx`, `wotScore.js`) contain no hex literals;
      modified files do not add any new literals (the existing
      `TA_PUBKEY` literal at `test/customize-pin-curation-publish.test.js:35`
      is pre-existing test code and tracked separately by Story 16).
- [x] CLAUDE.md POV-first invariant respected — the Curated rule
      `applications > disputes` is applied AFTER the server's POV
      filter, not as a replacement.

## Things tests can't catch

- [x] No secrets in committed files.
- [x] No leftover debug logging or `console.log` in any Story-17
      touch (`grep -n "console\." ui/src/components/TagViewControls.jsx
      ui/src/components/TagSomeoneModal.jsx ui/src/utils/wotScore.js`
      returns nothing).
- [~] Commented-out code — see Finding NB-1 (the `{false && (…)}`
      guards are intentional per ADR Decision 8, not stale code).
- [x] Error paths handled:
  - `TagSomeoneModal.jsx` handles search-proxy network failure
    (catch → setError) and stale responses (seqRef guard).
  - `TagPageRow.jsx` preserves the existing per-row single-flight
    guard (`publishingPolarity`).
  - `Tag.jsx` `handleTagSomeoneClick` swallows login() rejection
    silently — matches existing `Pins.jsx` pattern.
- [x] Concurrency: `TagSomeoneModal.jsx` debounces + seqRef-guards
      stale results (250ms, identical to `TagPageSearch.jsx`).
- [x] Security: no new input validation surfaces. The filter input
      is client-only, applies to already-fetched rows — no server
      query injection.

## House rules check

- [x] Concept Graph API authority respected (no source-of-truth
      shift).
- [x] No new lint/typecheck/build tooling.
- [x] Per-deployment TA pubkey runtime resolution untouched.

## Findings

### Blocking

_None._

### Non-blocking

1. **`ui/src/components/TagPageSearch.jsx` — orphaned file.** With the
   Tag.jsx rewrite, no production code imports `TagPageSearch`
   anymore (`grep -rn TagPageSearch ui/src` finds only an
   informational comment in `TagSomeoneModal.jsx`). Vite tree-shakes
   it out of the bundle automatically, so no runtime impact, but
   per CLAUDE.md ("If you are certain that something is unused, you
   can delete it completely") this could be removed. Leaving it
   does no harm; deferring deletion to a future cleanup is also
   fine. Suggestion: delete the file in the same commit.

2. **Orphaned CSS rules in `ui/src/styles.css`.** The classes
   `.bs-tag-author`, `.bs-tag-author-avatar`, `.bs-tag-author-name`
   (lines 4682–4696) and `.bs-tag-pins-link` (lines 5429–5434) are no
   longer referenced by any JSX after the Story-17 Tag.jsx rewrite.
   Same disposition as NB-1 — Vite/Postcss does not strip unused
   CSS in this project, so these rules ship in the bundle. The
   bundle weight is negligible (a few dozen bytes). Suggestion:
   delete in the same commit; non-blocking if deferred.

3. **`useTagDetail.author` no longer consumed.** Tag.jsx no longer
   destructures `author` from `useTagDetail`'s return. The hook
   still fetches and exposes it (`ui/src/hooks/useTagDetail.js:68`),
   so other consumers are unaffected. The fetch overhead is small
   (one Meili lookup per request, already executed). Suggestion:
   consider trimming in a future cleanup; out-of-scope for this
   story.

4. **AC-9 runtime "no jiggle" — CSS-only verification.** The tests
   assert the load-bearing CSS rules
   (`.bs-tag-row-actions { visibility: hidden; min-width: 9.5rem; }`
   plus the hover/`is-revealed`/`is-expanded-mode`/`:focus-within`
   reveal selectors at `styles.css:4822–4835`). A real browser was
   not driven during this review — the test plan explicitly flagged
   this gap for manual smoke at review time. Local cycle-local
   smoke confirmed the bundle deploys and the control panel
   responds; a final in-browser pass over a tag with many rows is
   the right close-out before staging. Non-blocking; deploy hop
   verification handles it.

5. **AC-17 tooltip dynamism trimmed.** The ADR (Decision 10)
   suggested a tooltip that could vary by Pin/Unpin state. The
   Implementer settled on a single static `title="..."` literal
   (covering the Pin case explanatorily). This satisfies the AC
   ("a tooltip explaining what pinning does") and made the test
   regex (which requires literal `title="..."` syntax) pass.
   Reasonable trade-off; flagged for awareness if a per-state
   tooltip is desired later.

6. **`bs-tag-row-actions` retains its prior `margin-right: 0.5rem`.**
   This is left over from the old layout. With the new
   three-slot structure (actions sit *between* the link and the
   scores), the right margin no longer plays the role it did. Not
   a layout bug per se (the scores slot still renders correctly),
   but a small left-over. Non-blocking; observe in the manual
   review.

7. **Story 17 commits Story-14 paused artifacts indirectly.** The
   working tree carries untracked files from the parked Story 14
   work (`engineering-team/decisions/0013-treasure-map-pin-integration.md`,
   `engineering-team/stories/14-treasure-map-pin-integration.md`),
   plus a stray `concept-sharing-plan.md` at the repo root. These
   are NOT Story-17 deliverables. The Implementer should ensure
   the per-phase commit for Story 17 stages ONLY:
   - The 9 modified source/test files
   - The 3 new Story-17 component/util files
   - The 2 new Story-17 test files
   - The Story 17 story + ADR + test plan + this review
   The Story 14 + ADR 0013 artifacts should be committed separately
   if they're to be kept around as "drafts on ice." This is a
   commit-hygiene flag, not a code defect.

## Verdict

**PASS.**

Every AC has a passing test; every test passes; the implementation
matches the ADR's commitments file-for-file and decision-for-decision.
The 7 non-blocking findings are housekeeping items the Implementer
or a future cleanup story can address without further engineering
debate.

The WYSIWYG invariant (AC-22, the load-bearing claim that justified
flipping the cutoff default) is end-to-end-verified by the publish
suite using the live `defaultCurationMethod` from source — that's
the rigor that makes this story shippable to staging with
confidence.

**Recommended next steps:**
1. (Implementer) Commit Story 17 artifacts cleanly per Finding NB-7.
2. (Operator) `cycle-staging` once committed.
3. (Operator) Pause for manual mobile + desktop in-browser smoke
   on staging — AC-9 no-jiggle and AC-8/AC-15a touch-reveal need
   live cursor/touch verification (the tests prove the CSS shape;
   only a browser proves the runtime feel).
4. (Operator) Then Story 16 (TA-pubkey migration), then production
   cycle.

The two paused artifacts (Story 14 + ADR 0013) are not affected by
this review and remain on ice per the user's direction.
