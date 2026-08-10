# Review: shared-concept-vocabulary — the naming pass

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-08-10
**Diff:** `5da565df` (the naming pass) + `7a7a2dd3` (the sweep completion, after one round back to
Implementation). Findings below are preserved as originally written; each carries its resolution.
**File:** non-numbered by convention — this lane has no story to match (see Harness friction 1).
**Lane:** doc/label (Implementer + Reviewer per `workflows/0-intake.md` step 3). No story/ADR/test
plan by design; the deliverable is words, so this audit is a cross-reference sweep.

## Quality gates (run by reviewer, not trusted)

- [x] Epic suites re-run by the reviewer after the rename: `my-offerings` **14/14**,
      `state-on-concept-page` **20/20**. Neither asserts on the changed labels, and neither moved.
- [x] `harness-lint` — clean at audit time.
- [x] UI build succeeds; both renamed pages verified live at `:7778`.
- [x] `npm test` — **reviewer-initiated run after the fixes**: `Overall: PASS`, every suite
      `0 failed`, 53 skipped, read from a complete 4142-line capture. No divergence from the
      Implementer's run and no row-150 flake this time — the first gate in this book where the two
      runs agreed outright. (At the first pass this line was deferred on purpose: a gate run before
      the required edits would have been superseded by the one that had to follow them.)

## Spec adherence — frame bullet 4

The bullet: *the words on these surfaces distinguish offering, adopting, and cataloguing.*

- [x] `Create New Shared Concept` → **`Add to Registry`** — the label was actively backwards, and its
      own subtitle already used the right verb.
- [x] `Self-declared Shared Concepts` → **`Community Offerings`** — pairs with story 2's `My Offerings`.
- [x] `Active b-tags` / `Active z-tags` reviewed and **kept**, under a rule worth having: *workflow
      surfaces are named for the verb; wire inspectors are named for the tag.* Endorsed — renaming a
      raw-tag inspector to something friendlier would hide what it is.
- [x] Four cross-references caught that would have rotted: both breadcrumbs, both `<h1>`s on the Add
      to Registry page, the Registry `+` button, and the Registry description's literal quotation of
      the retired name.
- [~] **The sweep stopped one page short.** See Blocking.

## Things tests can't catch

- [x] No route paths changed (`self-declared` remains the URL) — correct; renaming the path would
      break existing links for no user-visible gain.
- [x] The mechanism term is correctly retained where it describes the *wire fact* rather than a
      page: `dispositionActions.js:29,32`, `ConceptDetail.jsx:115–122`, `ConceptList.jsx:167,174,194`,
      and the `useCommunitySharedConcepts` comments. These are not leftovers and must not be swept.
- [x] The Add to Registry subtitle now actively redirects — *"it does not create or offer one. To
      offer a concept of your own, submit it from its concept page"* — which the label alone could
      not do.

## Findings

### Blocking — both RESOLVED in `7a7a2dd3`

