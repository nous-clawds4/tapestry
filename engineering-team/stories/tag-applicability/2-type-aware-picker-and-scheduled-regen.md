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
  preexisting-tags list renders, then it is sourced from the "Tags for Nostr Events" Trusted
  List and those tags are shown first / by default; correspondingly, tagging a **pubkey** sources
  the "Tags for Nostr Pubkeys" list.

- [ ] **Fallback when the list is unavailable.** Given the appropriate Trusted List cannot be
  loaded, when the picker renders, then it falls back to the live `/api/tags/index` filtered by
  usage type — never an empty or broken picker.

- [ ] **Full search always reachable (hard requirement).** Given the picker is open in either
  type context, then the **full tag universe** is reachable from the same dialog — search across
  all tags is one tap/toggle away, never buried, and the picker **never** hard-filters to the
  type-scoped set with no escape.

- [ ] **All three surfaces.** The type-aware behavior applies on the shared **AddTagDialog**
  (profile tagging via `ProfileTagsSection`, note tagging via `NoteTags`), **TagSomeoneModal**,
  and **TagANoteModal**.

- [ ] **Scheduled regeneration.** Given the scheduler is registered, then the two Trusted Lists
  regenerate on a modest, operator-tunable cadence (e.g. 10–30 min) via the existing task-queue
  pattern (`taskRegistry.json` + the per-task Queue/Worker convention).

- [ ] **No regression.** Existing tagging flows still work end-to-end; no existing read path is
  removed or weakened; a tag reachable before is still reachable.

## Concepts touched
- `39998:<TA>:tag` — the shared vocabulary the picker draws from.
- `39998:<TA>:nostr-user-tag`, `39998:<TA>:nostr-event-tag` — the two type contexts.

## Out of scope
- The same-slug cross-type create warning — Story 3.
- Changing the derivation rule or the TL shape (owned by Story 1).
- Ranking beyond what the TL/usage data already provides.
- Any push/deploy without operator approval.

## Open questions
- Whether the picker consumes the TL directly (client) or via a server read endpoint —
  Architecture (mirror the existing tag-index consumption where possible).
- Task-queue resource class (likely **not** the neo4j-heavy class — it's a strfry-scan +
  publish job); apply the entry-point tagging audit rule (BIBLE §24) if a tagged parent spawns it.

## Linked artifacts
- ADR: (filled in after Architecture phase)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
