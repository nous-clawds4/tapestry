# Tags & Taggings — review notes

Review of [`tags.md`](../../protocols/drafts/tags.md) and its sibling `event-taggings.md`, in light of the Treasure Maps, Pins and Spawning drafts. Most important first.

## Needs updating

1. **`d`-tag collision in event taggings (bug).** *Status: reportedly fixed by Vinney on his branch (W20); not yet on `main`.* `event-tag-<descriptor>-<target8>-<asserter8>` takes `target8` from the *author* segment of an `a` target. Tagging two Tags (or two restaurants, or two DLists) by the same author as "Awesome" gives both assertions the same `d`, so the second silently replaces the first. **Fix:** `target8` = the first 8 hex characters of sha256 of the full target value. The Pins draft adopts this (Pins § 3.1).
2. **Pins move out.** § Pins / § Unpinning become the Pins NIP. The `tag-pinning` concept, the `tag-pin-…` `d` and the `curation-method` JSON are superseded (Pins § 10).
3. **Two shapes for one assertion.** *Status: on hold (W19), open as an issue for Vinney.* Pubkey taggings name the Tag directly (`a`). Event taggings name it indirectly, through a per-tag header in `z`. Readers must implement both.
   - *Option A:* keep both. It's cheap, and documented.
   - *Option B:* make the **tag-element itself a DList header** (give it `names`), and have every tagging `z` to it directly, whatever the target.
     - That removes the per-tag header event, the `tagging-with-specific-tag` concept, and the 3-publish sequence.
     - It matches Pins, and makes "the list of things tagged X" literally a DList.
     - The legitimacy check in Event Taggings (is the header a member of an honored namespace?) becomes: is the tag-element a member of an honored `tag` namespace? That's the same check pubkey taggings already need.
   - Recommend B for new work, with readers unioning both shapes. It's wire-impactful, like every concept change.
4. **`curation-method` violates *what and where, never how*.** Observer, method, cutoff and `includeScoreInTL` are published on the pin today. They belong in the private Trust Determination Method, and "include scores" belongs in the Treasure Map.
5. **Trusted List naming.** The `tl-pin-<obs8>-<tagAuthor8>-<slug>` `d` tags predate the Treasure Maps rule `d` = scope. The replacements are `30392:tag::⟨T⟩` → `d = tag::⟨T⟩`, and so on; retract the old lists in place.

## Missing

6. **Finding taggings of items in one DList.** The Trusted List of *Mexican restaurants in Nashville* needs every Mexican tagging whose target is an item of Restaurants in Nashville. The target's DList membership isn't on the tagging, so no single filter finds them. The reader must fetch every Mexican tagging and intersect.
   - ~~Proposal: a category hint on taggings~~ — **rejected (W21).** Readers scan the Tag's taggings and intersect with the DList's items.
   - It's a hint, never a gate: readers still check membership.
7. **Which tag-elements count.** Anyone can create a "Podcaster" Tag, and slugs collide across authors. The spec says taggings are judged per point of view, but says nothing about how a reader chooses *among competing tag-elements*: duplicates, spam Tags, a "canonical" Podcaster.
   - Suggest: tag-elements are themselves items on the `tag` DList, so they're curated by the same per-POV machinery. The supported Tags set is the observer's answer.
8. **Tag relationships.** No synonyms (*Vegan* = *Plant-based*), hierarchy (*Vegan* ⊂ *Vegetarian*), or translation. Not needed for v1. But Trusted Lists will want to know whether *Vegetarian* includes *Vegan* items, so reserve a way (for example, `b`-tag inheritance, per `inherit-from.md`).
9. **Applicability contexts are too coarse.** *Status: extension approved (W23).* The hints are `tag-for-nostr-pubkey` and `tag-for-nostr-event`. Supported Tags are per *category* (a kind, a DList), so applicability should extend to those contexts: `tag-for-kind:<k>`, `tag-for-dlist:<coord>`. Spawning § 3.5 proposes using applicability as the community default for Supported Tags.
10. **Owner override.** Should a viewer's own tagging override their community *in their own view*? The Pins draft says yes for Pins. For Tags it's a UX choice, but the spec should state the rule either way (Pins, open question 3).
11. **Spawning isn't mentioned.** tags.md never says that a (Tag, category) pair implies a Trusted List and a Score family. Add a short § pointing to the Spawning draft.
12. **Taggings carry no reason.** DList items allow `comments`; taggings could reuse it for an optional reason or evidence. That helps disputes.

## Fine as is

- Polarity buckets and the reserved band. Pins reuses them, with `0` proposed as "no stance".
- `a`-preferred, `e`-allowed references. Pins keeps `a` for targets, with `e` as optional provenance.
- Federation through repeatable namespace `z` tags.
