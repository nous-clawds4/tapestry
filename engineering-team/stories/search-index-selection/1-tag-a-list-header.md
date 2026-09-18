# Story 1: Tag a list header

**Status:** Draft
**Created:** 2026-09-18
**Type:** Feature *(Light lane expected — no wire-format change; the tagging of an
addressable target already ships. Gate A to confirm.)*
**Epic:** `engineering-team/epics/search-index-selection.md`
**Design target:** `docs/SEARCH_INDEX_DLIST_SELECTION.md` (rev 3)

## Background

"Header" and "item" are **roles, not kinds**. A kind-39999 can be both at once: the per-tag
tagging header (`39999:<author>:tagging:<slug>-tagging`) is an element of the type header
`39998:<TA>:tagging-with-specific-tag` via its `z`, *and* the thing taggings point at via
theirs. The protocol does not distinguish.

The UI does, in three hardcoded places, and the result is that **no surface can tag a list
header today**:

- `ui/src/utils/dlistFields.js` `itemCoord` returns null unless `kind === 39999` (an
  already-carried `address` short-circuits first — that branch exists because a previous
  review found the re-derivation mints a bogus coordinate for other kinds).
- `ui/src/utils/dlistHeaders.js` `listCoordOf` branches on 39999 vs 9999 for the parent.
- `src/api/event-tags/index.js` resolves item events with `kinds: [39999]` and keys its map
  `39999:<pubkey>:<d>` (OPEN 306).

The three tagging affordances that exist — the note card, the DList item row, and profile
tagging — none of them points at a kind-39998. `ui/src/pages/List.jsx` renders the header's
title, description, author and coordinate with no tag handle.

This blocks step 3 of the near-term plan in the design doc ("tag the `github-accounts`
header"), which otherwise has to happen out of band.

**Membership already works.** The classifier passes an `a` value through verbatim with no
kind restriction (`src/lib/event-tagging/classify.js` `targetOf`), and `fullItemMembers` is
built from the assertions' address keys with no kind filter, so a tagged header already
reaches a published kind-30394. Only the *authoring* and the *display* are missing.

## User-facing description

As a curator, I want to tag a Decentralized List itself — not its items — so that I can say
things about the list, starting with "this is worth indexing for search", and see that
tagging rendered like any other.

## Acceptance criteria

- [ ] AC-1: The list page (`/list/:ref`) offers a tag affordance on the header block,
      alongside the existing per-item affordances, available to a signed-in viewer.
- [ ] AC-2: The published assertion targets the header's **coordinate** (`a` =
      `39998:<author>:<d>`), never its event id. A header edit must not orphan the tagging.
- [ ] AC-3: A tagged header resolves for display wherever tagged targets are listed: its
      name and description render, not a bare coordinate (OPEN 306).
- [ ] AC-4: The viewer's own stance on a header tagging is shown and can be retracted or
      disputed, at parity with item taggings.
- [ ] AC-5: Item tagging, note tagging and profile tagging are unchanged — same targets,
      same d-tags, same rendering (regression sentinels).
- [ ] AC-6: A tagged header with no parent concept degrades legibly rather than rendering
      under a misleading group heading (see open question 2).

## Open questions for Gate A

1. **Where else should the affordance appear?** The list index (`/lists`) rows are the
   obvious second home, and the concept pages a third. Recommendation: the list page only
   for this story; the index is a follow-on once the interaction is settled.
2. **How should a tagged header group in the Items view?** It groups by parent list, and
   **no kind-39998 in the local corpus carries a `z`** (400 sampled, zero with a parent), so
   a tagged header lands in "items with no list". Recommendation: give headers their own
   group heading ("Lists") rather than letting them fall into the orphan bucket. See the
   note below — headers arguably *should* carry a parent concept, but that is not this
   story's to fix.
3. **Does `itemCoord` change, or does the caller pass the coordinate?** Recommendation: the
   caller passes `{ address: headerCoord(header) }` explicitly and `itemCoord` is untouched.
   Its 39999 guard is deliberate, and the carried-address short-circuit already exists for
   exactly this case.
4. **Which tag vocabulary is offered?** The existing applicability machinery keys on
   `39999:` coordinates (`applicability.js` `A_COORD_RE`), so it may return nothing for a
   39998 target. Recommendation: confirm at design whether header tagging needs an
   applicability entry or is simply applicability-agnostic.

## Note: headers and their parent concept (out of scope, worth recording)

A list header could reasonably be an element of the firmware `list` or `curated-dlist`
concept, which would make the universe of DLists enumerable with one `#z` filter instead of
a scan over every kind-39998. No header does this today. It would be a **discovery** aid and
never a trust signal, since it is self-declared by the header's author — which is the right
division of labour: discovery by `z`, selection by tagging. Out of scope here; recorded so
the idea is not lost.

## Out of scope

The `author` curation constraint (story 2), per-pin curation and variants (story 3), the
`worth-indexing-for-search` tag's naming and authorship decision (design doc), and anything
in the deferred parts of the design doc.

## Linked artifacts

- Design target: `docs/SEARCH_INDEX_DLIST_SELECTION.md`
- Ledger: OPEN 306 (header targets do not resolve for display)
