# Review: shared-concept-vocabulary — the naming pass

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-08-10
**Diff:** `git diff 5da565df~1..5da565df` — 6 files, +21, −16.
**File:** non-numbered by convention — this lane has no story to match (see Harness friction 1).
**Lane:** doc/label (Implementer + Reviewer per `workflows/0-intake.md` step 3). No story/ADR/test
plan by design; the deliverable is words, so this audit is a cross-reference sweep.

## Quality gates (run by reviewer, not trusted)

- [x] Epic suites re-run by the reviewer after the rename: `my-offerings` **14/14**,
      `state-on-concept-page` **20/20**. Neither asserts on the changed labels, and neither moved.
- [x] `harness-lint` — clean at audit time.
- [x] UI build succeeds; both renamed pages verified live at `:7778`.
- [~] `npm test` — the Implementer's complete 4142-line capture reads `Overall: PASS`, all suites
      `0 failed`, 53 skipped, and I grepped that file rather than taking the summary on trust. A
      reviewer-initiated full run is **deliberately deferred**: this verdict requires further edits,
      so a full gate now would be superseded by the one that must follow them.

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

### Blocking

1. **`ui/src/pages/shared-concepts/SelfDeclaredDetail.jsx:78` — the child page still carries the
   retired name.** Clicking a row on **Community Offerings** navigates to a page whose heading reads
   **"🤝 Self-declared Shared Concept"**. The one flow this rename exists to make legible ends on the
   old name, one click in. `:69` has the same problem in its loading state (*"Loading self-declared
   shared concept…"*).

   *Asked change:* retitle the detail page's error-state heading and loading text to the new
   vocabulary — e.g. **"Community Offering"** — matching the parent. Note `:89` is the happy-path
   heading and correctly shows the concept's own name; only the fallback heading at `:78` is affected.

2. **`ui/src/pages/concepts/ConceptDetail.jsx:256` — a tooltip points at a page that no longer
   exists by that name.** The submit button's title ends *"…so it appears as a Self-declared Shared
   Concept."* Capitalised as a proper noun, that is a promise about where the user will find their
   concept — and the page is now called Community Offerings. This is the same class of dangling
   reference the Implementer correctly fixed four times in `Index.jsx`; this fifth one sits in a
   different file and was missed.

   *Asked change:* update the tooltip to name the surface the user will actually see. (It should
   arguably say **My Offerings** — that is where the author's own declaration now shows up, and it
   shows it even when the broadcast fails. Implementer's call.)

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

**CHANGES_REQUESTED**

The naming judgement is right and I would not change any of it. `Add to Registry` fixes a label that
was pointing the wrong way; `Community Offerings` completes the pair story 2 implied; and keeping
the two wire inspectors on their tag names is the more disciplined call, backed by a rule that is
short enough to remember — *workflow surfaces get the verb, wire inspectors get the tag.*

What is not finished is the sweep. A rename is only as good as its least-updated reference, and two
user-facing ones survive: the detail page one click below Community Offerings still announces itself
by the retired name, and a tooltip elsewhere still directs users to that name as though it were a
place they could go. The Implementer found and fixed four such references and deserves credit for
the instinct — these two are in files the rename did not otherwise touch, which is precisely where
this class of rot hides.

Two single-line edits, then a full gate run, and this passes.

## On CHANGES_REQUESTED
- Kick back to `/implement-feature` with Blocking 1 and 2; Non-blocking 1 optional in the same pass.
- No story status flipped (this lane has no story file); no completion detection performed.
