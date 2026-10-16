# ADR 0004: Lists pulled by kind — a fourth element on `item-kind`

**Status:** Accepted (NosFabrica, 2026-10-16)
**Date:** 2026-10-16
**Story:** none: docs lane (Protocol-Spec workflow, docs-mode), recorded in the intake entry of 2026-10-15, "Event Index". Design record: `docs/EVENT_INDEX_DESIGN_HANDOFF.md`.

## Context

Event Index reads native NIP-52 events (kinds `31922` and `31923`) by kind and never copies them (ADR 0003). To stand beside its feed lists as a *Nostr events* list, those events need a list whose header can carry a name, declarations and presentation hints. Worksheet W34 asked for this in general: a schema-driven renderer can draw a DList item from its header, but a bare kind has no header.

What [DList Cross-NIP Compatibility](../../../protocols/drafts/decentralized-lists-compat.md) (🧪 publish-ready) offers today:

- `["item-kind", "<kind>", "<description?>"]` on a header names a foreign kind the list accepts; a header without `item-kind` accepts only `9999` and `39999`;
- a foreign event joins by **Method 3**, its author's `z` claiming the list, or by **Method 2**, a curator's `39999` with an `a` to it;
- declarations on the header apply additively over the foreign kind's own NIP.

Neither fits native publishers: they won't add another list's `z`, and a curator item per event doubles every event, which is the copying ADR 0003 rejects. [Content Categories](../../../protocols/drafts/content-categories.md) § 1 already treats a NIP kind as an "old-school DList" whose membership is the kind itself; nothing lets a DList header say so.

## Options considered

### Option A — A fourth element on `item-kind`

`["item-kind", "<kind>", "<description>", "kind"]`: every event of that kind is a candidate item. No fourth element (or `z`) keeps today's rule.

- **For:** one tag the compat draft already defines; old readers degrade safely (they read it as Method 3 and find fewer items, never wrong ones); a header can mix rules per kind.
- **Against:** a positional element, so a header that wants it must write a description, even an empty one.

### Option B — A new header tag

`["item-scope", "<kind>", "kind"]` beside `item-kind`.

- **For:** leaves `item-kind` untouched.
- **Against:** two tags to keep in step for one kind; a reader that knows `item-kind` but not the new tag gets the same degraded view anyway.

### Option C — Declarations on the kind's content-category item, or on a view binding

Carry the schema on Content Categories' item for the kind, or on an Opinionated Views binding by kind.

- **For:** no change to DList headers.
- **Against:** neither is a list: no `names`, no place among lists, nothing a list hierarchy (a master *Events* list over child lists) can point at.

## Decision

We chose **Option A**. Normative in [protocols/drafts/event-index.md](../../../protocols/drafts/event-index.md) § 6, written as a general extension to move into DList Cross-NIP Compatibility once ratified.

- **The header declares** `["item-kind", "<kind>", "<description>", "kind"]` per kind; its declarations apply additively, and an event lacking a `required` field (or carrying a `disallowed` one) is not an item. (§ 6.1)
- **A reader selects** by kind without `#z`, on the relays where the kind lives; MUST bound every read (time window, limit, paging), because a kind list has no natural bound; validates; merges an event that also claims the list by `z`. (§ 6.2)
- **A reader trust-filters**: nobody vouches for an item of a kind list, so selection is entirely the reader's, per point of view: by the author's standing, or by a directory such as *Event Calendars* (W33). A reader with no trust signal says so rather than showing the unfiltered kind. (§ 6.3)
- **Method 3 stays meaningful** as the author's explicit claim, which readers may weigh; Method 2 lists stand beside kind lists. (§ 6.4)

This follows the architecture invariants: anyone may publish an event of the kind (decentralized-first), and which events count is decided per point of view at read time (POV-first, filter at view time).

## Consequences

- **Enables:** a *Nostr events* list beside the feed lists with no copies; schema-driven rendering of any NIP kind that someone gives a header (Divine's videos, kind `34236`, as well as calendar events); W34 graduates.
- **Constrains:** readers must bound and trust-filter kind lists; an unfiltered kind list is spam-prone by construction.
- **Debt:** the extension sits in event-index.md until it moves to DList Cross-NIP Compatibility; W7 (how `item-kind` composes with Tapestry concept headers) is unchanged and now covers this form too.
- **Firmware reinstall required?** No.

## Implementation notes

- `protocols/drafts/event-index.md` § 6 (with the *Nostr events* example in § 6.6).
- `protocols/worksheet.md`: W34 marked Graduated, history kept.
- No code: Tapestry's list readers (`ITEM_KINDS` in `src/api/dlist-curation/update.js`) read only `9999` and `39999` today; reading kind lists is a later story (intake entry).

## Out of scope

- Narrowing a kind list by tag values (a header naming a `#t`, say); readers may narrow by indexed tags for their own reads, but the header doesn't declare it.
- Relay-side filtering by list (worksheet W26's territory).
