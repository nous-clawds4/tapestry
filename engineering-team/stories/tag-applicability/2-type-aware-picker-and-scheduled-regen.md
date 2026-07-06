# Story 2: Type-aware tag picker + scheduled Trusted List regeneration

**Status:** Approved
**Created:** 2026-07-06
**Type:** Feature

## Background
Story 1 publishes two applicability Trusted Lists ("Tags for Nostr Pubkeys" / "Tags for Nostr
Events", HINT ∪ USAGE). This story makes them **visible and self-maintaining** (steps 3+4):

1. The three tag pickers become **type-aware** — when tagging an event, preexisting tags are
   sourced from the event list first (and correspondingly for pubkeys) — **without** hiding the
   full tag universe (a hard requirement: a hint-blind hard-filter is the exact duplicate-forking
   failure this design prevents).
2. The list regeneration runs on the existing task-queue **schedule** so the lists stay fresh.

Affected: anyone adding a tag through any of the three picker surfaces; the task queue.

## User-facing description
As someone adding a tag to an event (or a pubkey), I want the picker to show me tags that fit
that target type first, while still letting me reach any tag by search, so I pick the right
existing tag instead of re-minting a duplicate — and I want those type lists to stay current on
their own.

## Acceptance criteria
Testable from the outside.

- [ ] **Type-relevant tags first.** Given a user opens the picker to tag an **event**, when the
  preexisting-tags list renders, then it is sourced from the "Tags for Nostr Events" applicability
  list (HINT ∪ USAGE); correspondingly, tagging a **pubkey** sources the "Tags for Nostr Pubkeys"
  list. Membership rule (David, 2026-07-06): the list for a context = (tags with that context's
  z-hint) ∪ (tags used on that context's targets). Computed live + viewer-inclusive.

- [ ] **Search is scoped to the context.** Given the user types a query, then the results are
  filtered **within** the current context's applicability list (searching event tags does not mix
  in pubkey-only tags) — matching David's "search from a list of tags-for-events."

- [ ] **Same-slug escape — "Show other results" (folds Story 3).** Given the user's query matches
  a tag that exists **outside** the current context (in particular an **identical slug** — e.g.
  typing "LFO" when tagging an event while "LFO" exists only on pubkeys), then the picker surfaces
  a **"Show other results"** affordance that expands to reveal those cross-context matches, so the
  user **adopts the existing tag instead of minting a duplicate**. This is the anti-fork escape
  that makes scoped search safe (it replaces the standalone Story-3 same-slug create warning).

- [ ] **Usage-hint descriptions.** Given a tag's usage context is known, then its picker row shows
  a small hint of which context(s) it belongs to (e.g. **"LFO · used on people & content"**),
  derived from applicability-list membership — so a cross-context tag is chosen knowingly.

- [ ] **Both picker surfaces.** The type-aware behavior applies on the shared **AddTagDialog**
  in its two mount contexts: profile tagging via `ProfileTagsSection` (pubkey) and note tagging via
  `NoteTags` (event). *(`TagSomeoneModal`/`TagANoteModal` are target selectors, not tag pickers —
  they already apply the correct tag by a-coordinate; out of scope.)*

- [ ] **Scheduled regeneration.** Given the scheduler is registered, then the two applicability
  Trusted Lists regenerate on a modest, operator-tunable cadence via the existing task-queue.

- [ ] **No regression.** Existing tagging flows still work end-to-end; no existing read path is
  removed or weakened; a tag reachable before is still reachable (via scoped search or "Show other
  results").

## Concepts touched
- `39998:<TA>:tag` — the shared vocabulary the picker draws from.
- `39998:<TA>:nostr-user-tag`, `39998:<TA>:nostr-event-tag` — the two type contexts.

## Out of scope
- ~~The same-slug cross-type create warning — Story 3.~~ **Folded into this story** (2026-07-06):
  the "Show other results" same-slug escape *is* the anti-fork affordance; Story 3 is superseded.
- Changing the derivation rule or the TL shape (owned by Story 1).
- Ranking beyond what the TL/usage data already provides.
- Any push/deploy without operator approval.

## Open questions
- Whether the picker consumes the TL directly (client) or via a server read endpoint —
  Architecture (mirror the existing tag-index consumption where possible).
- Task-queue resource class (likely **not** the neo4j-heavy class — it's a strfry-scan +
  publish job); apply the entry-point tagging audit rule (BIBLE §24) if a tagged parent spawns it.

## Linked artifacts
- ADR: `engineering-team/decisions/tag-applicability/0002-type-aware-picker-and-scheduled-regen.md`
- Test plan: `engineering-team/stories/tag-applicability/2-type-aware-picker-and-scheduled-regen.test-plan.md`
- Review: (filled in after Review phase)
