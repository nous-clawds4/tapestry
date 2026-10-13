# This instance's Trusted Lists use their own d tags, so no Treasure Maps key reaches them, yet every Duty Menu here offers Lists

**Id:** 2026-10-12-list-d-tags-not-treasure-maps
**Type:** protocol
**Opened:** 2026-10-12 (book `assistant-self-map`, ADR `assistant-self-map/0001` § Context)
**Status:** OPEN
**Done:** —

**What was seen.** Treasure Maps § 5.1 says "A List's `d` tag is its exact key without the kind". A reader builds its
filter from the Map key: `{"kinds":[30392], "authors":[A], "#d":["tag::⟨T⟩"]}`. This instance's Lists use other `d`
tags instead:
- `tl-pin-…` for kind `30392` (`src/api/trustedList/refreshPinnedTags.js:272-277`);
- `tl-pin-notes-…` for `30393` (`:409`);
- `tag-applicability-…` for `30394` (`refreshApplicabilityLists.js`).

The forms on staging's relay, TA `8e901369…`, on 2026-10-12, were `tl-pin-notes-f8ff11c7-6db8a13f-nostr` and
`tag-applicability-nostr-pubkey`.

**The effect.**
- **Duty Menus.** Every Duty Menu this instance publishes offers `30392`, `30393` and `30394` (book
  `assistant-duty-menu`; ADR `assistant-duty-menu/0001` K1). A reader that resolves a Map entry against that offer,
  and follows § 5.1, finds no List.
- **Self-Maps.** ADR `assistant-self-map/0001` claims no List in any self-Map here, with the reason `older-form`.

**Fix shape.** Publish each List under its Treasure Maps `d` tag as well, or instead. That means mapping each pin and
applicability list to its key:
- a `tag` key for a pinned Tag's list;
- a `pin` key for a supported set.

The old `d` tags should be retracted or kept as aliases. Until then, consider having the Duty Menu offer no List rows
(its book's owner decides). Book `duty-menus-and-self-maps` story 4's key grammar settles the profiles category slot
that `30392` keys need.

**Pointer:** `engineering-team/decisions/assistant-self-map/0001-a-self-map-check-from-what-has-landed.md`
sub-decision 3.

**Note, 2026-10-12 (book `duty-menus-and-self-maps` story 5, ADR `duty-menus-and-self-maps/0005` sub-decision 10).**
The owner's answer 2(a) gives `["status", "retracted"]` one meaning: the list is no longer maintained at its `d`
(Trusted Lists § Common wire shape). For the move to Treasure Maps `d` tags:
- an old `d` gets the marker when this instance stops maintaining a List there;
- an old `d` kept as an alias stays maintained and unmarked, even with no members;
- a Treasure Map reader never reads an old `d` (Treasure Maps § 5.1).

For the reference publishers' use of the marker (item 19 of row `2026-10-12-self-maps-spec-fold-forwards`):
- on a run that succeeds, they use the marker only for a stop: `retractStaleTLs` for a removed pin, and
  `retractLegacyKind` for the move off `30393`. `runOnePin` publishes a List with no members unmarked;
- two failure paths depart from 2(a), for the code books (ADR 0005, Context). A note List that fails to publish is
  marked on the same run, though its pin stands: `runOneNotePin` returns `status: 'error'`, and
  `refreshAllPinnedTags` keeps only `ok` note `d` tags. Under 2(a) that is a brief gap, so its `d` should stay in
  `currentNoteDTags`, as `tag-stack-merge-hardening` ADR 0001 (B4a) keeps the pubkey List's. A pin whose tag event is
  missing from local strfry has both its Lists marked; whether that is a gap or a stop is the code books' call. Until
  the next run republishes such a List, every reader reads it as no copy (Treasure Maps § 7).

**Note, 2026-10-12 (review of `duty-menus-and-self-maps` #5, non-blocking 5).** The story-5 note above treats keeping
an old `d` as an alias as an open choice for the move. Two specs already answer it for the pinned-tag Lists:
Treasure Maps § 12 (`protocols/drafts/treasure-maps.md`:637: "old lists retracted in place") and Pins § 10
(`protocols/drafts/pins.md`:234: "Existing `tl-pin-…` Trusted Lists are retracted in place as their replacements
publish"). Keeping an alias departs from both, and the code book that makes the move records that departure if it
takes it. Shipped readers still read `tl-pin-` `d` tags (`ui/src/hooks/useTagMemberSets.js`;
`src/api/profile-tags/index.js`, `enrichRowsWithTLStatus`), so the move has readers to bring along either way.
