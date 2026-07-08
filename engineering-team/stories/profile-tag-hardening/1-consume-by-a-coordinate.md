# Story 1: Profile-tag reads resolve by the stable a-coordinate (consume-by-#a)

**Status:** Done
**Created:** 2026-07-07
**Type:** Bug (correctness / hardening)
**Provenance:** OPEN.md #16 — sharpened as a **contract violation**, not just fragility. Live-repro'd
2026-07-06 on `funny` (`39999:791dde…:funny`).

## Background
Every profile-tag assertion is written with a **hybrid** reference (ADR profile/0022): `["a",
"39999:<author>:<slug>"]` — the tag's **stable identity** — plus `["e", <tagEventId>]` — the
**applied-version provenance**. The ADR's contract is explicit: **consume by `#a`**, with `e` as
provenance only. But the **reads ignore `a` and resolve strictly by `e`**. Because a tag-element is a
kind-39999 **parameterized-replaceable** event, re-minting the same slug (or any edit) produces a new
event-id at the *same* a-coordinate — so the old `e` dangles and every assertion that referenced it
breaks:

- The **`tags-for-profile` read** keys taggings by the `e` event-id (and drops any assertion missing an
  `e`), so a replaced tag-element's taggings resolve to nothing.
- The **`aggregateProfilesTagged` scan** (which computes the **pubkey pinned-tag Trusted List**,
  kind-30392 — integrator-facing) finds taggings by `#e:[currentTagEventId]`, so it **silently omits**
  taggings that reference a *prior* version of the tag-element. This is a durable-list correctness bug
  in the same family as the note-TL cap we just fixed.
- The **UI** maps available tags by `eventId` and renders a truncated id (`id.slice(0,8)` — "a bunch of
  numbers") when the assertion's `e` no longer matches any current tag.

The event-tag stack already does this correctly (it references its tag by a-coordinate). This story
brings the profile-tag stack up to its own written contract. The *trigger* (duplicate-mint) is
independently discouraged by the tag-applicability picker, but this is the deeper, orthogonal fix —
any replacement (edit, re-mint, federation re-parent) exercises it.

## User-facing description
As someone viewing a profile's tags — or an integrator reading a tag's pubkey Trusted List — I want a
tagging to resolve to its tag by the tag's **stable identity**, so that editing or re-minting a
tag-element never orphans the taggings that reference it or drops them from the published list.

## Acceptance criteria
Testable from the outside.

- [ ] **A replaced tag-element still resolves.** Given a profile tagging whose tag-element has since
  been replaced (same author + slug, new event-id), when the profile's tags are read, then the tagging
  still resolves to the correct tag by its **a-coordinate** and surfaces its name/slug — not a
  truncated id.

- [ ] **The pubkey TL spans tag-element versions.** Given a pubkey tagged with a tag both *before* and
  *after* that tag-element was replaced, when the tag's pubkey pinned-tag Trusted List (kind-30392) is
  computed, then it includes taggings referencing **any** version of the tag-element (matched by
  a-coordinate), not only the current event-id.

- [ ] **Legacy `e`-only assertions still resolve (no regression).** Given an assertion that predates the
  hybrid write and carries only `e` (no `a`), then it resolves exactly as it does today — the
  a-coordinate resolution **unions with**, never replaces, the existing `e` path.

- [ ] **Un-replaced tags are unchanged.** Given the common case (a tag-element never replaced), reads
  return the same taggings, counts, and display as before — this is a strict superset.

- [ ] **The tag identity in the read is the coordinate.** Given the `tags-for-profile` read, then a
  tagging is associated to its tag by the stable coordinate (author + slug), and the profile UI
  groups/displays by that coordinate — so two assertions referencing different event-ids of the *same*
  tag collapse onto one tag.

## Concepts touched
- `39998:<TA>:nostr-user-tag` — the profile taggings being read/aggregated.
- `39998:<TA>:tag` — the tag-element whose a-coordinate (`39999:<author>:<slug>`) is the stable identity.
- `39998:<TA>:tag-pinning` — the pin driving the pubkey TL that must span versions.

## Out of scope
- **Preventing** duplicate/replacement mints (handled by the tag-applicability picker) — this is read
  hardening, orthogonal to the trigger.
- The **note/event-tag** stack (already resolves by a-coordinate).
- A **backfill/migration** of stored assertions — the union-read resolves legacy events at read time; no
  re-publish needed.
- Changing the **write** path (it already emits the hybrid `a`+`e`).

## Open questions (Architecture)
- **Which of the four `#e`-keyed scans** in `src/api/profile-tags/index.js` (≈ lines 445, 577, 724, 1271)
  need the `#a` union, and the exact per-site shape — enumerate; some may be provenance lookups that are
  correct as-is.
- **The `tags-for-profile` response-shape change** (grouping key `eventId` → tag coordinate) and **all
  consumers** of that response (not only `ProfileTagsSection`).
- **Union strategy:** scan `#a` (new) unioned with `#e` (legacy) at each site, deduped — confirm the
  dedup key and that counts don't double.

## Scope note (for the gate)
This is **one coherent "consume-by-#a" doctrine** applied across a read + a durable-TL aggregation + a
UI display; they are coupled (the read's keying and the UI's grouping must change together) so it lands
**atomically as a single story**, not a multi-story epic. If the operator prefers, the pubkey-TL
aggregation (integrator-facing correctness) could be split from the UI display (cosmetic) — but they
share the same mechanism, so a split mainly adds coordination cost.

## Linked artifacts
- ADR: `engineering-team/decisions/profile-tag-hardening/0001-consume-profile-tags-by-a-coordinate.md`
- Test plan: `engineering-team/stories/profile-tag-hardening/1-consume-by-a-coordinate.test-plan.md`
- Tests: `test/profile-tag-consume-by-a-coordinate.test.js` (wired into `test/test.js`)
- Review: `engineering-team/reviews/profile-tag-hardening/1-consume-by-a-coordinate.md` (PASS)
