# Review: Story 2 — Retire "offering"

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-08-10
**Diff:** `e18fd020` (product side, committed short of the gate and marked partial) + `f5432ece`
(Test Design corrections after a kick-back) + `b9144aea` (both blocking findings resolved).
**Rounds:** one Test Design kick-back, one Review kick-back. Findings below are preserved as first
written; each carries its resolution.
**ADR:** none — Architecture skipped by design (Refactor).

## Quality gates (run by reviewer, not trusted)

- [x] **Tier 4 visual — performed here for the first time.** The test plan parked it as
      implementation verification and the phase sequence never returned to it, so nobody had looked
      at the renamed pages until this audit. **That is where both blocking findings came from.**
- [x] UI rebuilt by the reviewer before looking.
- [x] `harness-lint` — exit 0 at audit time.
- [x] `npm test` — **reviewer-initiated run: `Overall: FAIL` with exactly one failing suite,**
      `relationship-primitives-probe` H4 (`scan count went 6614298 -> 6614300`). OPEN.md **row 150**,
      fifth sighting; dispositioned by the row's own remedy — **9/0 with `strfry-router` quiesced**,
      router restored immediately. Every other suite `0 failed`, 53 skipped; this book's three suites
      14/14, 10/10, 15/15. The Implementer's independent capture read `Overall: PASS`.
      **Both findings below are invisible to that gate** — see "Things tests can't catch".

## Spec adherence

- [x] AC-1 — the "mine" page is named for sharing: **🤝 Shared by me**.
- [~] AC-2 — named for sharing, and the pair reads obviously. **But the name is not true.** See
      Blocking 1.
- [x] AC-3 — a reached concept reads **🤝 Shared**.
- [x] AC-4 — a concept that did not reach reads **⚠️ Didn't reach the community — try again**. The
      middle state is now visibly a failure with a retry, not a resting category. This is the heart
      of the story and it landed.
