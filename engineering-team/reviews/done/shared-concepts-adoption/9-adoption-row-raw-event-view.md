# Review: Story 9 — Clickable queue rows → raw header event view

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-08-07
**Diff:** tests `2d348c03`, impl `b95e375f` on `chore/snapshot-fixture-hygiene`

## Quality gates (run by reviewer, not trusted)

- [x] `node test/adoption-raw-event-view.test.js` — **3 passed, 0 failed** (was 2-failing
      pre-impl; S3 regression green both sides).
- [x] Vite build clean (10.1s). UI-only diff (new page + route + four `onRowClick` props); no
      server change, no other suite touched — full `npm test` not re-run (the tree beneath was
      full-suite verified at story #7's gate; the only intervening diffs are the doc-class copy
      commits and this UI addition).
- [x] Manual walk: clicking the "relationship" nomination row (a foreign header) navigated to
      `/tapestry/shared-concepts/header/39998%3A2d1f…` and rendered the raw event JSON under the
      concept-named title; a bogus coordinate rendered "No event found at this coordinate."
      without crashing; action buttons still act without triggering row navigation
      (stopPropagation retained, S3).

## Spec adherence (fast-track — Feature; Architecture skipped per the story)

- [x] AC-1: all four tables carry `onRowClick` (S2); declined navigates by `target` (S2's
      dedicated pin); coordinates URL-encoded on navigate.
- [x] AC-2: [HeaderEvent.jsx](ui/src/pages/shared-concepts/HeaderEvent.jsx) validates the
      coordinate shape (kind numeric, 64-hex pubkey, non-empty d — malformed input never reaches
      the fetch), scans via the existing public API, renders the newest event pretty-printed,
      titled from the header's names/name tag; not-found is a plain message.
- [x] AC-3: buttons unaffected (S3 + walk).
- [x] AC-4: raw JSON only — the page is deliberately the seed of a future detail view (story's
      Out of scope).
- [x] `onRowClick` is DataTable's established navigation idiom (the follows/muters/reporters
      precedent); no new mechanisms, no new dependencies.

## Findings

### Blocking

None.

### Non-blocking

1. Other surfaces (Trusted Dictionary entries, shared-concepts lists) could reuse the header
   route later — noted in the story's Out of scope as a separate ask.

### Harness friction

None.

## Verdict

**PASS**

## On PASS (same commit)

- [x] Story `**Status:**` flipped to `Done` in place.
- [x] Completion detection: epic polish outside the book's F0–F5 frame — arithmetic unchanged;
      the standing close offer remains with the owner.
