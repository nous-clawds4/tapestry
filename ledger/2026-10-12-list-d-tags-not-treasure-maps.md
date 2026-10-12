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
