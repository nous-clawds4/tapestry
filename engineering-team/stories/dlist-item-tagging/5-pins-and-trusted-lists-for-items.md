# Story 5: Pins and Trusted Lists for tagged items

**Status:** Draft
**Created:** 2026-09-10
**Type:** Feature *(Light lane — workflows/light-profile.md; Gate A pending; depends on story 4.
**Escalation watch:** the curation-method `targetTypes` enum is wire-visible — see Open questions
#1; if Gate A judges the added value a wire-format change, this story escalates to Standard with
an ADR.)*

## Background
Pinning a tag opts it into the viewer's curated set, and the scheduled publisher then emits
TA-signed Trusted Lists under the viewer's POV: `runOnePin` → kind **30392** (`p` members,
profiles) and `runOneNotePin` → kind **30393** (`e` members, notes). The kind family already
reserves **30394** for **addressable (`a`) members** — `src/api/trustedList/index.js` accepts it
(`kinds 30392–30395 = p / e / a / i`) and `protocols/drafts/trusted-lists.md` specifies it — but
no runner produces one for tagged items. So a tag can be pinned, its GitHub accounts tagged, and
the resulting curated set never becomes a Trusted List. This is the book frame's last bullet, and
it is what a downstream indexer (Vespa, other repo) would actually subscribe to.

## User-facing description
As a user who has pinned a tag, I want the items I and my web of trust have tagged with it to be
published as a Trusted List under my point of view, so that other services can consume "the
GitHub accounts my POV considers white-hat hackers" as a signed, addressable list.

## Acceptance criteria
- [ ] AC-1: Given a pinned tag with trusted `a`-target taggings under the pinner's POV, when the
      pin refresh runs, then a TA-signed kind-**30394** Trusted List is published whose members
      are the tagged items' `a` coordinates, with the same `d`-tag discipline, `a`-tag back-ref
      to the tag element, and observer `p` tag the 30392/30393 runners use.
- [ ] AC-2: Given the curation method's target types, items are included only when the method
      selects them; the existing profile and note behavior is unchanged for every existing pin,
      including pins whose stored method predates this story (absent value reads as the
      pre-existing default — no silent inclusion or exclusion).
- [ ] AC-3: Given the curation-method dialog, the viewer can select item targets alongside
      profiles and notes, and the "select at least one" validation accounts for the new option.
- [ ] AC-4: Given a previously published 30394 whose membership no longer qualifies, the stale
      list is retracted by the same mechanism the 30392/30393 runners use.
- [ ] AC-5: Given the Pins page and the tag page's Pinned tab, the 30394 list's status is shown
      alongside the existing 30392/30393 lines, with its member count.
- [ ] AC-6: Given a pin whose tag has no item taggings, no empty 30394 is published, matching the
      notes runner's behavior.
- [ ] AC-7: The 30392 and 30393 runners, their tests, and every existing published list are
      unaffected (regression sentinels).

## Concepts touched
- `39998:<TA>:tag-pinning` (curation method), `39998:<TA>:nostr-event-tag`.
- Spec: `protocols/drafts/trusted-lists.md` (30394 = `a` members — already specified).

## Out of scope
- The downstream indexer. Retiring/renaming existing lists. Any change to 30392/30393 wire shape.
- Applicability lists (already 30394 for a different purpose — keep the `d`-prefix namespaces
  distinct and say so in the Design note).

## Open questions *(resolve at Gate A)*
1. **`targetTypes` value.** Adding `'item'` (or `'dlist-item'`) to the enum changes a value that
   rides inside published `curation-method` JSON. Recommendation: it is **additive and
   backward-compatible** (absent = today's default `['profile','note']`, and unknown values are
   ignored by older readers), so a Design note suffices — but this is the Gate-A call, and the
   name is permanent once published. Recommendation: `'item'`.
2. **`d`-tag prefix** for the new lists: `tl-pin-items-` (mirrors `tl-pin-notes-`), distinct from
   the applicability lists' prefix. Confirm no collision.
3. Scoped gate: `test/item-trusted-list.test.js` + `test/generalized-tag-pinning.test.js` +
   the strfry write-assertion guard suite.

## Design note *(Light — after Gate A)*
—

## Edge cases & not-covered
—

## AC→handle lines
—

## Linked artifacts
- ADR: none expected unless Open question #1 escalates
- Review: `engineering-team/reviews/dlist-item-tagging/5-pins-and-trusted-lists-for-items.md`

Link by path only — never record verdicts or round history in this file.