- [x] AC-5 — unconfirmed survives, distinct.
- [x] AC-6 — no third noun. The outcome copy describes the local half ("Saved here, but it didn't
      reach the community relay — try again").
- [x] AC-7 — the retired stem is gone from user-readable strings and the page names are gone
      everywhere including comments.
- [x] AC-8 — internal surface clean: `/api/shared-by-me` (verified 200, old path 404),
      `sharedByMe.js`, `SharedByMe.jsx`, `handleSharedByMe`, response field `concepts`.
- [~] AC-9 — nothing about behavior changes. True of the endpoint; **not true of the count line**.
      See Blocking 2.

## Things tests can't catch

Both blocking findings are **naming-accuracy defects that every suite passes**. That is not a gap in
the suites so much as a demonstration of their limit: `V1`/`V2` assert a heading matches `/shared/i`
and lacks the retired stem — a name can satisfy both and still assert something false about the rows
beneath it. No structural pin can check whether a page's title is *true*; only looking can.

The story's own subject makes this sharper than usual. This is a story about surfaces that claim
things they cannot back, and it shipped two of them.

## Findings

### Blocking — both RESOLVED in `b9144aea`

1. **`Shared by others` lists this instance's own shares. The name promises an exclusion it does not
   perform.** Verified against live data, not inferred: the page shows 9 rows including `tapestry`,
   `dog` and `dog-breed`, and `GET /api/shared-by-me` returns those same three coordinates as mine.
   The hook behind it (`ui/src/hooks/useCommunitySharedConcepts.js`) fetches every kind-39998 on the
   relay with **no author filter at all** — by design; it is the community-wide directory.

   The retired name was accurate. *Community Offerings* included mine, because the community
   includes me. **`Shared by others` is a regression in truthfulness introduced by this story** — the
   precise defect the story was written to eliminate, committed in the act of eliminating it.

   The story's AC-2 carries the same error in its premise ("the page listing what **other instances**
   have put out"), so this is not the Implementer's slip; it was baked in at Planning and nobody
   checked the premise against the data until now.

   *Asked change — **owner decided 2026-08-10: rename to `Shared with the community`.*** Renaming
   preserves what the page is for (the community-wide directory, this instance included) and makes
   the title true of the rows. The alternative considered and declined was filtering out this
   instance, which would have changed what the page *is* rather than what it is called.

   **RESOLVED, and the copy fixed with the label.** The heading, nav, breadcrumb, count line, empty
   message, three docblocks and the concept-page tooltip all now read **Shared with the community**.
   The subtitle was rewritten rather than substituted — it had claimed *"What everyone else has
   shared … the mirror of Shared by me"*, wrong twice over, since the page is not "everyone else"
   and "mirror" implies the two partition when one is a subset of the other. It now states the
   containment outright, *"including your own"*. Verified by the reviewer's own visual: the page
   lists nine, with `tapestry`/`dog`/`dog breed` (mine) beside `cat breed`/`cat`/`bengal cat`
   (staging's) under a heading that is now true of all of them.

2. **`ui/src/pages/shared-concepts/SharedByMe.jsx:99` — the count line says "4 shared" when 3 are
   shared and 1 explicitly did not reach.** The page prints `{data.concepts.length} shared`, so the
   count is of *rows*, not of *shares*. Live: 4 rows, 3 `published: true`, 1 `false`.

   The page contradicts itself within a few centimetres — "4 shared" sits directly above a row
   reading "Didn't reach the community — try again". Under this story's own model, *shared* is the
   achieved state; using it as the collective noun for attempts is exactly the conflation the story
   removes.

   *Asked change:* count what is true. `3 of 4 shared`, or `4 concepts · 1 didn't reach`, or drop the
   noun and print the number. Any of these; the wording is the Implementer's to choose.

   **RESOLVED, and better than asked.** Rather than pick one phrasing, the count computes, and the
   reviewer exercised every branch rather than the single state the live data happens to show:
   all-landed → `3 shared`; some-missing → `2 of 3 shared`; none-landed → `0 of 2 shared`;
   relay-unreachable → `3 to confirm`; empty → `0 shared`. That fourth branch is the one worth
   noticing — `0 of M shared` on an unreachable relay would be a false negative of exactly the kind
   this feature refuses to produce, and it is avoided deliberately. Live page reads **3 of 4
   shared**.

### Non-blocking

0. **`SharedByMe.jsx` count — a latent trap in the mixed case, unreachable today.** Exercising the
   branches turned up one that misreports: rows that are part `null` and part `false` yield
   `1 of 3 shared`, which counts an *unconfirmed* row as known-unshared — the false negative the
   feature exists to avoid. **Not reachable now**: `relay.ok` is one value per request
   (`src/api/concept/sharedByMe.js:141` passes the same flag to every row), so `published: null` is
   all-or-nothing. It becomes reachable the moment the relay check goes per-row — which the
   predecessor book's PRD seed already flags as an open question (*"is one relay the community?"*).
   *Optional:* treat any `null` as unconfirmable rather than assuming the flag stays global.

1. **`ui/src/pages/shared-concepts/SelfDeclaredDetail.jsx` — the file name no longer matches its
   subject.** Its heading is now "Shared concept" and its docblock says "Shared by others", but the
   file is still `SelfDeclaredDetail.jsx` and the route is still `self-declared/:uuid`. Route paths
   were correctly left alone (story Out of scope, bookmarked-URL precedent), and the filename carries
   no *retired* vocabulary — "self-declared" is the wire mechanism, which the naming rule permits.
   Consistent with the rule; noted only because a reader may expect the file to follow its heading.

2. **The wire `kept-local` wording was briefly made identical to submit's and restored.** Confirmed
   restored: `broadcastOutcome.js` now reads "Wired here. External publishing is off…" against
   submit's "Saved here. …". No action; recorded because the Implementer self-caught it and the
   record should show the near-miss.

### Harness friction

1. **OPEN.md row 150, fifth sighting.** Sole failure in the reviewer's gate; quiesced re-run 9/0.
   The sharpened remedy this epic's predecessor added to the row worked again — three independent
   confirmations now.

2. **The Tier 4 visual fell through a phase seam, and it is the only reason these defects were
   caught.** The test plan parked the browser check as implementation verification; Implementation
   stopped early to raise a legitimate test-lane kick-back; Test Design fixed the tests and had no
   standing to do a visual; and the story arrived at Review with the pages never having been looked
   at. No phase did anything wrong — the step simply had no owner once the sequence deviated from
   the straight line. Worth an OPEN.md `meta` row: **when a phase hands back, the verification steps
   it had not yet reached need an explicit owner, or they evaporate.**

## Verdict

**PASS** *(after one Review kick-back; the CHANGES_REQUESTED reasoning is preserved above)*

Both blocking findings are resolved and independently re-verified — the reviewer rebuilt, exercised
the count on every branch rather than the one the data shows, and looked at both pages. The wider
rename holds: no `Shared by others` survives in source or bundle, all eight pages in the section
answer 200, and the nav now reads **Registry · Add to Registry · Active b-tags · Active z-tags ·
Shared by me · Shared with the community · Adoption Queue · Trusted Dictionary**.

Two things the fix did better than the ask. The subtitle was **rewritten rather than substituted** —
the old text was wrong twice over and a label-only change would have left the page contradicting
itself in prose. And the count **computes** instead of picking a phrase, with a dedicated branch so
an unreachable relay reads *"to confirm"* rather than *"0 of M shared"*.

What this story should be remembered for is not the rename. It is that **AC-2 was written on a false
premise** — "the page listing what other instances have put out" — and Planning, Test Design and
Implementation all passed it through, because every one of them checked the words against the
*criterion* and none checked the criterion against the *rows*. The suites were green throughout and
always would have been. A person looking at the screen was the only guard that worked, and it nearly
did not happen: the Tier 4 visual had no owner once the phase sequence deviated (Harness friction 2).

## On PASS (same commit)
- [x] Story `**Status:**` flipped to `Done` in place.
- [x] Completion detection performed; result reported in chat, not recorded here.