1. **`ui/src/pages/shared-concepts/SelfDeclaredDetail.jsx:78` — the child page still carries the
   retired name.** Clicking a row on **Community Offerings** navigates to a page whose heading reads
   **"🤝 Self-declared Shared Concept"**. The one flow this rename exists to make legible ends on the
   old name, one click in. `:69` has the same problem in its loading state (*"Loading self-declared
   shared concept…"*).

   *Asked change:* retitle the detail page's error-state heading and loading text to the new
   vocabulary — e.g. **"Community Offering"** — matching the parent. Note `:89` is the happy-path
   heading and correctly shows the concept's own name; only the fallback heading at `:78` is affected.

   **RESOLVED.** Now `🤝 Community Offering` (`:81`) and "Loading community offering…" (`:72`);
   verified live by requesting a nonexistent coordinate. The happy-path heading (`:92`) is untouched.

2. **`ui/src/pages/concepts/ConceptDetail.jsx:256` — a tooltip points at a page that no longer
   exists by that name.** The submit button's title ends *"…so it appears as a Self-declared Shared
   Concept."* Capitalised as a proper noun, that is a promise about where the user will find their
   concept — and the page is now called Community Offerings. This is the same class of dangling
   reference the Implementer correctly fixed four times in `Index.jsx`; this fifth one sits in a
   different file and was missed.

   *Asked change:* update the tooltip to name the surface the user will actually see. (It should
   arguably say **My Offerings** — that is where the author's own declaration now shows up, and it
   shows it even when the broadcast fails. Implementer's call.)

   **RESOLVED, and improved on the ask.** The tooltip now names *both* surfaces — "listed under My
   Offerings — and under Community Offerings for everyone else" — which teaches the distinction at
   the moment of action rather than merely avoiding the stale name. Present in the built bundle.

**Why blocking rather than noted.** For a story whose entire deliverable is naming consistency,
these are not cosmetic residue — they are the defect the story was opened to remove, surviving in
the flow the story is about. The owner has said they intend to navigate the site and judge whether
it reads clearly; the click from Community Offerings to "Self-declared Shared Concept" is exactly
what would trip that walkthrough. Both fixes are single-line.

### Non-blocking

1. **`SelfDeclaredSharedConcepts.jsx:159` and `:164`** — the count line (*"7 self-declared shared
   concepts"*) and the empty message (*"No self-declared shared concepts found."*) still use the old
   phrasing beneath a heading that now reads Community Offerings. Defensible, since the rewritten
   subtitle introduces the mechanism explicitly — but jarring at a glance, and cheap to align while
   the blocking items are being fixed. *Optional:* "7 offered by the community" / "No community
   offerings found."

   **RESOLVED** — taken in the same pass, in those words.

### Harness friction

1. **The doc lane collides with harness-lint L4.** This lane produces a review with no story file —
   that is the lane's definition (`workflows/0-intake.md` step 3: doc/one-liner → Implementer +
   Reviewer). But L4 requires every *numbered* review to have a matching numbered story, so a
   doc-lane review filed as `3-<slug>.md` is a violation by construction. Resolved here by the
   repo's existing convention: a **non-numbered** review filename is `INFO non-numbered-review`
   rather than a violation (precedent: `reviews/search-and-router/strfry-router-first-boot-config.md`).
   This file is therefore `shared-concept-vocabulary.md`, not `3-…`. Related to OPEN.md **row 16**
   ("post-close reviews without stories; disposition pending"), which tracks the same L4 tension from
   a different cause — worth folding the doc-lane case into that row when it is dispositioned, since
   a lane the strictness table endorses should not need a naming workaround to satisfy lint.

2. **OPEN.md #158 did NOT fire this time, and the reason is instructive.** The L1 rule pairs a
   PASS-final review with a `Done` story. This review is `CHANGES_REQUESTED`, and the lane has no
   story file at all, so neither half of the pairing applies. Worth recording on the row: the
   red-window defect is specific to PASS verdicts on story-backed lanes. No amendment needed beyond
   this observation.

## Verdict

**PASS**

The naming judgement was right at the first pass and is unchanged: `Add to Registry` fixes a label
that pointed the wrong way, `Community Offerings` completes the pair story 2 implied, and keeping
the two wire inspectors on their tag names is the more disciplined call — under a rule short enough
to actually hold: *workflow surfaces get the verb, wire inspectors get the tag.*

What was missing was the tail of the sweep, and it is now complete. Neither retired label survives
anywhere in `ui/src`, `src`, `test`, **or the built bundle** — checked in both directions, because a
rename is only as good as its least-updated reference.

Two things the second pass got right that were not asked for, and both are the difference between a
rename and a vocabulary:

- **The four code comments.** The kick-back scoped to user-facing text. The Implementer also found
  four *comments* naming the page by its retired name — including this page's own docblock at line
  29, which is the first thing the next reader meets. Out of scope as written, correct to fix.
- **The durability note.** `SelfDeclaredDetail.jsx:30–32` now records *why* "self-declared" still
  appears below it: it names the **wire fact** — a b-tag pointing at its own event — never a
  surface. That is the naming rule written down at the one spot where someone would otherwise
  "helpfully" finish the rename and quietly break the mechanism vocabulary. Verified intact:
  `dispositionActions.js` (2), `ConceptDetail.jsx` (6) and `ConceptList.jsx` (3) keep their
  wire-fact uses, and all three `self-declared` route paths are unchanged — renaming those would
  have broken existing links for no user-visible gain.

Frame bullet 4 is met. The Shared Concepts section now reads: **Registry · Add to Registry ·**
*Active b-tags · Active z-tags ·* **My Offerings · Community Offerings · Adoption Queue · Trusted
Dictionary** — two verb-anchored pairs with the wire inspectors between them, still named for their
tags.

## On PASS
- No story status to flip — the doc/label lane has no story file by design (see Harness friction 1).
- Completion detection performed; result reported in chat, not recorded here.
