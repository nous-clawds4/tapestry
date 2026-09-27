# W20's `target8` fix exists on Vinney's branches, in a different shape than W20 suggests and on no PR, so the worksheet entry cannot close yet

**Id:** 2026-09-27-w20-close-against-vinneys-fix
**Type:** protocol
**Opened:** 2026-09-27 (the Sept 2026 protocol drafts import, PR #760; W20 checked for the owner)
**Status:** OPEN
**Done:** —

**The question.** Worksheet W20 records a flaw: `event-taggings.md` § "The assertion d-tag" takes `target8` from an `a`
target's author segment, so two targets by the same author collide. It suggests `target8` = the first 8 hex of sha256
of the full target, and its Decision reads: "reportedly already addressed by Vinney … check his branch before closing".

**What his branches hold.** Commit `2417b807` (Vinney, 2026-09-10): "feat(event-tagging): a-target assertion d =
event-tag-<slug>-<author8>-<d16>-<hash8>-<asserter8> (dlist-item-tagging #2)". Review `09b5f8c3` passed it.

- It is on `feat/dlist-item-tagging`, and was carried into `feat/tags`, `feat/dlist-item-tls`,
  `feat/search-index-selection` and `integrate/staging-into-tags-2026-09`.
- None of those branches has a PR. It is not on `staging` or `main`, which still carry the author-segment rule.

**How it compares with W20.**

- **Same substance.** Uniqueness now comes from `hash8`, the first 8 hex of sha256 over the full coordinate, which
  the spec calls "the only segment that carries uniqueness". Same-author targets no longer collide.
- **Different shape.** An `a` target becomes `<author8>-<d16>-<hash8>`: the author's first 8 hex and the first 16
  characters of the `d` segment, both readable decoration, then the hash. It is not a bare 8-hex hash.
  - `e` targets are unchanged (the event id's first 8, already a hash).
  - Old-rule assertions are orphaned in place, with no migration and no dedupe.
- **So one W20 claim is not literally true.** W20 calls this "the same rule the Pins draft uses", but the Pins draft's
  `h8` is a bare hash (pins § 3.1: sha256 of target + "|" + context).

**To close W20:**

1. The owner and Vinney decide whether his shape answers W20, and whether `pins.md` § 3.1 should align with it (or
   the reverse).
2. `2417b807`'s spec text and code reach `staging`: a PR from `feat/dlist-item-tagging`, or through the tags
   integration.
3. W20's Status is set to Resolved, with a pointer to that PR.

**Pointer:** `protocols/worksheet.md` W20; `git show 2417b807`; `protocols/drafts/event-taggings.md` § "The assertion
d-tag" on those branches; `protocols/drafts/pins.md` § 3.1. Related review issues for Vinney: #761 (W19), #762
(pinning context).
